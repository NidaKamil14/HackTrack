import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import store from '../src/database/store.js';
import { memoryProvider } from '../src/notifications/providers.js';
import { waitForEmailIdle } from '../src/notifications/emailQueue.js';

// In-platform invitations (organizer → committee, leader → member) and the
// limits on access codes that remain as an optional fallback.

process.env.EMAIL_PROVIDER = 'memory';

let server;
let baseUrl;
const api = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
};
const login = async (email, password = 'password123') => {
  const res = await api('/api/v1/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(res.status, 200, `login ${email}: ${res.text}`);
  return res.body.token;
};
const unique = () => Math.random().toString(36).slice(2, 8);
const tokenFrom = (url) => decodeURIComponent(url.split('/invite/')[1]);

test.before(async () => {
  memoryProvider.reset();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});
test.after(() => new Promise((resolve) => server.close(resolve)));

test('An invited new screener creates an account from the emailed link and lands on the committee', async () => {
  const organizer = await login('organizer@hacktrack.io');
  const email = `new.screener.${unique()}@example.org`;
  const sent = await api('/api/v1/invitations/committee', { method: 'POST', token: organizer, body: { hackathonId: 'hack-001', email, role: 'screening' } });
  assert.equal(sent.status, 201, sent.text);
  assert.equal(sent.body.invitation.status, 'pending');
  assert.equal(sent.body.invitation.hasAccount, false);
  assert.equal(sent.body.delivery.email, 'queued', 'delivery is reported as queued, never as "sent"');
  assert.ok(!('tokenHash' in sent.body.invitation), 'the token hash is never returned');

  // The email carries the sign-up link and no access code.
  await waitForEmailIdle();
  const mail = memoryProvider.sent.find((m) => m.to === email);
  assert.ok(mail, 'invitation email delivered to the provider');
  assert.match(mail.text, /\/invite\//);
  assert.doesNotMatch(mail.text, /SCREEN(ING)?-[A-Z0-9]+-[A-Z0-9]+/, 'no access code in the email');
  const token = tokenFrom(sent.body.devInviteUrl);
  assert.ok(mail.text.includes(encodeURIComponent(token)), 'the emailed link is the one issued');

  // The link describes the invitation, then creates the account (role and email fixed).
  const info = await api(`/api/v1/invitations/token/${encodeURIComponent(token)}`);
  assert.equal(info.status, 200);
  assert.equal(info.body.invitation.email, email);
  assert.equal(info.body.invitation.role, 'screening');
  const signup = await api(`/api/v1/invitations/token/${encodeURIComponent(token)}/register`, { method: 'POST', body: { fullName: 'New Screener', password: 'password123' } });
  assert.equal(signup.status, 201, signup.text);
  assert.equal(signup.body.user.role, 'screening');
  assert.equal(signup.body.user.email, email);
  const mine = await api('/api/v1/auth/my-hackathons', { token: signup.body.token });
  assert.ok(mine.body.hackathons.some((h) => h.id === 'hack-001'), 'bound to the event');

  // The link is single-use.
  const again = await api(`/api/v1/invitations/token/${encodeURIComponent(token)}/register`, { method: 'POST', body: { fullName: 'X', password: 'password123' } });
  assert.equal(again.status, 404);

  // The organizer sees it accepted, and the new screener on the committee.
  const list = await api('/api/v1/invitations/committee?hackathonId=hack-001', { token: organizer });
  assert.equal(list.body.invitations.find((i) => i.email === email).status, 'accepted');
  const codes = await api('/api/v1/hackathons/hack-001/codes', { token: organizer });
  assert.ok(codes.body.assignedScreeners.some((u) => u.email === email));
});

test('An existing judge accepts in the app; nobody else can accept it; wrong-role accounts are refused', async () => {
  const organizer = await login('organizer@hacktrack.io');
  // A judge account bound to another event.
  const email = `judge.${unique()}@example.org`;
  const reg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: { email, password: 'password123', fullName: 'Existing Judge', role: 'judge', university: 'IIT', designation: 'ML', accessCode: 'JUDGE-PCCO-8A4B' },
  });
  assert.equal(reg.status, 201, reg.text);
  const judge = reg.body.token;

  const sent = await api('/api/v1/invitations/committee', { method: 'POST', token: organizer, body: { hackathonId: 'hack-001', email, role: 'judge' } });
  assert.equal(sent.status, 201, sent.text);
  assert.equal(sent.body.invitation.hasAccount, true);
  assert.equal(sent.body.delivery.channel, 'in_app');
  assert.equal(sent.body.devInviteUrl, undefined, 'existing accounts get no sign-up link');

  // Another account can't see or accept it.
  const other = await login('judge@hacktrack.io');
  assert.equal((await api('/api/v1/invitations/mine', { token: other })).body.invitations.some((i) => i.id === sent.body.invitation.id), false);
  assert.equal((await api(`/api/v1/invitations/${sent.body.invitation.id}/accept`, { method: 'POST', token: other })).status, 404);

  // The invited judge sees it and accepts.
  const pending = await api('/api/v1/invitations/mine', { token: judge });
  assert.ok(pending.body.invitations.some((i) => i.id === sent.body.invitation.id && i.hackathonTitle === 'CodeSprint Global 2026'));
  const accept = await api(`/api/v1/invitations/${sent.body.invitation.id}/accept`, { method: 'POST', token: judge });
  assert.equal(accept.status, 200, accept.text);
  assert.ok(accept.body.user.assignedHackathonIds.includes('hack-001'));
  assert.equal((await api(`/api/v1/invitations/${sent.body.invitation.id}/accept`, { method: 'POST', token: judge })).status, 409, 'cannot accept twice');

  // Inviting an existing account to a different role is refused up front.
  const wrong = await api('/api/v1/invitations/committee', { method: 'POST', token: organizer, body: { hackathonId: 'hack-001', email: 'alex@university.edu', role: 'screening' } });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.message, /leader account/);
  // Already on the committee.
  const dup = await api('/api/v1/invitations/committee', { method: 'POST', token: organizer, body: { hackathonId: 'hack-001', email, role: 'judge' } });
  assert.equal(dup.status, 400);
});

