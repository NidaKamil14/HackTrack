import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import store from '../src/database/store.js';
import { memoryProvider } from '../src/notifications/providers.js';
import { waitForEmailIdle } from '../src/notifications/emailQueue.js';
import { resetDemo, DEMO_IDS, DEMO_STAGES, DEMO_PASSWORD } from '../src/demo/demoScenario.js';

// The shared demonstration scenario: one event, one team, one submission,
// visible through every role's API with the same ids.

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
  const res = await api('/api/v1/auth/login', { method: 'POST', body: { email, password: DEMO_PASSWORD } });
  assert.equal(res.status, 200, `login ${email}: ${res.text}`);
  return res.body.token;
};
const T = {};
const EMAILS = {
  organizer: 'organizer@demo.hacktrack.io',
  screening: 'screening@demo.hacktrack.io',
  judge1: 'judge.nair@demo.hacktrack.io',
  judge2: 'judge.fernandes@demo.hacktrack.io',
  leader: 'aanya.leader@demo.hacktrack.io',
  member1: 'kabir.member@demo.hacktrack.io',
  member2: 'meera.member@demo.hacktrack.io',
};

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  resetDemo('setup');
  for (const [k, e] of Object.entries(EMAILS)) T[k] = await login(e);
  T.admin = (await api('/api/v1/auth/login', { method: 'POST', body: { email: 'admin@hacktrack.io', password: 'password123' } })).body.token;
});
test.after(() => new Promise((resolve) => server.close(resolve)));

test('Every stage can be built from scratch with the same fixed ids', () => {
  for (const { key } of DEMO_STAGES) {
    const status = resetDemo(key);
    assert.equal(status.stage, key, `detected stage after reset to ${key}`);
    if (['team', 'submitted', 'shortlisted', 'judged', 'published'].includes(key)) assert.equal(status.ids.teamId, DEMO_IDS.team);
    if (['submitted', 'shortlisted', 'judged', 'published'].includes(key)) assert.equal(status.ids.submissionId, DEMO_IDS.submission);
  }
  assert.equal(store.teams.filter((t) => t.hackathonId === DEMO_IDS.hackathon).length, 1, 'never a second copy of the team');
  assert.equal(store.certificates.filter((c) => c.hackathonId === DEMO_IDS.hackathon).length, 3);
});

test('Only admins can read or reset the demo', async () => {
  assert.equal((await api('/api/v1/demo')).status, 401);
  assert.equal((await api('/api/v1/demo', { token: T.organizer })).status, 403);
  assert.equal((await api('/api/v1/demo/reset', { method: 'POST', token: T.leader, body: { stage: 'published' } })).status, 403);
  assert.equal((await api('/api/v1/demo/reset', { method: 'POST', token: T.admin, body: { stage: 'nope' } })).status, 400);
  const ok = await api('/api/v1/demo', { token: T.admin });
  assert.equal(ok.status, 200);
  assert.ok(!/password/i.test(ok.text));
});

