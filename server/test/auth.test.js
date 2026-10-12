import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

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

test('HackTrack Authentication & RBAC (FR-1 to FR-5)', async (t) => {
  const testEmail = `student_${Date.now()}@pccoe.edu.in`;
  let authToken;

  await t.test('1. FR-1: Register a new user with valid credentials', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'securePassword123',
        fullName: 'Test PCCOE Student',
        role: 'student',
        university: 'PCCOE Pune',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 201);
    assert.equal(body.user.email, testEmail.toLowerCase());
    assert.equal(body.redirectPath, '/dashboard/student');
    assert.ok(body.token, 'Must return JWT session token');
  });

  await t.test('2. FR-1: Reject registration with duplicate email address', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'securePassword123',
        fullName: 'Another Student',
        role: 'student',
      }),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.match(body.message, /already exists/i);
  });

  await t.test('3. FR-2 & FR-3: Authenticate valid user and return role redirect', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'securePassword123',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.token);
    assert.equal(body.redirectPath, '/dashboard/student');
    authToken = body.token;
  });

  await t.test('4. FR-2: Reject invalid login password', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'wrongPassword!',
      }),
    });

    assert.equal(res.status, 401);
  });

  await t.test('5. FR-4: Access protected /me endpoint with valid Bearer token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.email, testEmail.toLowerCase());
  });

  await t.test('6. FR-4: Reject access to protected endpoint without token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert.equal(res.status, 401);
  });

  await t.test('7. FR-5: Password reset workflow', async () => {
    // Request reset
    const forgotRes = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    assert.equal(forgotRes.status, 200);
    const forgotBody = await forgotRes.json();
    const token = forgotBody.resetTokenPreview;
    assert.ok(token, 'Must provide reset token in dev environment');

    // Perform reset
    const resetRes = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'brandNewPassword123' }),
    });
    assert.equal(resetRes.status, 200);

    // Verify login with new password
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'brandNewPassword123' }),
    });
    assert.equal(loginRes.status, 200);
  });
});
