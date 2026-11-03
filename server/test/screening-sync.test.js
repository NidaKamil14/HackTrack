import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import store from '../src/database/store.js';
import { resetDemo, DEMO_IDS } from '../src/demo/demoScenario.js';

// Regression: a screening decision must reach every accepted team member
// through the participant-facing APIs (GET /submissions/team/:teamId and
// GET /teams/mine), for locked and unlocked submissions, without leaking
// reviewer-only notes and without touching other teams.

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
  assert.equal(res.status, 200, email);
  return res.body.token;
};
const MEMBERS = ['aanya.leader@demo.hacktrack.io', 'kabir.member@demo.hacktrack.io', 'meera.member@demo.hacktrack.io'];

/** What one participant's dashboard receives for their team. */
async function participantView(email) {
  const token = await login(email); // fresh session every time (= log out / log in)
  const sub = await api(`/api/v1/submissions/team/${DEMO_IDS.team}`, { token });
  const mine = await api('/api/v1/teams/mine', { token });
  const notes = await api('/api/v1/notifications', { token });
  return {
    submissionStatus: sub.body?.submission?.screeningStatus,
    teamStatus: mine.body?.teams?.find((t) => t.id === DEMO_IDS.team)?.screeningStatus,
    feedback: sub.body?.submission?.screeningFeedback,
    raw: sub.text + mine.text + notes.text,
    decisionNotices: notes.body.notifications.filter((n) => n.type === 'screening_decision'),
  };
}

let reviewer;
test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  resetDemo('submitted');
  reviewer = await login('screening@demo.hacktrack.io');
});
test.after(() => new Promise((resolve) => server.close(resolve)));

const decide = (status, extra = {}) =>
  api(`/api/v1/teams/${DEMO_IDS.team}/screening`, { method: 'PATCH', token: reviewer, body: { status, ...extra } });

test('1. Shortlist → all three participants see shortlisted (and are notified once)', async () => {
  const otherTeamBefore = store.findTeamById('team-001').screeningStatus;
  const res = await decide('shortlisted', { feedback: 'Great work — see you in judging.', internalNote: 'REVIEWER-ONLY: verified commits.' });
  assert.equal(res.status, 200);

  // Saved on the right records.
  const team = store.findTeamById(DEMO_IDS.team);
  assert.equal(team.screeningStatus, 'shortlisted');
  assert.equal(team.hackathonId, DEMO_IDS.hackathon);
  assert.equal(store.getSubmissionByTeamId(DEMO_IDS.team).id, DEMO_IDS.submission);
  const review = store.getScreeningReviews(DEMO_IDS.team).at(-1);
  assert.equal(review.status, 'shortlisted');
  assert.equal(review.hackathonId, DEMO_IDS.hackathon);

  for (const email of MEMBERS) {
    const v = await participantView(email);
    assert.equal(v.submissionStatus, 'shortlisted', email);
    assert.equal(v.teamStatus, 'shortlisted', email);
    assert.equal(v.feedback, 'Great work — see you in judging.');
    assert.ok(!v.raw.includes('REVIEWER-ONLY'), `${email}: reviewer notes must stay private`);
    assert.equal(v.decisionNotices.length, 1, `${email}: exactly one notification`);
  }

  // 6. An unrelated team is untouched.
  assert.equal(store.findTeamById('team-001').screeningStatus, otherTeamBefore);

  // Repeating the same decision does not notify again.
  await decide('shortlisted');
  for (const email of MEMBERS) assert.equal((await participantView(email)).decisionNotices.length, 1);
});

test('2. Reject → all three participants see rejected; changing back notifies again', async () => {
  assert.equal((await decide('rejected', { feedback: 'Repository was not public at the deadline.' })).status, 200);
  for (const email of MEMBERS) {
    const v = await participantView(email);
    assert.equal(v.submissionStatus, 'rejected', email);
    assert.equal(v.teamStatus, 'rejected', email);
    assert.equal(v.decisionNotices.length, 2, `${email}: shortlist + reject notices`);
  }
  assert.equal((await decide('shortlisted')).status, 200);
  for (const email of MEMBERS) {
    const v = await participantView(email);
    assert.equal(v.submissionStatus, 'shortlisted');
    assert.equal(v.decisionNotices.length, 3, `${email}: re-shortlisting notifies again`);
  }
});

test('3/4/8. The status is the same on every new session and repeated fetch', async () => {
  for (const email of MEMBERS) {
    const first = await participantView(email);
    const again = await participantView(email); // new login + re-fetch (refresh / sync poll)
    assert.equal(first.submissionStatus, again.submissionStatus);
    assert.equal(again.submissionStatus, 'shortlisted');
  }
});

test('5. A member accepted after the decision sees the current status', async () => {
  const email = `late_${Date.now()}@pccoe.edu.in`;
  const reg = await api('/api/v1/auth/register', { method: 'POST', body: { email, password: 'password123', fullName: 'Late Joiner', role: 'student' } });
  const token = reg.body.token;
  assert.equal((await api(`/api/v1/hackathons/${DEMO_IDS.hackathon}/register`, { method: 'POST', token })).status, 201);
  const team = store.findTeamById(DEMO_IDS.team);
  const join = await api('/api/v1/teams/join', { method: 'POST', token, body: { teamCode: team.teamCode } });
  assert.equal(join.status, 201);
  const leader = await login(MEMBERS[0]);
  assert.equal((await api(`/api/v1/teams/${team.id}/requests/${join.body.request.id}`, { method: 'PUT', token: leader, body: { action: 'accept' } })).status, 200);

  const sub = await api(`/api/v1/submissions/team/${team.id}`, { token });
  assert.equal(sub.body.submission.screeningStatus, 'shortlisted');
  assert.ok(!sub.text.includes('REVIEWER-ONLY'));
});

test('Unlocked (draft) submissions expose the decision too — the original bug', async () => {
  // team-001 / sub-001 is an unlocked seed submission (the case from the bug report).
  const seedReviewer = await login('screening@hacktrack.io');
  assert.equal(store.getSubmissionByTeamId('team-001').isLocked, false);
  assert.equal((await api('/api/v1/teams/team-001/screening', { method: 'PATCH', token: seedReviewer, body: { status: 'shortlisted' } })).status, 200);
  for (const email of ['alex@university.edu', 'priya@university.edu']) {
    const token = await login(email);
    const sub = await api('/api/v1/submissions/team/team-001', { token });
    assert.equal(sub.body.submission.isLocked, false);
    assert.equal(sub.body.submission.screeningStatus, 'shortlisted', email);
  }
  // The demo team is unaffected by another team's decision.
  assert.equal(store.findTeamById(DEMO_IDS.team).screeningStatus, 'shortlisted');
});

test('Participants cannot change or read screening internals', async () => {
  const member = await login(MEMBERS[1]);
  assert.equal((await api(`/api/v1/teams/${DEMO_IDS.team}/screening`, { method: 'PATCH', token: member, body: { status: 'shortlisted' } })).status, 403);
  assert.equal((await api(`/api/v1/teams/${DEMO_IDS.team}/screening-reviews`, { token: member })).status, 404);
});
