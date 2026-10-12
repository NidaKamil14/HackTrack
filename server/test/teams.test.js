import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;
let leaderToken;
let studentToken;
let otherStudentToken;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Login as team leader (Alex Chen)
  const leaderRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex@university.edu', password: 'password123' }),
  });
  const leaderData = await leaderRes.json();
  leaderToken = leaderData.token;

  // Login as student (Priya Sharma)
  const studentRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya@university.edu', password: 'password123' }),
  });
  const studentData = await studentRes.json();
  studentToken = studentData.token;

  // Register another fresh student
  const otherRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `student_member_${Date.now()}@pccoe.edu.in`,
      password: 'password123',
      fullName: 'Aarav Deshmukh',
      role: 'student',
    }),
  });
  const otherData = await otherRes.json();
  otherStudentToken = otherData.token;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('HackTrack Team Management & Join Code (FR-12 to FR-16, BR-1 to BR-3)', async (t) => {
  let createdTeam;
  let joinRequestId;

  await t.test('1. FR-12 & BR-1: Block standard student from creating a team', async () => {
    const res = await fetch(`${baseUrl}/api/v1/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        hackathonId: 'hack-001',
        teamName: 'Unauthorized Team',
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /only users with the team leader role/i);
  });

  await t.test('2. FR-12 & FR-13: Team Leader creates team and gets unique Team Code', async () => {
    // Register fresh leader so no duplicate membership in hack-001
    const freshLeaderRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `new_leader_${Date.now()}@pccoe.edu.in`,
        password: 'password123',
        fullName: 'Shruti Mane',
        role: 'leader',
      }),
    });
    const freshLeaderData = await freshLeaderRes.json();
    leaderToken = freshLeaderData.token;

    const res = await fetch(`${baseUrl}/api/v1/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        hackathonId: 'hack-001',
        teamName: 'PCCOE CodeCrafters',
        track: 'Climate & Sustainability',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.team.teamCode.startsWith('HT-'), 'Team code must start with HT-');
    assert.equal(body.team.members.length, 1);
    assert.equal(body.team.members[0].role, 'leader');
    createdTeam = body.team;
  });

  await t.test('3. FR-14: Student submits join request using Team Code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/teams/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherStudentToken}`,
      },
      body: JSON.stringify({ teamCode: createdTeam.teamCode }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.request.status, 'pending');
    joinRequestId = body.request.id;
  });

  await t.test('4. FR-14: Rejection on non-existent Team Code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/teams/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherStudentToken}`,
      },
      body: JSON.stringify({ teamCode: 'HT-NONEXISTENT' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /not found/i);
  });

  await t.test('5. FR-15 & BR-3: Team Leader approves the pending join request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/teams/${createdTeam.id}/requests/${joinRequestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ action: 'accept' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.request.status, 'accepted');
  });

  await t.test('6. FR-16 & BR-2: Restrict approved student from joining another team in the same hackathon', async () => {
    // Attempt to join another team in hack-001
    const res = await fetch(`${baseUrl}/api/v1/teams/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherStudentToken}`,
      },
      body: JSON.stringify({ teamCode: 'HT-CPV881' }), // Team-001 in hack-001
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /already an accepted member/i);
  });
});
