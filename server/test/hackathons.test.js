import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;
let adminToken;
let organizerToken;
let studentToken;
let leaderToken;
let judgeToken;
let screeningToken;

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

  // Login as team leader
  const leaderRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex@university.edu', password: 'password123' }),
  });
  const leaderData = await leaderRes.json();
  leaderToken = leaderData.token;

  // Login as judge
  const judgeRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'judge@hacktrack.io', password: 'password123' }),
  });
  const judgeData = await judgeRes.json();
  judgeToken = judgeData.token;

  // Login as screening committee member
  const screenRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'screening@hacktrack.io', password: 'password123' }),
  });
  const screenData = await screenRes.json();
  screeningToken = screenData.token;
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

  await t.test('3. Block admin from creating a hackathon (HTTP 403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Admin Created Hackathon Should Fail',
        registrationDeadline: new Date(Date.now() + 86400000).toISOString(),
        submissionDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /not authorized/i);
  });

  await t.test('4. FR-7: Reject invalid deadline chronology (reg after sub)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
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

  await t.test('5. FR-6, FR-8, FR-23: Organizer creates valid hackathon with custom team size and modules', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
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

  await t.test('6. FR-9: Organizer configures rubric evaluation criteria', async () => {
    const newCriteria = [
      { id: 'c1', name: 'Originality', maxScore: 30, weightage: 1.0 },
      { id: 'c2', name: 'Technical Depth', maxScore: 40, weightage: 1.5 },
      { id: 'c3', name: 'Presentation', maxScore: 30, weightage: 0.5 },
    ];

    const res = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}/criteria`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({ criteria: newCriteria }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.criteria.length, 3);
  });

  await t.test('7. FR-10: Organizer publishes hackathon for participant registration', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.hackathon.status, 'published');
  });

  await t.test('8. FR-11: Expired hackathon automatically flags registration as closed', async () => {
    // hack-002 had its registration deadline in the past
    const res = await fetch(`${baseUrl}/api/v1/hackathons/hack-002`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.hackathon.isRegistrationClosed, true);
    assert.equal(body.hackathon.isSubmissionClosed, true);
  });

  await t.test('9. Organizer Data Isolation: Blocks cross-organizer access to teams and codes', async () => {
    // organizerToken belongs to usr-organizer-007 (created hack-001, hack-002).
    // hack-shesolves-001 was created by usr-organizer-008.
    // 1. Trying to list teams of hack-shesolves-001:
    const teamsRes = await fetch(`${baseUrl}/api/v1/teams?hackathonId=hack-shesolves-001`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(teamsRes.status, 403);

    // 2. Trying to view team-coders-001 belonging to hack-shesolves-001:
    const teamRes = await fetch(`${baseUrl}/api/v1/teams/team-coders-001`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(teamRes.status, 403);

    // 3. Trying to access codes of hack-shesolves-001:
    const codesRes = await fetch(`${baseUrl}/api/v1/hackathons/hack-shesolves-001/codes`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(codesRes.status, 403);
  });

  await t.test('10. Team Leader successfully creates a team for Organizer published hackathon', async () => {
    const res = await fetch(`${baseUrl}/api/v1/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        hackathonId: createdHackathonId,
        teamName: 'InnovateApex 2026',
        track: 'Hardware & Software Innovation',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.team.teamName, 'InnovateApex 2026');
    assert.equal(body.team.hackathonId, createdHackathonId);
    assert.ok(body.team.teamCode.startsWith('HT-'));
  });

  await t.test('11. Team Leader rejected when creating team for nonexistent or closed hackathon', async () => {
    // Non-existent hackathon
    const nonExistRes = await fetch(`${baseUrl}/api/v1/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        hackathonId: 'hack-non-existent-999',
        teamName: 'GhostSquad',
      }),
    });
    assert.equal(nonExistRes.status, 400);
    const nonExistBody = await nonExistRes.json();
    assert.match(nonExistBody.message, /hackathon not found/i);

    // Closed hackathon (hack-002 deadline in past)
    const closedRes = await fetch(`${baseUrl}/api/v1/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        hackathonId: 'hack-002',
        teamName: 'LateSquad',
      }),
    });
    assert.equal(closedRes.status, 400);
    const closedBody = await closedRes.json();
    assert.match(closedBody.message, /deadline has passed/i);
  });

  await t.test('12. Privacy Protection: Screening code entered by Judge fails with generic error (no role leak)', async () => {
    // SCREEN-CODE-3M2P is a screening code. A judge redeeming it must receive generic error.
    const res = await fetch(`${baseUrl}/api/v1/auth/redeem-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${judgeToken}`,
      },
      body: JSON.stringify({ code: 'SCREEN-CODE-3M2P' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.message, 'Invalid or unavailable access code.');
    // Ensure no sensitive keywords leaked
    assert.ok(!JSON.stringify(body).toLowerCase().includes('screening'));
    assert.ok(!JSON.stringify(body).toLowerCase().includes('role'));
  });

  await t.test('13. Judge code entered by Judge succeeds and assigns hackathon', async () => {
    // Generate a fresh judge code for createdHackathonId
    const genRes = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}/codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({ role: 'judge' }),
    });
    assert.equal(genRes.status, 201);
    const genBody = await genRes.json();
    const judgeCode = genBody.codeRecord.code;

    const redeemRes = await fetch(`${baseUrl}/api/v1/auth/redeem-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${judgeToken}`,
      },
      body: JSON.stringify({ code: judgeCode }),
    });
    assert.equal(redeemRes.status, 200);
    const redeemBody = await redeemRes.json();
    assert.equal(redeemBody.assignment.hackathonId, createdHackathonId);
  });

  await t.test('14. Screening code entered by Screening member succeeds', async () => {
    // Generate a fresh screening code for createdHackathonId
    const genRes = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}/codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({ role: 'screening' }),
    });
    assert.equal(genRes.status, 201);
    const genBody = await genRes.json();
    const screenCode = genBody.codeRecord.code;

    const redeemRes = await fetch(`${baseUrl}/api/v1/auth/redeem-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${screeningToken}`,
      },
      body: JSON.stringify({ code: screenCode }),
    });
    assert.equal(redeemRes.status, 200);
    const redeemBody = await redeemRes.json();
    assert.equal(redeemBody.assignment.hackathonId, createdHackathonId);
  });

  await t.test('15. Admin blocked from all hackathon configuration & management endpoints (HTTP 403 Forbidden)', async () => {
    // Admin attempts to edit hackathon
    const editRes = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ title: 'Admin Tampered Title' }),
    });
    assert.equal(editRes.status, 403);

    // Admin attempts to publish hackathon
    const pubRes = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(pubRes.status, 403);

    // Admin attempts to configure criteria
    const critRes = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}/criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ criteria: [{ name: 'Admin Crit', maxScore: 50 }] }),
    });
    assert.equal(critRes.status, 403);

    // Admin attempts to generate codes
    const codeGenRes = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}/codes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: 'judge' }),
    });
    assert.equal(codeGenRes.status, 403);

    // Admin attempts to view organizer codes
    const codeGetRes = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}/codes`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(codeGetRes.status, 403);

    // Admin attempts to delete hackathon
    const delRes = await fetch(`${baseUrl}/api/v1/hackathons/${createdHackathonId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(delRes.status, 403);
  });

  await t.test('16. Participant registers for SheSolves, persists, and appears in Admin Dashboard registrations API', async () => {
    // Register fresh participant for SheSolves (hack-shesolves-001) using alias 'shesolves'
    const regRes = await fetch(`${baseUrl}/api/v1/hackathons/shesolves/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.ok(regData.registration.id);
    assert.equal(regData.registration.hackathonId, 'hack-shesolves-001');

    // Admin fetches all registrations via Admin API
    const adminRegRes = await fetch(`${baseUrl}/api/v1/admin/registrations`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRegRes.status, 200);
    const adminRegData = await adminRegRes.json();
    assert.ok(Array.isArray(adminRegData.registrations));
    const sheSolvesRegs = adminRegData.registrations.filter((r) => r.hackathonId === 'hack-shesolves-001');
    assert.ok(sheSolvesRegs.length >= 1);
    const foundPriya = sheSolvesRegs.find((r) => r.userEmail === 'priya@university.edu');
    assert.ok(foundPriya, 'Priya must appear in Admin registrations list for SheSolves');
    assert.equal(foundPriya.status, 'Registration Verified');

    // Admin queries registrations filtered by hackathonId
    const scopedRes = await fetch(`${baseUrl}/api/v1/admin/registrations?hackathonId=hack-shesolves-001`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(scopedRes.status, 200);
    const scopedData = await scopedRes.json();
    assert.ok(scopedData.registrations.every((r) => r.hackathonId === 'hack-shesolves-001'));

    // Organizer Data Isolation: organizerToken (usr-organizer-007) must NOT be able to view SheSolves (usr-organizer-008) registrations
    const orgCrossRes = await fetch(`${baseUrl}/api/v1/hackathons/hack-shesolves-001/registrations`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(orgCrossRes.status, 403);
  });

  await t.test('17. Team Leader registers for SheSolves and successfully creates team with valid Team Code', async () => {
    // 1. Leader registers for SheSolves
    const regRes = await fetch(`${baseUrl}/api/v1/hackathons/hack-shesolves-001/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    // 201 Created or 200/already registered
    assert.ok([200, 201].includes(regRes.status) || (await regRes.json()).message.includes('already'));

    // 2. Leader creates team for SheSolves using slug 'she-solves-2026'
    const teamRes = await fetch(`${baseUrl}/api/v1/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        hackathonId: 'she-solves-2026',
        teamName: 'SheTech Innovators 2026',
        track: 'AI & ML',
      }),
    });
    assert.equal(teamRes.status, 201);
    const teamData = await teamRes.json();
    assert.equal(teamData.team.hackathonId, 'hack-shesolves-001');
    assert.ok(teamData.team.teamCode.startsWith('HT-'));
    assert.equal(teamData.team.teamName, 'SheTech Innovators 2026');

    // 3. Verify team membership
    const myTeamsRes = await fetch(`${baseUrl}/api/v1/teams/mine`, {
      headers: { Authorization: `Bearer ${leaderToken}` },
    });
    assert.equal(myTeamsRes.status, 200);
    const myTeamsData = await myTeamsRes.json();
    const created = myTeamsData.teams.find((t) => t.id === teamData.team.id);
    assert.ok(created);
    assert.equal(created.hackathonId, 'hack-shesolves-001');
  });
});
