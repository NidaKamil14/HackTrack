import crypto from 'crypto';
import store from '../database/store.js';
import { emailConfig, isValidEmail, linkSigningKey } from './config.js';
import { getProvider } from './providers.js';
import { renderEmail } from './templates.js';
import { enqueueEmail } from './emailQueue.js';

/*
 * Notification dispatcher.
 * Route handlers call the event helpers below ONLY after the store operation
 * has succeeded. Each helper derives recipients from existing team / event /
 * role relationships (never from request input), then for every recipient:
 *   1. persists the in-app notification (idempotent via a dedupe key)
 *   2. checks the recipient's email preference and address
 *   3. queues the email (delivered asynchronously by emailQueue.js)
 * Helpers never throw: a notification problem must not undo or fail the
 * business operation that triggered it.
 */

export const CATEGORIES = {
  team: { label: 'Team activity', description: 'Team creation, join requests and decisions, new members.' },
  submissions: { label: 'Submissions', description: 'When your team’s project is submitted or updated.' },
  results: { label: 'Results & certificates', description: 'Published results and issued certificates.' },
  announcements: { label: 'Announcements', description: 'Updates from organizers and admins about your hackathons.' },
  assignments: { label: 'Assignments', description: 'Judging assignments and committee access (judges, screeners, organizers).' },
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES);

const EVENT_CATEGORY = {
  team_created: 'team',
  join_request_submitted: 'team',
  join_request_received: 'team',
  join_request_approved: 'team',
  join_request_rejected: 'team',
  team_member_joined: 'team',
  submission_received: 'submissions',
  submission_updated: 'submissions',
  results_published: 'results',
  announcement: 'announcements',
  judge_assigned: 'assignments',
  access_granted: 'assignments',
  reviewer_joined: 'assignments',
};

/* ---- Signed, single-purpose unsubscribe links ------------------------------
   The signature only authorises "turn off category C for user U"; it cannot
   be used to sign in or read anything. */
export function signUnsubscribe(userId, category) {
  return crypto.createHmac('sha256', linkSigningKey()).update(`unsubscribe:${userId}:${category}`).digest('base64url');
}

export function verifyUnsubscribe(userId, category, signature) {
  if (!userId || !CATEGORIES[category] || typeof signature !== 'string') return false;
  const expected = Buffer.from(signUnsubscribe(userId, category));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function unsubscribeUrl(userId, category) {
  const { apiPublicUrl } = emailConfig();
  const qs = new URLSearchParams({ u: userId, c: category, s: signUnsubscribe(userId, category) });
  return `${apiPublicUrl}/api/v1/notifications/unsubscribe?${qs}`;
}

/**
 * Core dispatcher. `recipients` are user ids; `dedupeBase` makes the call
 * idempotent per recipient. `data(user)` returns template data.
 */
export function notify({ type, recipients, dedupeBase, data, inApp }) {
  const category = EVENT_CATEGORY[type];
  const results = [];
  const unique = [...new Set(recipients.filter(Boolean))];

  for (const userId of unique) {
    try {
      const user = store.findUserById(userId);
      if (!user) continue;
      const templateData = { recipient: user, ...data(user) };

      const { frontendUrl } = emailConfig();
      const unsubUrl = unsubscribeUrl(user.id, category);
      const email = renderEmail(type, templateData, {
        frontendUrl,
        unsubscribeUrl: unsubUrl,
        categoryLabel: CATEGORIES[category].label,
      });

      const notification = store.addNotification({
        userId: user.id,
        type,
        category,
        title: inApp?.title?.(templateData) || email.subject,
        message: inApp?.message?.(templateData) || '',
        link: email.ctaUrl.replace(frontendUrl, '') || '/',
        dedupeKey: dedupeBase ? `${type}:${dedupeBase}:${user.id}` : null,
      });
      if (!notification) {
        results.push({ userId, status: 'duplicate' });
        continue; // already notified for this exact event
      }

      const prefs = store.getEmailPreferences(user.id, CATEGORY_KEYS);
      let skip = null;
      if (getProvider().disabled) skip = 'Email delivery is disabled on this server';
      else if (!prefs?.[category]) skip = `${CATEGORIES[category].label} emails are turned off`;
      else if (!isValidEmail(user.email)) skip = 'No valid email address on file';

      if (skip) {
        store.updateNotificationEmailStatus(notification.id, { emailStatus: 'skipped', emailStatusReason: skip });
        results.push({ userId, status: 'skipped', reason: skip });
        continue;
      }

      enqueueEmail({
        notificationId: notification.id,
        to: user.email.trim(),
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          ...(dedupeBase ? { 'X-Entity-Ref-ID': `${type}:${dedupeBase}:${user.id}` } : {}),
        },
      });
      results.push({ userId, status: 'queued' });
    } catch (err) {
      // Never let a notification problem surface to the caller.
      console.error(`[Notify] ${type} for ${userId} failed: ${err.message}`);
      results.push({ userId, status: 'error' });
    }
  }
  return results;
}

