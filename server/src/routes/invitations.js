import express from 'express';
import store, { toSafeUser } from '../database/store.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { rateLimit, registerLimiter } from '../middleware/rateLimit.js';
import { checkOrganizerAccess } from './hackathons.js';
import { deliverInvitation, notifyInvitationAccepted, notifyUserRegistered } from '../notifications/notifier.js';
import { getProvider } from '../notifications/providers.js';

/*
 * In-platform invitations, replacing codes shared outside HackTrack:
 *  - organizer → committee member (judge, screening, mentor) for one event;
 *  - team leader → participant for one team.
 * An existing account accepts or declines in the app. An address without an
 * account gets a single-use sign-up link (committee invitations only) that
 * works for that address alone.
 */

const router = express.Router();

const isStr = (v, max = 500) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const fail = (res, status, message) =>
  res.status(status).json({ status, error: { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict' }[status] || 'Error', message });

// Each inviter can send at most 30 invitations an hour; link lookups are limited per IP.
const inviteLimiter = rateLimit({ name: 'invite', windowMs: 60 * 60_000, max: 30, key: (req) => req.user?.id || req.ip, message: 'Too many invitations sent. Please wait a while before sending more.' });
const tokenLimiter = rateLimit({ name: 'invite-token', windowMs: 15 * 60_000, max: 30, message: 'Too many attempts. Please wait a few minutes.' });

/** Local development without an email provider: the inviter may need the link to test. */
const devLinkAllowed = () => process.env.NODE_ENV !== 'production' && ['console', 'memory', 'disabled'].includes(getProvider().name);

/** Who may manage (list, resend, revoke) an invitation. */
function canManage(user, inv) {
  if (!user || !inv) return false;
  if (user.role === 'admin') return true;
  if (inv.kind === 'committee') {
    const hackathon = store.getHackathonById(inv.hackathonId);
    return Boolean(hackathon && checkOrganizerAccess(user, hackathon));
  }
  const team = store.findTeamById(inv.teamId);
  return Boolean(team && team.leaderId === user.id);
}

const sendResult = (res, status, { invitation, token, recipient }, message) => {
  const delivery = deliverInvitation({ invitation, token, recipient });
  const body = { status, message, invitation: store.publicInvitation(invitation), delivery };
  if (token && devLinkAllowed()) body.devInviteUrl = `/invite/${encodeURIComponent(token)}`;
  return res.status(status).json(body);
};

// ── Organizer → committee ─────────────────────────────────────────────────────

// POST /api/v1/invitations/committee { hackathonId, email, role }
router.post('/committee', requireAuth, inviteLimiter, (req, res) => {
  const { hackathonId, email, role } = req.body || {};
  if (!isStr(hackathonId, 100) || !isStr(email, 254) || !isStr(role, 20)) return fail(res, 400, 'hackathonId, email and role are required.');
  const hackathon = store.getHackathonById(hackathonId);
  if (!hackathon) return fail(res, 404, 'Hackathon not found.');
  if (!(req.user.role === 'admin' || (req.user.role === 'organizer' && checkOrganizerAccess(req.user, hackathon)))) {
    return fail(res, 403, 'Only this hackathon’s organizers can invite its committee.');
  }
  try {
    const created = store.createInvitation({ kind: 'committee', hackathonId, role, email, invitedBy: req.user.id });
    return sendResult(res, 201, created, created.recipient
      ? `${created.invitation.email} was invited. They can accept from their dashboard.`
      : `${created.invitation.email} was invited to create an account.`);
  } catch (err) {
    return fail(res, 400, err.message);
  }
});

// GET /api/v1/invitations/committee?hackathonId=
router.get('/committee', requireAuth, (req, res) => {
  const hackathon = store.getHackathonById(String(req.query.hackathonId || ''));
  if (!hackathon) return fail(res, 404, 'Hackathon not found.');
  if (!(req.user.role === 'admin' || checkOrganizerAccess(req.user, hackathon))) return fail(res, 403, 'Only this hackathon’s organizers can see its invitations.');
  const invitations = store.listInvitations({ hackathonId: hackathon.id, kind: 'committee' }).map((i) => store.publicInvitation(i));
  return res.json({ status: 200, invitations });
});

// ── Leader → team member ──────────────────────────────────────────────────────

// POST /api/v1/invitations/team { teamId, email }
router.post('/team', requireAuth, inviteLimiter, (req, res) => {
  const { teamId, email } = req.body || {};
  if (!isStr(teamId, 100) || !isStr(email, 254)) return fail(res, 400, 'teamId and email are required.');
  const team = store.findTeamById(teamId);
  if (!team) return fail(res, 404, 'Team not found.');
  if (team.leaderId !== req.user.id) return fail(res, 403, 'Only the team leader can invite members.');
  try {
    const created = store.createInvitation({ kind: 'team', hackathonId: team.hackathonId, teamId: team.id, email, invitedBy: req.user.id });
    return sendResult(res, 201, created, `${created.invitation.email} was invited to ${team.teamName}.`);
  } catch (err) {
    return fail(res, 400, err.message);
  }
});

// GET /api/v1/invitations/team?teamId=
router.get('/team', requireAuth, (req, res) => {
  const team = store.findTeamById(String(req.query.teamId || ''));
  if (!team) return fail(res, 404, 'Team not found.');
  if (!(team.leaderId === req.user.id || req.user.role === 'admin')) return fail(res, 403, 'Only the team leader can see its invitations.');
  const invitations = store.listInvitations({ teamId: team.id, kind: 'team' }).map((i) => store.publicInvitation(i));
  return res.json({ status: 200, invitations });
});

// ── The invited account ───────────────────────────────────────────────────────

// GET /api/v1/invitations/mine: pending invitations for the signed-in account
router.get('/mine', requireAuth, (req, res) => {
  const invitations = store.pendingInvitationsFor(req.user.email).map((i) => store.publicInvitation(i));
  return res.json({ status: 200, invitations });
});

// POST /api/v1/invitations/:id/accept | /decline
for (const action of ['accept', 'decline']) {
  router.post(`/:id/${action}`, requireAuth, (req, res) => {
    try {
      const inv = store.respondToInvitation(req.params.id, req.user.id, action);
      if (action === 'accept') notifyInvitationAccepted(inv);
      return res.json({
        status: 200,
        message: action === 'accept'
          ? (inv.kind === 'team' ? 'You joined the team.' : 'You joined the committee.')
          : 'Invitation declined.',
        invitation: store.publicInvitation(inv),
        user: toSafeUser(store.findUserById(req.user.id)),
      });
    } catch (err) {
      if (err.message === 'Invitation not found.') return fail(res, 404, err.message);
      return res.status(409).json({ status: 409, error: 'Conflict', message: err.message, code: err.code || null });
    }
  });
}

// ── Inviter: resend / revoke ──────────────────────────────────────────────────

router.post('/:id/resend', requireAuth, inviteLimiter, (req, res) => {
  const inv = store.findInvitationById(req.params.id);
  if (!canManage(req.user, inv)) return fail(res, 404, 'Invitation not found.');
  try {
    const resent = store.resendInvitation(inv.id);
    return sendResult(res, 200, resent, `The invitation to ${inv.email} was sent again and now expires in 7 days.`);
  } catch (err) {
    return fail(res, 409, err.message);
  }
});

router.post('/:id/revoke', requireAuth, (req, res) => {
  const inv = store.findInvitationById(req.params.id);
  if (!canManage(req.user, inv)) return fail(res, 404, 'Invitation not found.');
  try {
    store.revokeInvitation(inv.id);
    return res.json({ status: 200, message: `The invitation to ${inv.email} was revoked.`, invitation: store.publicInvitation(inv) });
  } catch (err) {
    return fail(res, 409, err.message);
  }
});

// ── Sign-up link (no account yet) ─────────────────────────────────────────────

// GET /api/v1/invitations/token/:token: what the link is for (no secrets)
router.get('/token/:token', tokenLimiter, (req, res) => {
  const inv = store.findInvitationByToken(req.params.token);
  if (!inv) return fail(res, 404, 'This invitation link is not valid. It may have been used, revoked or replaced by a newer one.');
  return res.json({ status: 200, invitation: store.publicInvitation(inv) });
});

// POST /api/v1/invitations/token/:token/register { fullName, password, university?, designation? }
router.post('/token/:token/register', tokenLimiter, registerLimiter, (req, res) => {
  const inv = store.findInvitationByToken(req.params.token);
  if (!inv || inv.kind !== 'committee') return fail(res, 404, 'This invitation link is not valid. It may have been used, revoked or replaced by a newer one.');
  const status = store.invitationStatus(inv);
  if (status !== 'pending') return fail(res, 409, status === 'expired' ? 'This invitation has expired. Ask the organizer to resend it.' : `This invitation was already ${status}.`);
  if (store.findUserByEmail(inv.email)) return fail(res, 409, 'An account with this email already exists. Sign in to accept the invitation from your dashboard.');

  const { fullName, password, university, designation } = req.body || {};
  if (!isStr(fullName, 120) || !isStr(password, 200)) return fail(res, 400, 'Your name and a password are required.');
  if (password.length < 6) return fail(res, 400, 'Password must be at least 6 characters.');
  if (university !== undefined && university !== null && university !== '' && !isStr(university, 150)) return fail(res, 400, 'Organization is too long.');
  if (designation !== undefined && designation !== null && designation !== '' && !isStr(designation, 150)) return fail(res, 400, 'Expertise is too long.');

  try {
    const user = store.createUser({
      email: inv.email,
      password,
      fullName: fullName.trim(),
      role: inv.role,
      university: university ? String(university).trim() : 'University / Organization',
      roleCategory: designation ? String(designation).trim() : undefined,
    });
    store.completeInvitationSignup(inv, user);
    notifyUserRegistered(user);
    notifyInvitationAccepted(inv);
    const fresh = store.findUserById(user.id);
    return res.status(201).json({
      status: 201,
      message: 'Your account is ready and you joined the committee.',
      token: signToken(fresh),
      user: toSafeUser(fresh),
      redirectPath: { judge: '/dashboard/judge', screening: '/dashboard/screening', mentor: '/dashboard/mentor' }[inv.role],
    });
  } catch (err) {
    return fail(res, 400, err.message);
  }
});

export default router;