test('Resending replaces the link, revoking stops it, and only the event organizer can manage invitations', async () => {
  const organizer = await login('organizer@hacktrack.io');
  const email = `mentor.${unique()}@example.org`;
  const sent = await api('/api/v1/invitations/committee', { method: 'POST', token: organizer, body: { hackathonId: 'hack-001', email, role: 'mentor' } });
  assert.equal(sent.status, 201, sent.text);
  const firstToken = tokenFrom(sent.body.devInviteUrl);

  const otherOrganizer = await login('marcus.ai@hacktrack.io');
  assert.equal((await api('/api/v1/invitations/committee', { method: 'POST', token: otherOrganizer, body: { hackathonId: 'hack-001', email: `x.${unique()}@example.org`, role: 'judge' } })).status, 403);
  assert.equal((await api('/api/v1/invitations/committee?hackathonId=hack-001', { token: otherOrganizer })).status, 403);
  assert.equal((await api(`/api/v1/invitations/${sent.body.invitation.id}/revoke`, { method: 'POST', token: otherOrganizer })).status, 404);

  const resent = await api(`/api/v1/invitations/${sent.body.invitation.id}/resend`, { method: 'POST', token: organizer });
  assert.equal(resent.status, 200, resent.text);
  const secondToken = tokenFrom(resent.body.devInviteUrl);
  assert.notEqual(secondToken, firstToken);
  assert.equal((await api(`/api/v1/invitations/token/${encodeURIComponent(firstToken)}`)).status, 404, 'the old link stops working');
  assert.equal((await api(`/api/v1/invitations/token/${encodeURIComponent(secondToken)}`)).status, 200);

  const revoked = await api(`/api/v1/invitations/${sent.body.invitation.id}/revoke`, { method: 'POST', token: organizer });
  assert.equal(revoked.status, 200);
  assert.equal((await api(`/api/v1/invitations/token/${encodeURIComponent(secondToken)}`)).status, 404, 'a revoked link stops working');

  // Expired invitations can't be used.
  const late = await api('/api/v1/invitations/committee', { method: 'POST', token: organizer, body: { hackathonId: 'hack-001', email: `late.${unique()}@example.org`, role: 'judge' } });
  store.findInvitationById(late.body.invitation.id).expiresAt = new Date(Date.now() - 1000).toISOString();
  const lateSignup = await api(`/api/v1/invitations/token/${encodeURIComponent(tokenFrom(late.body.devInviteUrl))}/register`, { method: 'POST', body: { fullName: 'Late', password: 'password123' } });
  assert.equal(lateSignup.status, 409);
  assert.match(lateSignup.body.message, /expired/);

  // Mentor invitations need mentorship on the event (InnovateX has it off).
  const innovatex = await api('/api/v1/invitations/committee', { method: 'POST', token: organizer, body: { hackathonId: 'hack-002', email: `m.${unique()}@example.org`, role: 'mentor' } });
  assert.equal(innovatex.status, 400);
});