/* ---- Helpers -------------------------------------------------------------- */
const acceptedMemberIds = (teamId) =>
  store.teamMembers.filter((m) => m.teamId === teamId && m.status === 'accepted').map((m) => m.userId);

const publicUser = (u) => ({ id: u?.id, fullName: u?.fullName || 'A participant', university: u?.university || '' });

function guard(name, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`[Notify] ${name} skipped: ${err.message}`);
    return [];
  }
}

/* ---- Event helpers (called by routes after a successful operation) -------- */

/** Leader created a team → the leader. */
export const notifyTeamCreated = (team) => guard('team_created', () => {
  const hackathon = store.getHackathonById(team.hackathonId);
  return notify({
    type: 'team_created',
    recipients: [team.leaderId],
    dedupeBase: team.id,
    data: () => ({ team, hackathon }),
    inApp: { message: ({ team: t }) => `Your team ${t.teamName} was created. Share its invite code from your dashboard.` },
  });
});

/** Participant requested to join → the requester (confirmation) + the team leader (action needed). */
export const notifyJoinRequested = (request) => guard('join_requested', () => {
  const team = store.findTeamById(request.teamId);
  const hackathon = store.getHackathonById(team.hackathonId);
  const requester = publicUser(store.findUserById(request.userId));
  const key = `${request.id}:${request.requestedAt}`;
  return [
    ...notify({
      type: 'join_request_submitted',
      recipients: [request.userId],
      dedupeBase: key,
      data: () => ({ team, hackathon }),
      inApp: { message: () => `Waiting for the leader of ${team.teamName} to review your request.` },
    }),
    ...notify({
      type: 'join_request_received',
      recipients: [team.leaderId],
      dedupeBase: key,
      data: () => ({ team, hackathon, requester }),
      inApp: { message: () => `${requester.fullName} asked to join ${team.teamName}.` },
    }),
  ];
});

/**
 * Leader approved/rejected a request → the requester; on approval, the other
 * accepted members (excluding the new member and the leader who acted).
 */
export const notifyJoinDecision = (request, actorId) => guard('join_decision', () => {
  const team = store.findTeamById(request.teamId);
  const hackathon = store.getHackathonById(team.hackathonId);
  const approved = request.status === 'accepted';
  // Keyed on the request (not reviewedAt) so a retried approval can't re-send.
  const key = `${request.id}:${request.requestedAt}`;
  const results = notify({
    type: approved ? 'join_request_approved' : 'join_request_rejected',
    recipients: [request.userId],
    dedupeBase: `${request.id}:${request.status}:${request.requestedAt}`,
    data: () => ({ team, hackathon }),
    inApp: { message: () => (approved ? `You joined ${team.teamName}.` : `Your request to join ${team.teamName} was declined.`) },
  });
  if (approved) {
    const member = publicUser(store.findUserById(request.userId));
    const others = acceptedMemberIds(team.id).filter((id) => id !== request.userId && id !== actorId);
    results.push(...notify({
      type: 'team_member_joined',
      recipients: others,
      dedupeBase: key,
      data: () => ({ team, hackathon, member }),
      inApp: { message: () => `${member.fullName} joined ${team.teamName}.` },
    }));
  }
  return results;
});

/**
 * Submission saved → every accepted team member. A first save is "received";
 * edits are "updated", throttled to one email per 10 minutes per submission so
 * repeated saves or retried requests don't flood inboxes.
 */
export const notifySubmissionSaved = (submission, { isNew }) => guard('submission', () => {
  const team = store.findTeamById(submission.teamId);
  const hackathon = store.getHackathonById(submission.hackathonId);
  const window = Math.floor(Date.now() / (10 * 60 * 1000));
  return notify({
    type: isNew ? 'submission_received' : 'submission_updated',
    recipients: acceptedMemberIds(team.id),
    dedupeBase: isNew ? submission.id : `${submission.id}:${window}`,
    data: () => ({ team, hackathon, submission }),
    inApp: { message: () => `“${submission.projectTitle}” ${isNew ? 'was submitted' : 'was updated'} for ${hackathon.title}.` },
  });
});

