import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;
let adminToken;
let studentToken;
let organizerToken;

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

  // Login as student
  const studentRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya@university.edu', password: 'password123' }),
  });
  const studentData = await studentRes.json();
  studentToken = studentData.token;

  // Login as organizer
  const orgRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'organizer@hacktrack.io', password: 'password123' }),
  });
  const orgData = await orgRes.json();
  organizerToken = orgData.token;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('HackTrack Admin, Reports, Announcements & Certificates (FR-32 to FR-46)', async (t) => {
  await t.test('1. FR-42: Admin lists registered users', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.users));
    assert.ok(data.users.length >= 6);
  });

  await t.test('2. FR-42 & RBAC: Non-admin rejected from admin endpoints', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 403);
  });

  await t.test('3. FR-41: Admin fetches platform system statistics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.stats);
    assert.ok(typeof data.stats.totalUsers === 'number');
    assert.ok(typeof data.stats.totalHackathons === 'number');
    assert.ok(typeof data.stats.totalTeams === 'number');
  });

  await t.test('4. FR-40: Admin generates detailed hackathon report', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/reports/hackathon/hack-001`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.report.hackathonId, 'hack-001');
    assert.ok(Array.isArray(data.report.leaderboard));
  });

  await t.test('5. FR-46: Admin posts broadcast announcement', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        hackathonId: 'hack-001',
        title: 'Evaluation Schedule Finalized',
        content: 'Presentations commence at 3 PM IST.',
        targetRole: 'all',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.announcement.title, 'Evaluation Schedule Finalized');
  });

  await t.test('6. FR-46: Public/authenticated users retrieve announcements', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/announcements?hackathonId=hack-001`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.announcements.length >= 1);
  });

  await t.test('7. FR-32 & FR-34: Participant views their issued certificates', async () => {
    // Admin attempt to publish results is forbidden (HTTP 403)
    const adminAttempt = await fetch(`${baseUrl}/api/v1/evaluations/publish-results/hack-001`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminAttempt.status, 403);

    // Authorized Organizer publishes results to trigger certificate generation for hack-001
    const orgRes = await fetch(`${baseUrl}/api/v1/evaluations/publish-results/hack-001`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(orgRes.status, 200);

    const res = await fetch(`${baseUrl}/api/v1/certificates/my-certificates`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.certificates));
  });

  await t.test('8. FR-33: Public certificate verification endpoint', async () => {
    // Check verification with seeded or generated certificate
    const verifyRes = await fetch(`${baseUrl}/api/v1/certificates/verify/CERT-NONEXISTENT`);
    assert.equal(verifyRes.status, 404);
  });
});
