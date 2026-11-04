import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import store from '../src/database/store.js';
import { memoryProvider } from '../src/notifications/providers.js';
import { waitForEmailIdle } from '../src/notifications/emailQueue.js';

// Regression tests for the access-control, validation and data-exposure
// issues found in the November 2026 backend audit. Each test reproduces the
// original exploit request and asserts it is now refused.

process.env.EMAIL_PROVIDER = 'memory';

let server;
let baseUrl;

const api = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
};

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const login = async (email) => (await api('/api/v1/auth/login', { method: 'POST', body: { email, password: 'password123' } })).body.token;
// Role-specific profile fields required at sign-up (students/leaders: college
// + member id; organizers: organization, department and an invite key).
const PROFILE = {
  student: { university: 'PCCOE', memberId: 'STU-SEC' },
  leader: { university: 'PCCOE', memberId: 'LEAD-SEC' },
  organizer: { university: 'PCCOE', department: 'Events Cell', accessCode: 'ORG-INVITE-2026' },
};
async function signup(role = 'student') {
  const email = `sec_${role}_${unique()}@pccoe.edu.in`;
  const res = await api('/api/v1/auth/register', { method: 'POST', body: { email, password: 'password123', fullName: `Sec ${role}`, role, ...PROFILE[role] } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.token, id: res.body.user.id, email };
}

let orgA; // organizer@hacktrack.io — owns hack-001, hack-002
let orgB; // marcus.ai@hacktrack.io — owns hack-shesolves-001
let judge; // bound to hack-001
let screening; // bound to hack-001
let leader; // alex — leader of team-001 (hack-001)
let admin;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  [orgA, orgB, judge, screening, leader, admin] = await Promise.all([
    login('organizer@hacktrack.io'),
    login('marcus.ai@hacktrack.io'),
    login('judge@hacktrack.io'),
    login('screening@hacktrack.io'),
    login('alex@university.edu'),
    login('admin@hacktrack.io'),
  ]);
});

test.after(() => new Promise((resolve) => server.close(resolve)));

const noCredentials = (obj) => {
  const s = JSON.stringify(obj);
  assert.ok(!/passwordHash|"password"|password_hash|\$2[aby]\$/.test(s), `credential leaked: ${s.slice(0, 200)}`);
};

test('Self-registration cannot grant privileged roles', async () => {
  const attempt = (role, extra = {}) =>
    api('/api/v1/auth/register', {
      method: 'POST',
      body: { email: `x_${role}_${unique()}@pccoe.edu.in`, password: 'password123', fullName: 'X', role, university: 'Org', department: 'Dept', designation: 'Prof', ...extra },
    });
  // No code, or an unknown role.
  for (const role of ['admin', 'judge', 'screening', 'mentor', 'organizer', 'superuser']) {
    const res = await attempt(role);
    assert.ok([400, 403].includes(res.status), `${role}: ${res.status}`);
  }
  // Admin is never self-service, even with a code.
  assert.equal((await attempt('admin', { accessCode: 'ORG-INVITE-2026' })).status, 403);
  // Made-up codes that only *look* right are rejected (the old prefix check let these in).
  assert.equal((await attempt('judge', { accessCode: 'JUDGE-ANYTHING-123' })).status, 400);
  assert.equal((await attempt('screening', { accessCode: 'SCREEN-whatever' })).status, 400);
  assert.equal((await attempt('organizer', { accessCode: 'ORG-made-up' })).status, 400);
  assert.equal((await attempt('mentor', { accessCode: 'MENTOR-nope' })).status, 400);
  // A real organizer-issued judge code works and binds the judge to that event.
  const real = store.getCodesForHackathon('hack-001').find((c) => c.role === 'judge');
  const ok = await attempt('judge', { accessCode: real.code });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.user.role, 'judge');
  assert.ok(store.findUserById(ok.body.user.id).assignedHackathonIds.includes('hack-001'));
  for (const role of ['student', 'leader', 'organizer']) {
    await signup(role);
  }
  const bad = await api('/api/v1/auth/register', { method: 'POST', body: { email: 'not-an-email', password: 'password123', fullName: 'X' } });
  assert.equal(bad.status, 400);
});

