import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

// Committee access codes: the organizer's codes are the server's codes, the
// committee roster survives regeneration, and mentors can join with a code.

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
const login = async (email) => {
  const res = await api('/api/v1/auth/login', { method: 'POST', body: { email, password: 'password123' } });
  assert.equal(res.status, 200, `login ${email}: ${res.text}`);
  return res.body.token;
};
const unique = () => Math.random().toString(36).slice(2, 8);

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});
test.after(() => new Promise((resolve) => server.close(resolve)));

test('A regenerated screening code works, the old one stops working, and the roster keeps earlier reviewers', async () => {
  const organizer = await login('organizer@hacktrack.io');

  // Reviewer A joins with the current code at sign-up.
  const before = await api('/api/v1/hackathons/hack-001/codes', { token: organizer });
  assert.equal(before.status, 200);
  const oldCode = before.body.codes.find((c) => c.role === 'screening').code;
  const emailA = `screen.a.${unique()}@example.org`;
  const signupA = await api('/api/v1/auth/register', {
    method: 'POST',
    body: { email: emailA, password: 'password123', fullName: 'Reviewer A', role: 'screening', university: 'PCCOE', department: 'Screening', accessCode: oldCode },
  });
  assert.equal(signupA.status, 201, signupA.text);

  // Organizer regenerates: a new code replaces the old one.
  const gen = await api('/api/v1/hackathons/hack-001/codes', { method: 'POST', token: organizer, body: { role: 'screening' } });
  assert.equal(gen.status, 201, gen.text);
  const newCode = gen.body.codeRecord.code;
  assert.notEqual(newCode, oldCode);

  // Reviewer B (existing account) can't use the old code, but the new one works.
  const emailB = `screen.b.${unique()}@example.org`;
  const signupB = await api('/api/v1/auth/register', {
    method: 'POST',
    body: { email: emailB, password: 'password123', fullName: 'Reviewer B', role: 'screening', university: 'PCCOE', department: 'Screening', accessCode: newCode },
  });
  assert.equal(signupB.status, 201, signupB.text);
  const tokenA = signupA.body.token;
  const stale = await api('/api/v1/auth/redeem-code', { method: 'POST', token: tokenA, body: { code: oldCode } });
  assert.equal(stale.status, 400);

  // Both reviewers are on the committee, and both can open the event's queue.
  const after = await api('/api/v1/hackathons/hack-001/codes', { token: organizer });
  const emails = after.body.assignedScreeners.map((u) => u.email);
  assert.ok(emails.includes(emailA), 'reviewer who joined with the previous code is still listed');
  assert.ok(emails.includes(emailB));
  assert.ok(emails.includes('screening@hacktrack.io'), 'seed reviewer bound without a code is listed');
  for (const token of [tokenA, signupB.body.token]) {
    const mine = await api('/api/v1/auth/my-hackathons', { token });
    assert.ok(mine.body.hackathons.some((h) => h.id === 'hack-001'));
  }
});

test('Mentors join an event with its mentor code (sign-up or later) and appear on the committee', async () => {
  const organizer = await login('organizer@hacktrack.io');
  const gen = await api('/api/v1/hackathons/hack-001/codes', { method: 'POST', token: organizer, body: { role: 'mentor' } });
  assert.equal(gen.status, 201, gen.text);
  const mentorCode = gen.body.codeRecord.code;

  // Sign-up with the event's mentor code binds the new mentor to the event.
  const email = `mentor.${unique()}@example.org`;
  const signup = await api('/api/v1/auth/register', {
    method: 'POST',
    body: { email, password: 'password123', fullName: 'New Mentor', role: 'mentor', university: 'Guild', designation: 'Cloud architecture', accessCode: mentorCode },
  });
  assert.equal(signup.status, 201, signup.text);
  const teams = await api('/api/v1/teams?hackathonId=hack-001', { token: signup.body.token });
  assert.ok(teams.body.teams.length > 0, 'the new mentor sees the event teams');

  // A random code is not a mentor key.
  const bad = await api('/api/v1/auth/register', {
    method: 'POST',
    body: { email: `mentor.bad.${unique()}@example.org`, password: 'password123', fullName: 'No Code', role: 'mentor', university: 'Guild', designation: 'Cloud architecture', accessCode: 'MENTOR-FAKE-1234' },
  });
  assert.equal(bad.status, 400);

  // Mentors appear in the organizer's committee view; a screening code does not work for a mentor.
  const codes = await api('/api/v1/hackathons/hack-001/codes', { token: organizer });
  assert.ok(codes.body.assignedMentors.some((u) => u.email === email));
  assert.ok(codes.body.assignedMentors.some((u) => u.email === 'mentor@hacktrack.io'));
  const screeningCode = codes.body.codes.find((c) => c.role === 'screening').code;
  const wrongRole = await api('/api/v1/auth/redeem-code', { method: 'POST', token: signup.body.token, body: { code: screeningCode } });
  assert.equal(wrongRole.status, 400);
});

test('Another organizer cannot read or regenerate an event\'s codes', async () => {
  const other = await login('marcus.ai@hacktrack.io');
  assert.equal((await api('/api/v1/hackathons/hack-001/codes', { token: other })).status, 403);
  assert.equal((await api('/api/v1/hackathons/hack-001/codes', { method: 'POST', token: other, body: { role: 'screening' } })).status, 403);
});