/** Admin assigned a judge to a submission → that judge. */
export const notifyJudgeAssigned = (assignment) => guard('judge_assigned', () => {
  const submission = store.getSubmissionById(assignment.submissionId);
  const hackathon = store.getHackathonById(assignment.hackathonId || submission?.hackathonId);
  if (!submission || !hackathon) return [];
  return notify({
    type: 'judge_assigned',
    recipients: [assignment.judgeId],
    dedupeBase: `${assignment.judgeId}:${submission.id}`,
    data: () => ({ hackathon, submission }),
    inApp: { message: () => `“${submission.projectTitle}” is ready for your evaluation.` },
  });
});

/**
 * Results published (certificates are issued in the same store operation) →
 * every accepted member of every team in the hackathon, with their own rank
 * and certificate. Only called after publishResults() succeeded.
 */
export const notifyResultsPublished = (hackathonId) => guard('results_published', () => {
  const hackathon = store.getHackathonById(hackathonId);
  if (!hackathon?.resultsPublished) return [];
  const leaderboard = store.calculateLeaderboard(hackathonId);
  const results = [];
  for (const team of store.getTeamsByHackathon(hackathonId)) {
    const rank = leaderboard.find((l) => l.teamId === team.id)?.rank || null;
    results.push(...notify({
      type: 'results_published',
      recipients: acceptedMemberIds(team.id),
      dedupeBase: hackathonId,
      data: (user) => ({
        hackathon,
        team,
        rank,
        certificate: store.certificates.find((c) => c.hackathonId === hackathonId && c.userId === user.id) || null,
      }),
      inApp: { message: () => `Final results for ${hackathon.title} are published.` },
    }));
  }
  return results;
});

/**
 * Announcement published → its audience:
 *  - scoped to a hackathon: accepted team members of that hackathon plus its
 *    bound judges/screeners, filtered by targetRole
 *  - platform-wide: every user with the targetRole ("all" = every user)
 * The outbox rate limit spreads large sends out.
 */
export const notifyAnnouncement = (announcement) => guard('announcement', () => {
  const hackathon = announcement.hackathonId ? store.getHackathonById(announcement.hackathonId) : null;
  const role = announcement.targetRole || 'all';
  const matchesRole = (u) => role === 'all' || u.role === role;

  let audience;
  if (hackathon) {
    const memberIds = store.teamMembers
      .filter((m) => m.hackathonId === hackathon.id && m.status === 'accepted')
      .map((m) => m.userId);
    const reviewerIds = store.getHackathonAssignedUsers(hackathon.id, null).map((u) => u.id);
    audience = [...memberIds, ...reviewerIds].map((id) => store.findUserById(id)).filter(Boolean);
  } else {
    audience = store.users;
  }
  const recipients = audience.filter(matchesRole).map((u) => u.id).filter((id) => id !== announcement.createdBy);

  return notify({
    type: 'announcement',
    recipients,
    dedupeBase: announcement.id,
    data: () => ({ announcement, hackathon }),
    inApp: { title: () => announcement.title, message: () => announcement.content.slice(0, 280) },
  });
});

/**
 * Judge/screener redeemed an access code → that user (access confirmed) and
 * the organizer who generated the code (committee update).
 */
export const notifyAccessCodeRedeemed = (result, userId, codeCreatorId) => guard('access_code', () => {
  const hackathon = store.getHackathonById(result.hackathonId);
  if (!hackathon) return [];
  const reviewer = publicUser(store.findUserById(userId));
  const key = `${result.hackathonId}:${result.role}:${userId}`;
  return [
    ...notify({
      type: 'access_granted',
      recipients: [userId],
      dedupeBase: key,
      data: () => ({ hackathon, role: result.role }),
      inApp: { message: () => `You now have ${result.role} access to ${hackathon.title}.` },
    }),
    ...notify({
      type: 'reviewer_joined',
      recipients: codeCreatorId && codeCreatorId !== userId ? [codeCreatorId] : [],
      dedupeBase: key,
      data: () => ({ hackathon, role: result.role, reviewer }),
      inApp: { message: () => `${reviewer.fullName} joined ${hackathon.title} as ${result.role}.` },
    }),
  ];
});