test('Password reset token is never returned by the API', async () => {
  const res = await api('/api/v1/auth/forgot-password', { method: 'POST', body: { email: 'admin@hacktrack.io' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.resetTokenPreview, undefined);
  assert.ok(!/[a-f0-9]{48}/.test(res.text));
  await waitForEmailIdle(3000);
  // The in-app notification must not carry the token either.
  const notes = store.getUserNotifications('usr-admin-006').filter((n) => n.type === 'password_reset');
  assert.ok(notes.length >= 1);
  assert.ok(notes.every((n) => !/token=/.test(n.link || '') && !/[a-f0-9]{48}/.test(JSON.stringify(n))));
});

test('Only the newest password reset link works', () => {
  const first = store.createPasswordResetToken('priya@university.edu');
  const second = store.createPasswordResetToken('priya@university.edu');
  assert.throws(() => store.resetPasswordWithToken(first.token, 'whatever123'), /Invalid or expired/);
  assert.equal(store.resetPasswordWithToken(second.token, 'password123'), true);
});

test('No endpoint returns passwords or password hashes', async () => {
  noCredentials((await api('/api/v1/auth/demo-users')).body);
  noCredentials((await api('/api/v1/auth/login', { method: 'POST', body: { email: 'judge@hacktrack.io', password: 'password123' } })).body);
  noCredentials((await api('/api/v1/auth/me', { token: judge })).body);
  noCredentials((await api('/api/v1/hackathons/hack-001/codes', { token: orgA })).body);
  noCredentials((await api('/api/v1/admin/users', { token: admin })).body);
  const fresh = await signup('student');
  noCredentials(fresh);
  const redeem = await api('/api/v1/auth/redeem-code', { method: 'POST', token: judge, body: { code: 'JUDGE-CODE-7X9K' } });
  noCredentials(redeem.body);
});

test('Login and register reject non-string input without a 500', async () => {
  assert.equal((await api('/api/v1/auth/login', { method: 'POST', body: { email: 123, password: 'x' } })).status, 400);
  assert.equal((await api('/api/v1/auth/login', { method: 'POST', body: { email: 'judge@hacktrack.io', password: 123456 } })).status, 400);
  assert.equal((await api('/api/v1/auth/register', { method: 'POST', body: { email: 'a@b.co', password: 1234567, fullName: 'A' } })).status, 400);
});

test('Hackathon update ignores ownership, status and results fields (mass assignment)', async () => {
  const res = await api('/api/v1/hackathons/hack-002', {
    method: 'PUT',
    token: orgA,
    body: { resultsPublished: true, status: 'whatever', createdBy: 'usr-organizer-008', assignedOrganizers: ['usr-student-002'], tagLine: 'Updated tag line' },
  });
  assert.equal(res.status, 200);
  const h = store.getHackathonById('hack-002');
  assert.equal(h.createdBy, 'usr-organizer-007');
  assert.ok(!(h.assignedOrganizers || []).includes('usr-student-002'));
  assert.notEqual(h.status, 'whatever');
  assert.equal(h.tagLine, 'Updated tag line');
  assert.equal((await api('/api/v1/hackathons/hack-002', { method: 'PUT', token: orgA, body: { maxTeamSize: -5 } })).status, 400);
  assert.equal((await api('/api/v1/hackathons/hack-002', { method: 'PUT', token: orgA, body: { title: 12345 } })).status, 400);
  assert.equal((await api('/api/v1/hackathons/does-not-exist')).status, 404, 'lookups keep working');
});

test('Hackathon create validates input and cannot take over an existing id', async () => {
  const base = { title: 'Takeover', registrationDeadline: new Date(Date.now() + 86400000).toISOString(), submissionDeadline: new Date(Date.now() + 2 * 86400000).toISOString() };
  assert.equal((await api('/api/v1/hackathons', { method: 'POST', token: orgB, body: { ...base, id: 'hack-001' } })).status, 409);
  assert.equal((await api('/api/v1/hackathons', { method: 'POST', token: orgB, body: { ...base, registrationDeadline: 'garbage' } })).status, 400);
  assert.equal((await api('/api/v1/hackathons', { method: 'POST', token: orgB, body: { ...base, minTeamSize: 9, maxTeamSize: 2 } })).status, 400);
  assert.equal((await api('/api/v1/hackathons', { method: 'POST', token: orgB, body: { ...base, status: 'completed' } })).status, 400);
  assert.equal(store.getHackathonById('hack-001').createdBy, 'usr-organizer-007');
});

test('Draft hackathons are not public', async () => {
  const created = await api('/api/v1/hackathons', {
    method: 'POST',
    token: orgA,
    body: { title: `Draft ${unique()}`, status: 'draft', registrationDeadline: new Date(Date.now() + 86400000).toISOString(), submissionDeadline: new Date(Date.now() + 2 * 86400000).toISOString() },
  });
  assert.equal(created.status, 201);
  const id = created.body.hackathon.id;
  const student = await signup('student');

  const anonList = await api('/api/v1/hackathons');
  assert.ok(!anonList.body.hackathons.some((h) => h.id === id));
  assert.ok(!(await api('/api/v1/hackathons?status=draft', { token: student.token })).body.hackathons.some((h) => h.id === id));
  assert.equal((await api(`/api/v1/hackathons/${id}`)).status, 404);
  assert.equal((await api(`/api/v1/hackathons/${id}`, { token: orgB })).status, 404);
  assert.equal((await api(`/api/v1/hackathons/${id}/register`, { method: 'POST', token: student.token })).status, 404);

  assert.equal((await api(`/api/v1/hackathons/${id}`, { token: orgA })).status, 200, 'owner sees the draft');
  assert.ok((await api('/api/v1/hackathons', { token: orgA })).body.hackathons.some((h) => h.id === id));
  assert.ok((await api('/api/v1/hackathons', { token: admin })).body.hackathons.some((h) => h.id === id), 'admin sees drafts');

  const publicScope = await api('/api/v1/hackathons?scope=public', { token: orgB });
  assert.ok(!publicScope.body.hackathons.some((h) => h.id === id), 'public scope hides drafts');
  assert.ok(publicScope.body.hackathons.some((h) => h.id === 'hack-001'), 'public scope lists other organizers’ published events');

  assert.equal((await api(`/api/v1/hackathons/${id}/publish`, { method: 'POST', token: orgA })).status, 200);
  assert.ok((await api('/api/v1/hackathons')).body.hackathons.some((h) => h.id === id), 'published → public');
});

test('Teams: no anonymous access; join codes and emails only for members, owners and admins', async () => {
  assert.equal((await api('/api/v1/teams?hackathonId=hack-001')).status, 401);
  assert.equal((await api('/api/v1/teams/team-001')).status, 401);

  const outsider = await signup('student');
  const listed = await api('/api/v1/teams?hackathonId=hack-001', { token: outsider.token });
  assert.equal(listed.status, 200);
  const t = listed.body.teams.find((x) => x.id === 'team-001');
  assert.ok(t);
  assert.equal(t.teamCode, undefined);
  assert.equal(t.code, undefined);
  assert.ok(!JSON.stringify(listed.body).includes('@'), 'no email addresses for outsiders');
  const detail = await api('/api/v1/teams/team-coders-001', { token: outsider.token });
  assert.equal(detail.body.team.teamCode, undefined);

  const asLeader = await api('/api/v1/teams/team-001', { token: leader });
  assert.equal(asLeader.body.team.teamCode, 'HT-CPV881');
  const asOwner = await api('/api/v1/teams?hackathonId=hack-001', { token: orgA });
  assert.ok(asOwner.body.teams.find((x) => x.id === 'team-001').teamCode);
});

test('Submissions: no anonymous access; participants only see their own team', async () => {
  assert.equal((await api('/api/v1/submissions?hackathonId=hack-shesolves-001')).status, 401);
  assert.equal((await api('/api/v1/submissions/sub-001')).status, 401);
  assert.equal((await api('/api/v1/submissions/team/team-001')).status, 401);

  const outsider = await signup('student');
  assert.equal((await api('/api/v1/submissions/sub-001', { token: outsider.token })).status, 404);
  assert.equal((await api('/api/v1/submissions?hackathonId=hack-001', { token: outsider.token })).body.submissions.length, 0);

  assert.equal((await api('/api/v1/submissions/sub-001', { token: leader })).status, 200);
  assert.equal((await api('/api/v1/submissions/sub-001', { token: orgA })).status, 200);
  assert.equal((await api('/api/v1/submissions/sub-001', { token: orgB })).status, 404, 'other organizers cannot probe ids');
  assert.equal((await api('/api/v1/submissions/sub-001', { token: screening })).status, 200, 'bound screening sees its event');
  assert.equal((await api('/api/v1/submissions/sub-herbuddy-001', { token: screening })).status, 404, 'but not other events');
});

test('Judge assignment cannot cross events or skip the access-code binding', async () => {
  // Organizer B cannot assign onto organizer A's submission via their own hackathon id.
  const cross = await api('/api/v1/evaluations/assign', { method: 'POST', token: orgB, body: { hackathonId: 'hack-shesolves-001', judgeId: 'usr-judge-005', submissionId: 'sub-001' } });
  assert.equal(cross.status, 403);
  // A mismatched hackathon id is rejected even for the owner.
  const mismatch = await api('/api/v1/evaluations/assign', { method: 'POST', token: orgA, body: { hackathonId: 'hack-001', judgeId: 'usr-judge-005', submissionId: 'sub-002' } });
  assert.equal(mismatch.status, 400);
  // A judge who never redeemed this event's code can't be assigned.
  const unbound = store.createUser({ email: `judge_${unique()}@pccoe.edu.in`, password: 'password123', fullName: 'Unbound Judge', role: 'judge' });
  const res = await api('/api/v1/evaluations/assign', { method: 'POST', token: orgA, body: { hackathonId: 'hack-001', judgeId: unbound.id, submissionId: 'sub-001' } });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /access code/);
});

test('Evaluations validate criteria, score ranges and the real deadline', async () => {
  const assign = await api('/api/v1/evaluations/assign', { method: 'POST', token: admin, body: { hackathonId: 'hack-001', judgeId: 'usr-judge-005', submissionId: 'sub-001' } });
  assert.equal(assign.status, 201);
  const submit = (scores, hackathonId = 'hack-001', submissionId = 'sub-001') =>
    api('/api/v1/evaluations', { method: 'POST', token: judge, body: { hackathonId, submissionId, scores } });

  assert.equal((await submit([{ criterionId: 'made-up', score: 10 }])).status, 400);
  assert.equal((await submit([{ criterionId: 'crit-101', score: 99999 }])).status, 400);
  assert.equal((await submit([{ criterionId: 'crit-101', score: -5 }])).status, 400);
  assert.equal((await submit([{ criterionId: 'crit-101', score: 'abc' }])).status, 400);
  // Partial write protection: a valid item followed by an invalid one stores nothing.
  const before = store.evaluations.length;
  assert.equal((await submit([{ criterionId: 'crit-101', score: 20 }, { criterionId: 'crit-102', score: 500 }])).status, 400);
  assert.equal(store.evaluations.length, before);
  // Deadline bypass via a fake hackathon id is rejected.
  assert.equal((await submit([{ criterionId: 'crit-101', score: 20 }], 'nope')).status, 400);
});

test('Screening decisions require a binding to that hackathon and notify the team', async () => {
  assert.equal((await api('/api/v1/teams/team-coders-001/screening', { method: 'PATCH', token: screening, body: { status: 'rejected' } })).status, 403);
  // Screening needs a finalized submission: the leader locks team-001's draft first.
  assert.equal((await api('/api/v1/teams/team-001/screening', { method: 'PATCH', token: screening, body: { status: 'shortlisted' } })).status, 409);
  assert.equal((await api('/api/v1/submissions/sub-001/lock', { method: 'PATCH', token: leader })).status, 200);
  await api('/api/v1/teams/team-001/screening', { method: 'PATCH', token: screening, body: { status: 'pending' } });
  await waitForEmailIdle(3000);
  memoryProvider.reset();
  const ok = await api('/api/v1/teams/team-001/screening', { method: 'PATCH', token: screening, body: { status: 'shortlisted' } });
  assert.equal(ok.status, 200);
  await waitForEmailIdle(3000);
  assert.ok(memoryProvider.sent.some((m) => m.to === 'alex@university.edu' && /judging/i.test(m.subject)));
});

test('Certificates can only be issued by the event owner, to its participants, once', async () => {
  const forged = await api('/api/v1/certificates/issue', { method: 'POST', token: orgB, body: { hackathonId: 'hack-001', userId: 'usr-student-002', certificateType: 'winner' } });
  assert.equal(forged.status, 403);
  const nobody = await api('/api/v1/certificates/issue', { method: 'POST', token: orgA, body: { hackathonId: 'hack-001', userId: 'nobody' } });
  assert.equal(nobody.status, 400);
  const badType = await api('/api/v1/certificates/issue', { method: 'POST', token: orgA, body: { hackathonId: 'hack-001', userId: 'usr-student-002', certificateType: 'emperor' } });
  assert.equal(badType.status, 400);
  const first = await api('/api/v1/certificates/issue', {
    method: 'POST',
    token: orgA,
    body: { hackathonId: 'hack-001', userId: 'usr-student-002', participantName: 'Visit evil.example', hackathonTitle: 'Visit evil.example' },
  });
  if (first.status === 201) {
    assert.ok(!JSON.stringify(first.body).includes('evil.example'), 'names come from records, not the request');
  } else {
    assert.equal(first.status, 409); // already issued by an earlier suite
  }
  assert.equal((await api('/api/v1/certificates/issue', { method: 'POST', token: orgA, body: { hackathonId: 'hack-001', userId: 'usr-student-002' } })).status, 409);
});

test('Only participants can register for events or join teams', async () => {
  assert.equal((await api('/api/v1/hackathons/hack-shesolves-001/register', { method: 'POST', token: orgA })).status, 403);
  assert.equal((await api('/api/v1/teams/join', { method: 'POST', token: judge, body: { teamCode: 'HT-CODERS' } })).status, 403);
});

test('Registration sends a confirmation; rejecting an accepted member is refused', async () => {
  const student = await signup('student');
  memoryProvider.reset();
  const reg = await api('/api/v1/hackathons/hack-shesolves-001/register', { method: 'POST', token: student.token });
  assert.equal(reg.status, 201);
  await waitForEmailIdle(3000);
  assert.ok(memoryProvider.sent.some((m) => m.to === student.email && /registered/i.test(m.subject)));

  const accepted = store.teamMembers.find((m) => m.teamId === 'team-001' && m.status === 'accepted' && m.role !== 'leader');
  if (accepted) {
    const res = await api(`/api/v1/teams/team-001/requests/${accepted.id}`, { method: 'PUT', token: leader, body: { action: 'reject' } });
    assert.equal(res.status, 400);
  }
});

test('Auth endpoints are rate limited', async () => {
  process.env.RATE_LIMIT_IN_TESTS = '1';
  try {
    const email = `ratelimit_${unique()}@pccoe.edu.in`;
    const statuses = [];
    for (let i = 0; i < 4; i += 1) {
      statuses.push((await api('/api/v1/auth/forgot-password', { method: 'POST', body: { email } })).status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 429]);
    const logins = [];
    for (let i = 0; i < 11; i += 1) {
      logins.push((await api('/api/v1/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } })).status);
    }
    assert.equal(logins[9], 401);
    assert.equal(logins[10], 429);
  } finally {
    delete process.env.RATE_LIMIT_IN_TESTS;
  }
});

test('Role changes notify the affected user', async () => {
  const user = await signup('student');
  memoryProvider.reset();
  const res = await api(`/api/v1/admin/users/${user.id}/role`, { method: 'PUT', token: admin, body: { role: 'leader' } });
  assert.equal(res.status, 200);
  noCredentials(res.body);
  await waitForEmailIdle(3000);
  assert.ok(memoryProvider.sent.some((m) => m.to === user.email && /role/i.test(m.subject)));
});

test('Registration needs an open window and accepts confirmed details', async () => {
  const student = await signup('student');
  // Results already published (hack-002) → closed.
  const closed = await api('/api/v1/hackathons/hack-002/register', { method: 'POST', token: student.token, body: { acceptTerms: true } });
  assert.equal(closed.status, 400);
  assert.match(closed.body.message, /closed|deadline/i);
  // Invalid details are refused; refusing the rules is refused.
  assert.equal((await api('/api/v1/hackathons/hack-shesolves-001/register', { method: 'POST', token: student.token, body: { phone: 'call me', acceptTerms: true } })).status, 400);
  assert.equal((await api('/api/v1/hackathons/hack-shesolves-001/register', { method: 'POST', token: student.token, body: { acceptTerms: false } })).status, 400);
  // Valid form → registered with the confirmed details (visible to the event's organizer).
  const ok = await api('/api/v1/hackathons/hack-shesolves-001/register', {
    method: 'POST',
    token: student.token,
    body: { phone: '+91 98765 43210', institution: 'PCCOE', course: 'B.Tech CSE', yearOfStudy: '3rd Year', acceptTerms: true },
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.registration.details.phone, '+91 98765 43210');
  assert.ok(ok.body.registration.details.acceptedTermsAt);
  const regs = await api('/api/v1/hackathons/hack-shesolves-001/registrations', { token: orgB });
  assert.ok(regs.body.registrations.some((r) => r.details?.course === 'B.Tech CSE'));
});
