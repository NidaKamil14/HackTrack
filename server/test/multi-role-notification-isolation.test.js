import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import store from '../src/database/store.js';
import { signToken } from '../src/middleware/auth.js';
import { notifyAnnouncement } from '../src/notifications/notifier.js';

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('HackTrack Multi-Role Notification Isolation & Mentor Registration Suite', async (t) => {
  const timestamp = Date.now();

  await t.test('1. Mentor Registration: Valid credentials & authorization key succeed', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `mentor.${timestamp}@guild.org`,
        password: 'password123',
        fullName: 'Dr. Alan Vance',
        role: 'mentor',
        university: 'Global Tech Advisory Guild',
        designation: 'Distributed Systems & Cloud Architecture',
        accessCode: 'MENTOR-INVITE-2026',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'mentor');
    assert.equal(body.user.roleCategory, 'Distributed Systems & Cloud Architecture');
    assert.equal(body.user.memberId, null, 'Mentor memberId must strictly be null');
    assert.equal(body.redirectPath, '/dashboard/mentor');
  });

  await t.test('2. Mentor Registration: Rejected without authorization code or technical domain', async () => {
    // Missing code
    const resNoCode = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `mentor.nocode.${timestamp}@guild.org`,
        password: 'password123',
        fullName: 'Jane Mentor',
        role: 'mentor',
        university: 'MIT',
        designation: 'AI Specialist',
      }),
    });
    assert.equal(resNoCode.status, 400);

    // Invalid code
    const resBadCode = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `mentor.badcode.${timestamp}@guild.org`,
        password: 'password123',
        fullName: 'Jane Mentor',
        role: 'mentor',
        university: 'MIT',
        designation: 'AI Specialist',
        accessCode: 'INVALID-CODE-XYZ',
      }),
    });
    assert.equal(resBadCode.status, 400);

    // Missing designation / expertise
    const resNoDomain = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `mentor.nodomain.${timestamp}@guild.org`,
        password: 'password123',
        fullName: 'Jane Mentor',
        role: 'mentor',
        university: 'MIT',
        accessCode: 'MENTOR-INVITE-2026',
      }),
    });
    assert.equal(resNoDomain.status, 400);
  });

  await t.test('3. Brand-New Participant: Starts with 0 registrations and 0 hackathon notifications', async () => {
    const studentEmail = `fresh.student.${timestamp}@university.edu`;
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: studentEmail,
        password: 'password123',
        fullName: 'Fresh Student',
        role: 'student',
        university: 'Stanford University',
        memberId: `STU-${timestamp}`,
      }),
    });

    assert.equal(regRes.status, 201);
    const regBody = await regRes.json();
    const token = regBody.token;

    // Check my-registrations endpoint
    const myRegsRes = await fetch(`${baseUrl}/api/v1/hackathons/my-registrations`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(myRegsRes.status, 200);
    const myRegsBody = await myRegsRes.json();
    assert.equal(myRegsBody.count, 0);
    assert.deepEqual(myRegsBody.registrations, []);

    // Check notifications: user should only have the registration welcome notification, zero hackathon notifications
    const notifsRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(notifsRes.status, 200);
    const notifsBody = await notifsRes.json();
    const hackathonNotifs = notifsBody.notifications.filter(
      (n) => n.message?.toLowerCase().includes('she solves') || n.title?.toLowerCase().includes('she solves')
    );
    assert.equal(hackathonNotifs.length, 0, 'Brand-new user must NOT receive She Solves notifications');
  });

  await t.test('4. Notification Isolation Matrix across Hackathon A, B, and C', async () => {
    // 1. Register Participant A (for Hackathon A: hack-001)
    const emailA = `part.a.${timestamp}@test.edu`;
    const userA = store.createUser({
      email: emailA,
      password: 'password123',
      fullName: 'Participant A',
      role: 'student',
      university: 'Tech University',
      memberId: `ID-A-${timestamp}`,
    });
    store.registerUserForHackathon({
      hackathonId: 'hack-001',
      userId: userA.id,
      userEmail: userA.email,
      status: 'Registration Verified',
    });

    // 2. Register Participant B (for Hackathon B: hack-002)
    const emailB = `part.b.${timestamp}@test.edu`;
    const userB = store.createUser({
      email: emailB,
      password: 'password123',
      fullName: 'Participant B',
      role: 'student',
      university: 'Tech University',
      memberId: `ID-B-${timestamp}`,
    });
    store.registerUserForHackathon({
      hackathonId: 'hack-002',
      userId: userB.id,
      userEmail: userB.email,
      status: 'Registration Verified',
    });

    // 3. Register Participant C (Unregistered for any competition)
    const emailC = `part.c.${timestamp}@test.edu`;
    const userC = store.createUser({
      email: emailC,
      password: 'password123',
      fullName: 'Participant C',
      role: 'student',
      university: 'Tech University',
      memberId: `ID-C-${timestamp}`,
    });

    // Verify registrations via store.getUserRegistrations
    const regsA = store.getUserRegistrations(userA.id);
    assert.equal(regsA.length, 1);
    assert.equal(regsA[0].hackathonId, 'hack-001');

    const regsB = store.getUserRegistrations(userB.id);
    assert.equal(regsB.length, 1);
    assert.equal(regsB[0].hackathonId, 'hack-002');

    const regsC = store.getUserRegistrations(userC.id);
    assert.equal(regsC.length, 0);

    // 4. Dispatch Hackathon-Scoped Announcement for Hackathon A
    const annA = store.createAnnouncement({
      title: 'Hackathon A Exclusive Update',
      content: 'Important submission instructions for Hackathon A participants only.',
      hackathonId: 'hack-001',
      targetRole: 'student',
      createdBy: 'usr-organizer-007',
    });
    notifyAnnouncement(annA);

    // Check notifications for Participant A (registered for A)
    const notifsA = store.getUserNotifications(userA.id);
    const hasAnnA = notifsA.some((n) => n.title === 'Hackathon A Exclusive Update');
    assert.equal(hasAnnA, true, 'Participant A registered for Hackathon A MUST receive the announcement');

    // Check notifications for Participant B (registered for B)
    const notifsB = store.getUserNotifications(userB.id);
    const bHasAnnA = notifsB.some((n) => n.title === 'Hackathon A Exclusive Update');
    assert.equal(bHasAnnA, false, 'Participant B registered for Hackathon B must NOT receive Hackathon A announcement');

    // Check notifications for Participant C (unregistered)
    const notifsC = store.getUserNotifications(userC.id);
    const cHasAnnA = notifsC.some((n) => n.title === 'Hackathon A Exclusive Update');
    assert.equal(cHasAnnA, false, 'Unregistered Participant C must NOT receive Hackathon A announcement');

    // 5. Dispatch Platform-Wide Announcement
    const platformAnn = store.createAnnouncement({
      title: 'Platform Maintenance Notice',
      content: 'Scheduled maintenance for all HackTrack platform users.',
      hackathonId: null, // Global
      targetRole: 'all',
      createdBy: 'usr-admin-001',
    });
    notifyAnnouncement(platformAnn);

    const afterNotifsA = store.getUserNotifications(userA.id);
    const afterNotifsB = store.getUserNotifications(userB.id);
    const afterNotifsC = store.getUserNotifications(userC.id);

    assert.equal(afterNotifsA.some((n) => n.title === 'Platform Maintenance Notice'), true, 'User A receives platform announcement');
    assert.equal(afterNotifsB.some((n) => n.title === 'Platform Maintenance Notice'), true, 'User B receives platform announcement');
    assert.equal(afterNotifsC.some((n) => n.title === 'Platform Maintenance Notice'), true, 'User C receives platform announcement');
  });

  await t.test('5. Team-Specific Notifications: Join request delivered only to relevant Team Leader', async () => {
    // Leader creates team for hack-001
    const leaderUser = store.createUser({
      email: `leader.${timestamp}@test.edu`,
      password: 'password123',
      fullName: 'Leader One',
      role: 'leader',
      university: 'Tech University',
      memberId: `LEAD-${timestamp}`,
    });

    const team = store.createTeam({
      hackathonId: 'hack-001',
      leaderId: leaderUser.id,
      teamName: `Alpha Squad ${timestamp}`,
      track: 'Full-Stack',
    });

    // Unrelated leader
    const otherLeader = store.createUser({
      email: `other.leader.${timestamp}@test.edu`,
      password: 'password123',
      fullName: 'Leader Other',
      role: 'leader',
      university: 'Tech University',
      memberId: `LEAD-OTHER-${timestamp}`,
    });

    // Applicant requests to join team
    const applicant = store.createUser({
      email: `applicant.${timestamp}@test.edu`,
      password: 'password123',
      fullName: 'Applicant One',
      role: 'student',
      university: 'Tech University',
      memberId: `STU-APP-${timestamp}`,
    });

    // Join request via API
    const joinRes = await fetch(`${baseUrl}/api/v1/teams/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signToken(applicant)}`,
      },
      body: JSON.stringify({ teamCode: team.teamCode }),
    });

    assert.equal(joinRes.status, 201);

    // Leader One should have received notification of join request
    const leaderNotifs = store.getUserNotifications(leaderUser.id);
    const hasJoinNotif = leaderNotifs.some((n) => n.type === 'join_request_received');
    assert.equal(hasJoinNotif, true, 'Team Leader One must receive the join request notification');

    // Other Leader must NOT receive it
    const otherNotifs = store.getUserNotifications(otherLeader.id);
    const otherHasJoinNotif = otherNotifs.some((n) => n.type === 'join_request_received');
    assert.equal(otherHasJoinNotif, false, 'Unrelated Leader must NOT receive join request for Alpha Squad');
  });
});
