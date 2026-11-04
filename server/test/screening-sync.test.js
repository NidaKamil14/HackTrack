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
  const reg = await api('/api/v1/auth/register', { method: 'POST', body: { email, password: 'password123', fullName: 'Late Joiner', role: 'student', university: 'PCCOE', memberId: 'STU-LATE' } });
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

test('Drafts are not in screening: decisions are refused and nobody sees a status', async () => {
  // team-001 / sub-001 is an unlocked (draft) seed submission.
  const seedReviewer = await login('screening@hacktrack.io');
  assert.equal(store.getSubmissionByTeamId('team-001').isLocked, false);
  for (const status of ['shortlisted', 'rejected']) {
    const res = await api('/api/v1/teams/team-001/screening', { method: 'PATCH', token: seedReviewer, body: { status } });
    assert.equal(res.status, 409, status);
    assert.match(res.body.message, /not finalized/);
  }
  // Even with a status recorded earlier (seed data), participants see "not submitted".
  for (const email of ['alex@university.edu', 'priya@university.edu']) {
    const token = await login(email);
    const sub = await api('/api/v1/submissions/team/team-001', { token });
    assert.equal(sub.body.submission.screeningStatus, 'not_submitted', email);
    const mine = await api('/api/v1/teams/mine', { token });
    assert.equal(mine.body.teams.find((t) => t.id === 'team-001').screeningStatus, 'not_submitted');
  }
  // The committee's queue only lists finalized work.
  const queue = await api('/api/v1/submissions?hackathonId=hack-001', { token: seedReviewer });
  assert.ok(queue.body.submissions.every((x) => x.isLocked), 'no drafts in the screening queue');
  // Resetting to pending is always allowed.
  assert.equal((await api('/api/v1/teams/team-001/screening', { method: 'PATCH', token: seedReviewer, body: { status: 'pending' } })).status, 200);
  // The demo team is unaffected by another team's decision.
  assert.equal(store.findTeamById(DEMO_IDS.team).screeningStatus, 'shortlisted');
});

test('A team with no submission at all cannot be screened', async () => {
  resetDemo('team');
  const res = await decide('shortlisted');
  assert.equal(res.status, 409);
  assert.match(res.body.message, /not submitted/);
  const v = await participantView(MEMBERS[1]);
  assert.equal(v.teamStatus, 'not_submitted');
  resetDemo('submitted');
});

test('The compliance checklist is saved with the decision and shown to every member', async () => {
  const checks = { gitFreshness: true, endpointsLive: true, envConfigured: true, licenseMIT: true };
  assert.equal((await decide('shortlisted', { checks, feedback: 'All four checks passed.', internalNote: 'REVIEWER-ONLY: looked fine.' })).status, 200);

  // The reviewer sees the same checklist after logging in again.
  const again = await login('screening@demo.hacktrack.io');
  const queue = await api(`/api/v1/submissions?hackathonId=${DEMO_IDS.hackathon}`, { token: again });
  const entry = queue.body.submissions.find((x) => x.teamId === DEMO_IDS.team);
  assert.deepEqual(entry.screeningChecks, checks);
  assert.ok(entry.screenedAt);

  // Every member sees the decision, its basis and date — never the internal note.
  for (const email of MEMBERS) {
    const token = await login(email);
    const sub = await api(`/api/v1/submissions/team/${DEMO_IDS.team}`, { token });
    assert.equal(sub.body.submission.screeningStatus, 'shortlisted');
    assert.deepEqual(sub.body.submission.screeningChecks, checks, email);
    assert.equal(sub.body.submission.screeningFeedback, 'All four checks passed.');
    assert.ok(sub.body.submission.screenedAt);
    assert.ok(!sub.text.includes('REVIEWER-ONLY'));
  }

  // Bad checklists are refused.
  assert.equal((await decide('shortlisted', { checks: { hacked: true } })).status, 400);
  assert.equal((await decide('shortlisted', { checks: { gitFreshness: 'yes' } })).status, 400);
});

test('Finalizing a submission starts screening fresh — no preset or stale "shortlisted"', async () => {
  // team-001 is seeded with screeningStatus "shortlisted" but no recorded decision,
  // a draft submission (sub-001) and seed judge scores on that draft.
  const team = store.findTeamById('team-001');
  team.screeningStatus = 'shortlisted';
  store.getSubmissionById('sub-001').isLocked = false;
  const leader = await login('alex@university.edu');
  assert.equal((await api('/api/v1/submissions/sub-001/lock', { method: 'PATCH', token: leader })).status, 200);

  for (const email of ['alex@university.edu', 'priya@university.edu']) {
    const token = await login(email);
    const sub = await api('/api/v1/submissions/team/team-001', { token });
    assert.equal(sub.body.submission.isLocked, true);
    assert.equal(sub.body.submission.screeningStatus, 'pending', `${email}: just submitted = pending, not shortlisted`);
    assert.equal(sub.body.submission.screeningChecks, null);
    assert.equal(sub.body.submission.screenedAt, null);
    assert.equal(sub.body.submission.judgingProgress.judgesAssigned, 0, 'no judging before a real shortlist');
  }
  // It now waits in the reviewer's queue, and a real decision still works.
  const reviewer = await login('screening@hacktrack.io');
  const queue = await api('/api/v1/submissions?hackathonId=hack-001', { token: reviewer });
  assert.equal(queue.body.submissions.find((x) => x.teamId === 'team-001').screeningStatus, 'pending');
  assert.equal((await api('/api/v1/teams/team-001/screening', { method: 'PATCH', token: reviewer, body: { status: 'shortlisted' } })).status, 200);
  // Locking again (already locked) does not wipe that decision.
  store.lockSubmission('sub-001');
  assert.equal(store.findTeamById('team-001').screeningStatus, 'shortlisted');
});

test('Participants cannot change or read screening internals', async () => {
  const member = await login(MEMBERS[1]);
  assert.equal((await api(`/api/v1/teams/${DEMO_IDS.team}/screening`, { method: 'PATCH', token: member, body: { status: 'shortlisted' } })).status, 403);
  assert.equal((await api(`/api/v1/teams/${DEMO_IDS.team}/screening-reviews`, { token: member })).status, 404);
});
