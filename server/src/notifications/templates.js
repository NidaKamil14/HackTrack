/*
 * HackTrack transactional email templates.
 * Each template returns { subject, heading, intro, body[], cta, reason } and
 * `renderEmail` wraps it in a responsive, table-based HTML layout with inline
 * styles (what email clients reliably support) plus a plain-text alternative.
 * All dynamic values are HTML-escaped. Templates never include passwords,
 * tokens, team invite codes or access codes.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const truncate = (text, max) => {
  const s = String(text ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

const CERT_LABELS = { winner: 'Winner', runner_up: 'Runner-up', participation: 'Participation' };

/* ---- Event templates ------------------------------------------------------
   Every template receives { recipient, ...data } and must return plain strings
   (escaping happens in renderEmail). `cta.path` is relative to FRONTEND_URL. */
export const TEMPLATES = {
  user_registered: ({ user }) => ({
    subject: 'Welcome to HackTrack — Account Confirmed',
    heading: 'Welcome to HackTrack',
    intro: `Welcome, ${user.fullName || 'Participant'}! Your HackTrack account is confirmed.`,
    body: [
      `Your account has been registered with role: ${user.roleCategory || user.role}.`,
      'You can now browse active hackathons, create or join competition teams, and collaborate on project submissions.',
    ],
    cta: { label: 'Go to your dashboard', path: `/dashboard/${user.role === 'leader' ? 'leader' : user.role === 'student' ? 'student' : user.role}` },
  }),

  password_reset: ({ user, resetUrl, token }) => ({
    subject: 'Reset your HackTrack password',
    heading: 'Password Reset Request',
    intro: `Hello, ${user.fullName || 'there'}. We received a request to reset your HackTrack account password.`,
    body: [
      'Click the button below to choose a new password for your account.',
      'For security reasons, this password reset link is valid for 1 hour only.',
      'If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.',
    ],
    cta: { label: 'Reset Password', path: resetUrl || `/reset-password?token=${encodeURIComponent(token || '')}` },
  }),

  certificate_issued: ({ certificate, hackathon }) => ({
    subject: `Your Certificate for ${hackathon?.title || certificate.hackathonTitle || 'HackTrack'} is ready`,
    heading: 'Certificate Available',
    intro: `Congratulations, ${certificate.participantName}! Your certificate has been issued.`,
    body: [
      `Your ${CERT_LABELS[certificate.certificateType] || 'Participation'} Certificate for ${certificate.hackathonTitle || hackathon?.title} is now ready for download and verification.`,
    ],
    cta: { label: 'View Certificate', path: '/dashboard/student?tab=results' },
  }),

  team_created: ({ team, hackathon }) => ({
    subject: `Your team “${team.teamName}” is ready`,
    heading: 'Your team is ready',
    intro: `You created ${team.teamName} for ${hackathon.title}.`,
    body: [
      'Share your team’s invite code from your dashboard so teammates can request to join. You approve every request before anyone is added.',
    ],
    cta: { label: 'Open team roster', path: '/dashboard/leader?tab=roster' },
  }),

  join_request_submitted: ({ team, hackathon }) => ({
    subject: `Request sent to join “${team.teamName}”`,
    heading: 'Your join request was sent',
    intro: `You asked to join ${team.teamName} in ${hackathon.title}.`,
    body: ['The team leader will review your request. We’ll email you as soon as they approve or decline it.'],
    cta: { label: 'View your dashboard', path: '/dashboard/student?tab=roster' },
  }),

  join_request_received: ({ team, hackathon, requester }) => ({
    subject: `${requester.fullName} wants to join “${team.teamName}”`,
    heading: 'New join request',
    intro: `${requester.fullName}${requester.university ? ` (${requester.university})` : ''} asked to join ${team.teamName} in ${hackathon.title}.`,
    body: ['Review the request to approve or decline it. Only you, as team leader, can make this decision.'],
    cta: { label: 'Review request', path: '/dashboard/leader?tab=roster' },
  }),

  join_request_approved: ({ team, hackathon }) => ({
    subject: `You’re on the team: “${team.teamName}”`,
    heading: 'Your request was approved',
    intro: `You’re now a member of ${team.teamName} for ${hackathon.title}.`,
    body: ['Check the roster and coordinate with your team leader on the project submission.'],
    cta: { label: 'Open your team', path: '/dashboard/student?tab=roster' },
  }),

  join_request_rejected: ({ team, hackathon }) => ({
    subject: `Update on your request to join “${team.teamName}”`,
    heading: 'Your join request was declined',
    intro: `The leader of ${team.teamName} declined your request for ${hackathon.title}.`,
    body: ['You can still join another team with its invite code, or ask a team leader for a code.'],
    cta: { label: 'Browse hackathons', path: '/hackathons' },
  }),

  team_member_joined: ({ team, hackathon, member }) => ({
    subject: `${member.fullName} joined “${team.teamName}”`,
    heading: 'A new member joined your team',
    intro: `${member.fullName} is now part of ${team.teamName} for ${hackathon.title}.`,
    body: ['Say hello and make sure everyone knows the plan for your submission.'],
    cta: { label: 'View roster', path: '/dashboard/student?tab=roster' },
  }),

  submission_received: ({ team, hackathon, submission }) => ({
    subject: `Submission received: “${submission.projectTitle}”`,
    heading: 'Your project was submitted',
    intro: `${team.teamName}’s project “${submission.projectTitle}” was received for ${hackathon.title}.`,
    body: ['Your team leader can keep editing it until the submission deadline. After that it is locked for screening and judging.'],
    cta: { label: 'View submission', path: '/dashboard/student?tab=workspace' },
  }),

  submission_updated: ({ team, hackathon, submission }) => ({
    subject: `Submission updated: “${submission.projectTitle}”`,
    heading: 'Your project submission changed',
    intro: `${team.teamName}’s submission for ${hackathon.title} was updated by your team leader.`,
    body: ['Review the latest version so everyone agrees on what will be judged.'],
    cta: { label: 'Review submission', path: '/dashboard/student?tab=workspace' },
  }),

  judge_assigned: ({ hackathon, submission }) => ({
    subject: `New submission to judge: “${submission.projectTitle}”`,
    heading: 'You have a new submission to evaluate',
    intro: `“${submission.projectTitle}” in ${hackathon.title} was assigned to you for judging.`,
    body: ['Score it against the hackathon’s rubric from your judging workspace. Scores stay confidential until results are published.'],
    cta: { label: 'Open judging workspace', path: '/dashboard/judge' },
  }),

  results_published: ({ hackathon, team, rank, certificate }) => ({
    subject: `Results are out for ${hackathon.title}`,
    heading: 'Final results are published',
    intro: `The final results for ${hackathon.title} are now available.`,
    body: [
      rank ? `${team.teamName} finished in position ${rank}.` : `See how ${team.teamName} did on the leaderboard.`,
      ...(certificate
        ? [`Your ${CERT_LABELS[certificate.certificateType] || 'participation'} certificate has been issued and is ready to view.`]
        : []),
    ],
    cta: { label: certificate ? 'View results & certificate' : 'View results', path: '/dashboard/student?tab=results' },
  }),

  announcement: ({ announcement, hackathon }) => ({
    subject: `${hackathon ? `${hackathon.title}: ` : 'HackTrack: '}${announcement.title}`,
    heading: announcement.title,
    intro: hackathon ? `An update for ${hackathon.title}:` : 'An update from the HackTrack team:',
    body: [truncate(announcement.content, 1200)],
    cta: hackathon
      ? { label: 'View hackathon', path: `/hackathons/${encodeURIComponent(hackathon.id)}` }
      : { label: 'Open HackTrack', path: '/' },
  }),

  access_granted: ({ hackathon, role }) => ({
    subject: `You now have ${role} access to ${hackathon.title}`,
    heading: `You’re on the ${role === 'judge' ? 'judging panel' : 'screening committee'}`,
    intro: `Your access code was verified for ${hackathon.title}.`,
    body: [role === 'judge'
      ? 'Shortlisted submissions for this hackathon will appear in your judging workspace.'
      : 'Finalized submissions for this hackathon will appear in your screening queue.'],
    cta: { label: 'Open your workspace', path: role === 'judge' ? '/dashboard/judge' : '/dashboard/screening' },
  }),

  reviewer_joined: ({ hackathon, role, reviewer }) => ({
    subject: `${reviewer.fullName} joined ${hackathon.title} as ${role === 'judge' ? 'a judge' : 'a screener'}`,
    heading: 'Your committee grew',
    intro: `${reviewer.fullName} redeemed your ${role} access code for ${hackathon.title}.`,
    body: ['You can review everyone bound to this hackathon from Codes & committee.'],
    cta: { label: 'Open organizer workspace', path: '/dashboard/organizer' },
  }),
};

