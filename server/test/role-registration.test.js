import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import store from '../src/database/store.js';

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

test('HackTrack Role-Specific Registration & Security Verification', async (t) => {
  const ts = Date.now();

  // 1. Student / Participant Registration
  await t.test('1. Student registration requires Student ID and succeeds when provided', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `student_${ts}@pccoe.edu.in`,
        password: 'password123',
        fullName: 'Maya Lin',
        role: 'student',
        university: 'PCCOE Pune',
        memberId: 'STU-PCCOE-88219',
        department: 'Computer Engineering',
        yearOfStudy: '3rd Year',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'student');
    assert.equal(body.user.memberId, 'STU-PCCOE-88219');
    assert.equal(body.redirectPath, '/dashboard/student');
  });

  await t.test('2. Student registration fails with HTTP 400 when Student ID is missing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `student_noid_${ts}@pccoe.edu.in`,
        password: 'password123',
        fullName: 'Maya NoID',
        role: 'student',
        university: 'PCCOE Pune',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Student \/ Member ID is required/i);
  });

  // 2. Team Leader Registration
  await t.test('3. Team Leader registration requires Student ID and succeeds when provided', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `leader_${ts}@pccoe.edu.in`,
        password: 'password123',
        fullName: 'Alex Chen',
        role: 'leader',
        university: 'PCCOE Pune',
        memberId: 'LEAD-PCCOE-88220',
        department: 'Information Technology',
        yearOfStudy: '4th Year',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'leader');
    assert.equal(body.user.memberId, 'LEAD-PCCOE-88220');
    assert.equal(body.redirectPath, '/dashboard/leader');
  });

  await t.test('4. Team Leader registration fails with HTTP 400 when Student ID is missing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `leader_noid_${ts}@pccoe.edu.in`,
        password: 'password123',
        fullName: 'Alex NoID',
        role: 'leader',
        university: 'PCCOE Pune',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Student \/ Member ID is required/i);
  });

  // 3. Screening Committee Registration
  await t.test('5. Screening Committee registers WITHOUT Student ID using valid access code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `screening_${ts}@pccoe.edu.in`,
        password: 'password123',
        fullName: 'Dr. Marcus Vance',
        role: 'screening',
        university: 'PCCOE Pune',
        department: 'Technical Screening Committee',
        accessCode: 'SCREEN-CODE-3M2P',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'screening');
    assert.equal(body.user.memberId, null, 'Screening Committee member must have memberId === null');
    assert.equal(body.redirectPath, '/dashboard/screening');

    // Verify stored in DB store with null memberId
    const stored = store.findUserByEmail(`screening_${ts}@pccoe.edu.in`);
    assert.equal(stored.memberId, null);
  });

  await t.test('6. Screening Committee registration fails without access code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `screening_noauth_${ts}@pccoe.edu.in`,
        password: 'password123',
        fullName: 'Unauthorized Screener',
        role: 'screening',
        university: 'PCCOE Pune',
        department: 'Review Committee',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Screening Committee Access Code/i);
  });

  // 4. Judge Registration
  await t.test('7. Judge registers WITHOUT Student ID using valid access code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `judge_${ts}@acm.org`,
        password: 'password123',
        fullName: 'Prof. Elena Rostova',
        role: 'judge',
        university: 'ACM Expert Panel',
        designation: 'Staff AI Architect',
        accessCode: 'JUDGE-CODE-7X9K',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'judge');
    assert.equal(body.user.memberId, null, 'Judge must have memberId === null, never fabricated');
    assert.equal(body.redirectPath, '/dashboard/judge');

    const stored = store.findUserByEmail(`judge_${ts}@acm.org`);
    assert.equal(stored.memberId, null);
  });

  await t.test('8. Judge registration fails without access code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `judge_noauth_${ts}@test.com`,
        password: 'password123',
        fullName: 'Unauthorized Judge',
        role: 'judge',
        university: 'Tech Corp',
        designation: 'Engineer',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Judge Access Code/i);
  });

  // 5. Organizer Registration
  await t.test('9. Organizer registers WITHOUT Student ID using valid authorization key', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `organizer_${ts}@devpulse.org`,
        password: 'password123',
        fullName: 'Kavita Rao',
        role: 'organizer',
        university: 'DevPulse Operations',
        department: 'Operations Committee',
        accessCode: 'ORG-INVITE-2026',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'organizer');
    assert.equal(body.user.memberId, null, 'Organizer must have memberId === null');
    assert.equal(body.redirectPath, '/dashboard/organizer');

    const stored = store.findUserByEmail(`organizer_${ts}@devpulse.org`);
    assert.equal(stored.memberId, null);
  });

  await t.test('10. Organizer registration fails without authorization code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `organizer_noauth_${ts}@test.com`,
        password: 'password123',
        fullName: 'Unauthorized Organizer',
        role: 'organizer',
        university: 'Some Org',
        department: 'Ops',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Organizer Authorization Code/i);
  });

  // 6. Admin Security
  await t.test('11. Public registration rejects role "admin" with HTTP 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `fake_admin_${ts}@test.com`,
        password: 'password123',
        fullName: 'Hacker Admin',
        role: 'admin',
        university: 'Dark Web',
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /Public registration for Platform Administrator accounts is not permitted/i);
  });
});

