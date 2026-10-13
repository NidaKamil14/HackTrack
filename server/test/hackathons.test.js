import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;
let adminToken;
let organizerToken;
let studentToken;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Login as admin
  const adminRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hacktrack.io', password: 'password123' }),
  });
  const adminData = await adminRes.json();
  adminToken = adminData.token;

  // Login as organizer
  const orgRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'organizer@hacktrack.io', password: 'password123' }),
  });
  const orgData = await orgRes.json();
  organizerToken = orgData.token;

  // Login as student
  const studentRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya@university.edu', password: 'password123' }),
  });
  const studentData = await studentRes.json();
  studentToken = studentData.token;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('HackTrack Hackathons & Criteria (FR-6 to FR-11, FR-23, BR-4, BR-5)', async (t) => {
  let createdHackathonId;

  await t.test('1. GET /api/v1/hackathons returns public hackathon listings', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hackathons`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.hackathons));
    assert.ok(body.count >= 2);
  });

  await t.test('2. FR-6 & BR-4: Block student from creating a hackathon', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: 'Unauthorized Hackathon',
        registrationDeadline: new Date(Date.now() + 86400000).toISOString(),
        submissionDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
      }),
    });

    assert.equal(res.status, 403);
  });

  await t.test('3. FR-7: Reject invalid deadline chronology (reg after sub)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Invalid Timeline Hack',
        registrationDeadline: new Date(Date.now() + 5 * 86400000).toISOString(),
        submissionDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /cannot be after/i);
  });

  await t.test('4. FR-6, FR-8, FR-23: Admin creates valid hackathon with custom team size and modules', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'PCCOE Smart India Internal Hack 2026',
        tagLine: 'Hardware & Software Innovation for Digital Governance',
        description: 'Internal college hackathon qualifying teams for national competitions.',
        registrationDeadline: new Date(Date.now() + 3 * 86400000).toISOString(),
        submissionDeadline: new Date(Date.now() + 6 * 86400000).toISOString(),
        minTeamSize: 2,
        maxTeamSize: 6, // FR-8
        hasScreeningRound: true, // FR-23, BR-5
        screeningRoundsCount: 2, // BR-6
        hasMentorship: true, // FR-23, BR-5
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.hackathon.maxTeamSize, 6);
    assert.equal(body.hackathon.hasScreeningRound, true);
    assert.equal(body.hackathon.screeningRoundsCount, 2);
    createdHackathonId = body.hackathon.id;
  });

  await t.test('5. FR-9: Admin configures rubric evaluation criteria', async () => {
    const newCriteria = [
      { id: 'c1', name: 'Originality', maxScore: 30, weightage: 1.0 },
      { id: 'c2', name: 'Technical Depth', maxScore: 40, weightage: 1.5 },
      { id: 'c3', name: 'Presentation', maxScore: 30, weightage: 0.5 },
    ];

    const res = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}/criteria`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ criteria: newCriteria }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.criteria.length, 3);
  });

  await t.test('6. FR-10: Admin publishes hackathon for participant registration', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.hackathon.status, 'published');
  });

  await t.test('7. FR-11: Expired hackathon automatically flags registration as closed', async () => {
    // hack-002 had its registration deadline in the past
    const res = await fetch(`${baseUrl}/api/v1/hackathons/hack-002`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.hackathon.isRegistrationClosed, true);
    assert.equal(body.hackathon.isSubmissionClosed, true);
  });

  await t.test('8. Organizer can create and manage their hackathons', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        title: 'CyberShield 2026',
        tagLine: 'Defend the Infrastructure',
        registrationDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
        submissionDeadline: new Date(Date.now() + 5 * 86400000).toISOString(),
        minTeamSize: 1,
        maxTeamSize: 4,
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.hackathon.title, 'CyberShield 2026');
  });
});