/* ---- Layout ---------------------------------------------------------------- */
const C = {
  brand: '#6A55F5', brandDeep: '#4F46E5', ink: '#0E1022', muted: '#484E68', subtle: '#646A84',
  line: '#E2E4F0', canvas: '#F6F7FC', surface: '#FFFFFF',
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderEmail(type, data, { frontendUrl, unsubscribeUrl, categoryLabel }) {
  const template = TEMPLATES[type];
  if (!template) throw new Error(`Unknown email template "${type}"`);
  const t = template(data);
  const greeting = `Hi ${firstName(data.recipient?.fullName)},`;
  const ctaUrl = `${frontendUrl}${t.cta.path}`;
  const reason = `You’re receiving this because you have a HackTrack account and ${categoryLabel.toLowerCase()} emails are turned on.`;

  const paragraphs = [t.intro, ...t.body]
    .map((p) => `<p style="margin:0 0 14px;font:15px/1.6 ${FONT};color:${C.muted};">${escapeHtml(p)}</p>`)
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(t.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(t.intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.surface};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
      <tr><td style="background:${C.brand};background-image:linear-gradient(120deg,${C.brand},${C.brandDeep});padding:20px 28px;">
        <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background:rgba(255,255,255,0.18);color:#fff;font:bold 14px ${FONT};vertical-align:middle;">&gt;_</span>
        <span style="margin-left:10px;font:600 17px ${FONT};color:#ffffff;vertical-align:middle;">HackTrack</span>
      </td></tr>
      <tr><td style="padding:32px 28px 8px;">
        <p style="margin:0 0 6px;font:13px ${FONT};color:${C.subtle};">${escapeHtml(greeting)}</p>
        <h1 style="margin:0 0 18px;font:600 22px/1.3 ${FONT};color:${C.ink};">${escapeHtml(t.heading)}</h1>
        ${paragraphs}
      </td></tr>
      <tr><td style="padding:8px 28px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="border-radius:10px;background:${C.brand};">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 22px;font:600 15px ${FONT};color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(t.cta.label)} &rarr;</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:18px 28px 24px;border-top:1px solid ${C.line};">
        <p style="margin:0 0 6px;font:12px/1.6 ${FONT};color:${C.subtle};">${escapeHtml(reason)}</p>
        <p style="margin:0;font:12px/1.6 ${FONT};color:${C.subtle};">
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:${C.subtle};">Unsubscribe from ${escapeHtml(categoryLabel.toLowerCase())} emails</a>
          &nbsp;·&nbsp;
          <a href="${escapeHtml(`${frontendUrl}/login`)}" style="color:${C.subtle};">Manage email preferences</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    greeting,
    '',
    t.heading,
    '',
    t.intro,
    ...t.body.flatMap((b) => ['', b]),
    '',
    `${t.cta.label}: ${ctaUrl}`,
    '',
    '—',
    reason,
    `Unsubscribe from ${categoryLabel.toLowerCase()} emails: ${unsubscribeUrl}`,
  ].join('\n');

  return { subject: t.subject, html, text, ctaUrl };
}