test('Full lifecycle through the public API, starting from the bare event', async () => {
  await api('/api/v1/demo/reset', { method: 'POST', token: T.admin, body: { stage: 'setup' } });
  memoryProvider.reset();

  // Stage 1 — discovery and registration
  const listed = await api('/api/v1/hackathons?scope=public');
  assert.ok(listed.body.hackathons.some((h) => h.id === DEMO_IDS.hackathon && h.status === 'published'));
  for (const who of ['leader', 'member1', 'member2']) {
    assert.equal((await api(`/api/v1/hackathons/${DEMO_IDS.hackathon}/register`, { method: 'POST', token: T[who] })).status, 201);
    const mine = await api('/api/v1/auth/my-registrations', { token: T[who] });
    assert.ok(mine.body.registrations.some((r) => r.hackathonId === DEMO_IDS.hackathon));
  }
  const created = await api('/api/v1/teams', { method: 'POST', token: T.leader, body: { hackathonId: DEMO_IDS.hackathon, teamName: 'Team Apex Innovators', track: 'Sustainability & Climate Tech' } });
  assert.equal(created.status, 201);
  const team = created.body.team;
  for (const who of ['member1', 'member2']) {
    const req = await api('/api/v1/teams/join', { method: 'POST', token: T[who], body: { teamCode: team.teamCode } });
    assert.equal(req.status, 201);
    assert.equal((await api(`/api/v1/teams/${team.id}/requests/${req.body.request.id}`, { method: 'PUT', token: T.leader, body: { action: 'accept' } })).status, 200);
  }
  const orgTeams = await api(`/api/v1/teams?hackathonId=${DEMO_IDS.hackathon}`, { token: T.organizer });
  const orgTeam = orgTeams.body.teams.find((t) => t.id === team.id);
  assert.equal(orgTeam.memberCount, 3, 'organizer sees all three participants');
  let progress = (await api(`/api/v1/hackathons/${DEMO_IDS.hackathon}/progress`, { token: T.organizer })).body.progress;
  assert.equal(progress.registrations, 3);
  assert.equal(progress.teams, 1);
  assert.equal(progress.participants, 3);
  assert.equal((await api(`/api/v1/hackathons/${DEMO_IDS.hackathon}/progress`, { token: T.leader })).status, 404);

  // Stage 2 — submission (leader only)
  const subBody = { teamId: team.id, projectTitle: 'EcoTrack AI', abstract: 'Campus carbon tracking with AI recommendations.', track: 'Sustainability & Climate Tech', repoUrl: 'https://example.com/demo/ecotrack-ai', demoUrl: 'https://example.com/demo/ecotrack-ai/live' };
  assert.equal((await api('/api/v1/submissions', { method: 'POST', token: T.member1, body: subBody })).status, 403, 'members cannot submit');
  const sub = await api('/api/v1/submissions', { method: 'POST', token: T.leader, body: subBody });
  assert.ok([200, 201].includes(sub.status));
  const subId = sub.body.submission.id;
  assert.equal((await api(`/api/v1/submissions/${subId}/lock`, { method: 'PATCH', token: T.leader })).status, 200);
  const memberView = await api(`/api/v1/submissions/team/${team.id}`, { token: T.member2 });
  assert.equal(memberView.body.submission.projectTitle, 'EcoTrack AI');
  assert.equal(memberView.body.submission.screeningStatus, 'pending');
  const queue = await api(`/api/v1/submissions?hackathonId=${DEMO_IDS.hackathon}`, { token: T.screening });
  assert.ok(queue.body.submissions.some((s) => s.id === subId && s.screeningStatus === 'pending'), 'appears in the screening queue');

  // Stage 3 — screening with team feedback + internal note
  const decision = await api(`/api/v1/teams/${team.id}/screening`, {
    method: 'PATCH',
    token: T.screening,
    body: { status: 'shortlisted', feedback: 'All checks passed — see you in judging.', internalNote: 'CONFIDENTIAL: verified commit history.' },
  });
  assert.equal(decision.status, 200);
  const leaderSub = await api(`/api/v1/submissions/team/${team.id}`, { token: T.leader });
  assert.equal(leaderSub.body.submission.screeningStatus, 'shortlisted');
  assert.equal(leaderSub.body.submission.screeningFeedback, 'All checks passed — see you in judging.');
  for (const who of ['leader', 'member1', 'member2']) {
    const views = [await api(`/api/v1/teams/${team.id}`, { token: T[who] }), await api('/api/v1/teams/mine', { token: T[who] }), await api(`/api/v1/submissions/team/${team.id}`, { token: T[who] })];
    for (const v of views) assert.ok(!v.text.includes('CONFIDENTIAL'), 'internal reviewer notes never reach the team');
    assert.equal((await api(`/api/v1/teams/${team.id}/screening-reviews`, { token: T[who] })).status, 404);
    const notes = await api('/api/v1/notifications', { token: T[who] });
    assert.ok(notes.body.notifications.some((n) => n.type === 'screening_decision'), `${who} notified of the shortlist`);
  }
  const committee = await api(`/api/v1/hackathons/${DEMO_IDS.hackathon}/committee`, { token: T.admin });
  assert.equal(committee.body.judges.length, 2, 'admin sees the bound judges');
  assert.equal(committee.body.screeners.length, 1);
  assert.ok(!committee.text.includes('JUDGE-'), 'admin committee view never includes access codes');
  assert.equal((await api(`/api/v1/hackathons/${DEMO_IDS.hackathon}/committee`, { token: T.leader })).status, 404);
  const reviews = await api(`/api/v1/teams/${team.id}/screening-reviews`, { token: T.organizer });
  assert.ok(reviews.text.includes('CONFIDENTIAL'), 'organizer can read reviewer notes');
  progress = (await api(`/api/v1/hackathons/${DEMO_IDS.hackathon}/progress`, { token: T.organizer })).body.progress;
  assert.equal(progress.screening.shortlisted, 1);

  // Stage 4 — judging: shortlisted submission appears automatically for both bound judges
  for (const who of ['judge1', 'judge2']) {
    const assigned = await api('/api/v1/evaluations/assigned', { token: T[who] });
    assert.ok(assigned.body.assignedSubmissions.some((s) => s.id === subId), `${who} sees EcoTrack AI`);
  }
  const hack = (await api(`/api/v1/hackathons/${DEMO_IDS.hackathon}`)).body.hackathon;
  const scoresFor = (vals) => hack.criteria.map((c, i) => ({ criterionId: c.id, score: vals[i] }));
  assert.equal((await api('/api/v1/evaluations', { method: 'POST', token: T.judge1, body: { hackathonId: DEMO_IDS.hackathon, submissionId: subId, scores: scoresFor([26, 25, 22, 13]), remarks: 'Strong demo.' } })).status, 201);
  let mine = (await api('/api/v1/teams/mine', { token: T.member1 })).body.teams.find((t) => t.id === team.id);
  assert.equal(mine.judgingProgress.status, 'in_progress');
  assert.ok(!JSON.stringify(mine).includes('"score"'), 'no scores before publication');
  assert.equal((await api(`/api/v1/teams/${team.id}/results`, { token: T.leader })).status, 403);
  assert.equal((await api(`/api/v1/evaluations/leaderboard/${DEMO_IDS.hackathon}`, { token: T.leader })).status, 403);
  assert.equal((await api('/api/v1/evaluations', { method: 'POST', token: T.judge2, body: { hackathonId: DEMO_IDS.hackathon, submissionId: subId, scores: scoresFor([24, 27, 21, 12]), remarks: 'Quantify impact.' } })).status, 201);
  progress = (await api(`/api/v1/hackathons/${DEMO_IDS.hackathon}/progress`, { token: T.organizer })).body.progress;
  assert.equal(progress.judging.complete, 1);

  // Stage 5 — results and certificates
  assert.equal((await api(`/api/v1/evaluations/publish-results/${DEMO_IDS.hackathon}`, { method: 'POST', token: T.organizer })).status, 200);
  const results = await api(`/api/v1/teams/${team.id}/results`, { token: T.member2 });
  assert.equal(results.status, 200);
  assert.equal(results.body.results.rank, 1);
  assert.equal(results.body.results.totalScore, 85); // (86 + 84) / 2
  assert.equal(results.body.results.criteria.length, 4);
  for (const who of ['leader', 'member1', 'member2']) {
    const certs = await api('/api/v1/certificates/my-certificates', { token: T[who] });
    assert.ok(certs.body.certificates.some((c) => c.hackathonId === DEMO_IDS.hackathon && c.certificateType === 'winner'));
  }
  const adminProgress = (await api(`/api/v1/hackathons/${DEMO_IDS.hackathon}/progress`, { token: T.admin })).body.progress;
  assert.equal(adminProgress.resultsPublished, true);
  assert.equal(adminProgress.certificates, 3);

  // No real email is ever sent to the fictional demo domain.
  await waitForEmailIdle(3000);
  assert.equal(memoryProvider.sent.filter((m) => m.to.endsWith('@demo.hacktrack.io')).length, 0);
});