test('A leader invites a registered participant, who joins the team by accepting', async () => {
  const leader = await login('alex@university.edu');
  const teams = await api('/api/v1/teams/mine', { token: leader });
  const team = teams.body.teams.find((t) => t.id === 'team-001');

  // A new participant without a registration for the event.
  const email = `member.${unique()}@example.org`;
  const reg = await api('/api/v1/auth/register', { method: 'POST', body: { email, password: 'password123', fullName: 'New Member', role: 'student', university: 'MIT', memberId: 'M-1' } });
  assert.equal(reg.status, 201, reg.text);
  const member = reg.body.token;

  // Unknown addresses and non-leaders are refused.
  const unknown = await api('/api/v1/invitations/team', { method: 'POST', token: leader, body: { teamId: team.id, email: `nobody.${unique()}@example.org` } });
  assert.equal(unknown.status, 400);
  assert.match(unknown.body.message, /participant account/);
  const priya = await login('priya@university.edu');
  assert.equal((await api('/api/v1/invitations/team', { method: 'POST', token: priya, body: { teamId: team.id, email } })).status, 403);

  const sent = await api('/api/v1/invitations/team', { method: 'POST', token: leader, body: { teamId: team.id, email } });
  assert.equal(sent.status, 201, sent.text);
  assert.equal(sent.body.invitation.teamName, 'CyberPulse Vanguard');

  // Accepting needs an event registration first.
  const early = await api(`/api/v1/invitations/${sent.body.invitation.id}/accept`, { method: 'POST', token: member });
  assert.equal(early.status, 409);
  assert.equal(early.body.code, 'REGISTER_FIRST');

  const register = await api('/api/v1/hackathons/hack-001/register', { method: 'POST', token: member, body: { details: { phone: '9876543210', institution: 'MIT', course: 'BTech', yearOfStudy: '2', acceptTerms: true } } });
  assert.equal(register.status, 201, register.text);
  const accept = await api(`/api/v1/invitations/${sent.body.invitation.id}/accept`, { method: 'POST', token: member });
  assert.equal(accept.status, 200, accept.text);
  const mine = await api('/api/v1/teams/mine', { token: member });
  assert.ok(mine.body.teams.some((t) => t.id === team.id), 'joined directly, no join request to approve');

  const list = await api(`/api/v1/invitations/team?teamId=${team.id}`, { token: leader });
  assert.equal(list.body.invitations.find((i) => i.email === email).status, 'accepted');
});

test('Access codes can expire, run out of uses, or be turned off', async () => {
  const organizer = await login('organizer@hacktrack.io');
  const signup = (code) => api('/api/v1/auth/register', {
    method: 'POST',
    body: { email: `s.${unique()}@example.org`, password: 'password123', fullName: 'Screener', role: 'screening', university: 'PCCOE', department: 'Screening', accessCode: code },
  });

  // One use only.
  const limited = await api('/api/v1/hackathons/hack-001/codes', { method: 'POST', token: organizer, body: { role: 'screening', maxUses: 1 } });
  assert.equal(limited.status, 201, limited.text);
  assert.equal(limited.body.codeRecord.maxUses, 1);
  assert.equal((await signup(limited.body.codeRecord.code)).status, 201);
  assert.equal((await signup(limited.body.codeRecord.code)).status, 400, 'second account is refused');

  // Expired.
  const expiring = await api('/api/v1/hackathons/hack-001/codes', { method: 'POST', token: organizer, body: { role: 'screening', expiresInHours: 24 } });
  assert.ok(expiring.body.codeRecord.expiresAt);
  store.hackathonCodes.find((c) => c.code === expiring.body.codeRecord.code).expiresAt = new Date(Date.now() - 1000).toISOString();
  assert.equal((await signup(expiring.body.codeRecord.code)).status, 400);

  // Bad limits are rejected.
  assert.equal((await api('/api/v1/hackathons/hack-001/codes', { method: 'POST', token: organizer, body: { role: 'screening', maxUses: 0 } })).status, 400);

  // Turned off.
  const fresh = await api('/api/v1/hackathons/hack-001/codes', { method: 'POST', token: organizer, body: { role: 'screening' } });
  const off = await api('/api/v1/hackathons/hack-001/codes/screening', { method: 'DELETE', token: organizer });
  assert.equal(off.status, 200);
  assert.equal((await signup(fresh.body.codeRecord.code)).status, 400);
  const codes = await api('/api/v1/hackathons/hack-001/codes', { token: organizer });
  assert.equal(codes.body.codes.some((c) => c.role === 'screening'), false);
  // Restore a code so other suites keep a working screening code.
  await api('/api/v1/hackathons/hack-001/codes', { method: 'POST', token: organizer, body: { role: 'screening' } });
});
