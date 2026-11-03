import store from '../database/store.js';
import { checkOrganizerAccess } from '../routes/hackathons.js';

/*
 * Shared read-access rules, so every route answers "who may see this" the
 * same way. Writes keep their own, stricter checks in the route handlers.
 */

export const isAdmin = (user) => user?.role === 'admin';

export function ownsHackathon(user, hackathonId) {
  const hackathon = store.getAllHackathons().find((h) => h.id === hackathonId);
  return Boolean(hackathon && checkOrganizerAccess(user, hackathon));
}

/** Judge / screening / mentor bound to the hackathon by redeeming its access code. */
export function isBoundReviewer(user, hackathonId, roles = ['judge', 'screening', 'mentor']) {
  return Boolean(user && roles.includes(user.role) && Array.isArray(user.assignedHackathonIds) && user.assignedHackathonIds.includes(hackathonId));
}

export function isTeamMember(user, team) {
  if (!user || !team) return false;
  if (team.leaderId === user.id) return true;
  return store.teamMembers.some((m) => m.teamId === team.id && m.userId === user.id && m.status === 'accepted');
}

/** Full team details (join code, member emails, pending requests). */
export function canSeeTeamPrivate(user, team) {
  return isAdmin(user) || ownsHackathon(user, team.hackathonId) || isTeamMember(user, team);
}

export function canSeeSubmission(user, submission) {
  if (!user || !submission) return false;
  if (isAdmin(user) || ownsHackathon(user, submission.hackathonId)) return true;
  const team = store.findTeamById(submission.teamId);
  if (isTeamMember(user, team)) return true;
  if (isBoundReviewer(user, submission.hackathonId, ['screening', 'mentor'])) return true;
  if (user.role === 'judge') {
    return isBoundReviewer(user, submission.hackathonId, ['judge']) || store.judgeAssignments.some((a) => a.judgeId === user.id && a.submissionId === submission.id);
  }
  return false;
}

/** Team view without secrets, for reviewers and participants. */
export function publicTeam(team) {
  const members = store.getTeamMembers(team.id).filter((m) => m.status === 'accepted');
  const leader = store.findUserById(team.leaderId);
  const hackathon = store.getHackathonById(team.hackathonId);
  return {
    id: team.id,
    hackathonId: team.hackathonId,
    hackathonTitle: hackathon?.title || team.hackathonId,
    teamName: team.teamName,
    name: team.teamName,
    track: team.track,
    rosterLocked: Boolean(team.rosterLocked),
    screeningStatus: team.screeningStatus,
    leaderName: leader?.fullName || 'Lead Member',
    lead: leader?.fullName || 'Lead Member',
    memberCount: members.length,
    members: members.map((m) => ({ id: m.id, userId: m.userId, name: m.name, userName: m.userName, role: m.role, status: m.status })),
    createdAt: team.createdAt,
  };
}
