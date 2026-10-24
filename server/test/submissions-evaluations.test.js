import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;
let adminToken;
let leaderToken;
let studentToken;
let judgeToken;
let organizerToken;
let otherOrganizerToken;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Admin login
  const adminRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hacktrack.io', password: 'password123' }),
  });
  adminToken = (await adminRes.json()).token;

  // Leader login (Alex Chen, leader of team-001)
  const leaderRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex@university.edu', password: 'password123' }),
  });
  leaderToken = (await leaderRes.json()).token;

  // Student login (Priya Sharma, member of team-001)
  const studentRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya@university.edu', password: 'password123' }),
  });
  studentToken = (await studentRes.json()).token;

  // Judge login (Prof. Elena Rostova)
  const judgeRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'judge@hacktrack.io', password: 'password123' }),
  });
  judgeToken = (await judgeRes.json()).token;

  // Authorized Organizer login (Kavita Rao, creator of hack-001)
  const orgRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'organizer@hacktrack.io', password: 'password123' }),
  });
  organizerToken = (await orgRes.json()).token;

  // Another Organizer login (Marcus Vance, creator of hack-shesolves-001)
  const otherOrgRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'marcus.ai@hacktrack.io', password: 'password123' }),
  });
  otherOrganizerToken = (await otherOrgRes.json()).token;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('HackTrack Submissions, Evaluation & Results (FR-17 to FR-31, BR-7 to BR-9)', async (t) => {
  let createdSubmissionId;

  await t.test('1. FR-17 & BR-1: Block non-leader student from submitting project', async () => {
    const res = await fetch(`${baseUrl}/api/v1/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        teamId: 'team-001',
        projectTitle: 'Unauthorized Submission',
        abstract: 'Non-leader student cannot submit',
      }),
    });

    assert.equal(res.status, 403);
  });

  await t.test('2. FR-18, FR-21 & BR-8: Reject submission attempt for expired hackathon (hack-002)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        teamId: 'team-002', // in hack-002 where submission deadline has passed
        projectTitle: 'Late Submission Attempt',
        abstract: 'Should be rejected because deadline passed.',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /submission deadline.*passed/i);
  });

  await t.test('3. FR-19 & FR-20: Team Leader successfully submits project before deadline', async () => {
    const res = await fetch(`${baseUrl}/api/v1/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        teamId: 'team-001',
        projectTitle: 'NeuroMesh Edge Ingestion Engine',
        abstract: 'Real-time distributed edge telemetry aggregator with federated model sync.',
        track: 'AI & Machine Learning',
        repoUrl: 'https://github.com/neuromesh-ai/edge-core',
        demoUrl: 'https://neuromesh-preview.app',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.submission.id);
    assert.equal(body.submission.projectTitle, 'NeuroMesh Edge Ingestion Engine');
    createdSubmissionId = body.submission.id;
  });

  await t.test('4. FR-24: Admin assigns specific project submission to Judge', async () => {
    const res = await fetch(`${baseUrl}/api/v1/evaluations/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        hackathonId: 'hack-001',
        judgeId: 'usr-judge-005',
        submissionId: createdSubmissionId,
      }),
    });

    assert.equal(res.status, 201);
  });

  await t.test('5. FR-25 & BR-7: Judge retrieves only their assigned submissions', async () => {
    const res = await fetch(`${baseUrl}/api/v1/evaluations/assigned`, {
      headers: { Authorization: `Bearer ${judgeToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.assignedSubmissions.length >= 1);
    const matched = body.assignedSubmissions.find((s) => s.id === createdSubmissionId);
    assert.ok(matched, 'Assigned submission must appear in Judge workspace');
  });

  await t.test('6. FR-26 & FR-27: Judge submits evaluation scores and evaluation locks', async () => {
    const res = await fetch(`${baseUrl}/api/v1/evaluations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${judgeToken}`,
      },
      body: JSON.stringify({
        hackathonId: 'hack-001',
        submissionId: createdSubmissionId,
        scores: [
          { criterionId: 'crit-101', score: 24 },
          { criterionId: 'crit-102', score: 25 },
          { criterionId: 'crit-103', score: 22 },
          { criterionId: 'crit-104', score: 23 },
        ],
        remarks: 'Outstanding engineering architecture and distributed consensus design.',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.evaluations.length, 4);
    assert.equal(body.evaluations[0].isLocked, true);
  });

  await t.test('7. FR-28 & FR-29: Automatic ranking and leaderboard calculation', async () => {
    const res = await fetch(`${baseUrl}/api/v1/evaluations/leaderboard/hack-001`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.leaderboard));
    assert.equal(body.leaderboard[0].teamName, 'CyberPulse Vanguard');
    assert.equal(body.leaderboard[0].totalScore, 94); // 24+25+22+23
    assert.equal(body.leaderboard[0].rank, 1);
  });

  await t.test('8. Admin cannot publish results (HTTP 403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/evaluations/publish-results/hack-001`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'Forbidden');
  });

  await t.test('9. Unauthorized Organizer cannot publish results for another organizer event (HTTP 403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/evaluations/publish-results/hack-001`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherOrganizerToken}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'Forbidden');
  });

  await t.test('10. FR-30, FR-31 & BR-9: Authorized Organizer publishes results and generates certificates', async () => {
    const res = await fetch(`${baseUrl}/api/v1/evaluations/publish-results/hack-001`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.hackathon.resultsPublished, true);
    assert.equal(body.hackathon.status, 'completed');
  });
});
