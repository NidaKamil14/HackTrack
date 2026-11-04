import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import store from '../src/database/store.js';

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

  // Login as organizer (creator of hack-001)
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
  if (server?.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test('HackTrack Admin-Controlled Organizer Invitations & Event Codes Suite', async (t) => {
  const ts = Date.now();
  let generatedCode;
  let invitationId;

  // 1. Authorization: Non-admin cannot generate organizer invitations
  await t.test('1. Non-admin cannot generate organizer invitations (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/organizers/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({ organizationName: 'Malicious Org' }),
    });
    assert.equal(res.status, 403);
  });

  // 2. Unauthenticated request is rejected (401 Unauthorized)
  await t.test('2. Unauthenticated request to organizer invitations fails (401)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/organizers/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationName: 'No Auth Org' }),
    });
    assert.equal(res.status, 401);
  });

  // 3. Admin generates an organizer invitation
  await t.test('3. Admin generates organizer authorization code with SHA-256 storage', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/organizers/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        organizationName: 'MIT Media Lab',
        intendedRecipientEmail: 'mit_lead@mit.edu',
        expiresInDays: 14,
        notes: 'Annual collegiate hackathon partnership',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.code, 'Must return plaintext code once on issuance');
    assert.match(body.code, /^ORG-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.ok(body.invitation, 'Must return invitation record');
    assert.equal(body.invitation.organizationName, 'MIT Media Lab');
    assert.equal(body.invitation.status, 'pending');
    assert.match(body.invitation.maskedCode, /^ORG-\*{4}-[A-Z0-9]{4}$/);

    // Save for subsequent tests
    generatedCode = body.code;
    invitationId = body.invitation.id;

    // Verify stored invitation in memory/store does NOT contain plaintext code
    const stored = store.organizerInvitations.find((inv) => inv.id === invitationId);
    assert.ok(stored);
    assert.equal(stored.code, undefined, 'Plaintext code must NOT be stored in memory');
    assert.ok(stored.codeHash, 'SHA-256 hash must be stored');
  });

  // 4. Admin lists organizer invitations
  await t.test('4. Admin can list all organizer invitations', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/organizers/invitations`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.invitations));
    const found = body.invitations.find((i) => i.id === invitationId);
    assert.ok(found);
    assert.equal(found.status, 'pending');
    assert.equal(found.organizationName, 'MIT Media Lab');
  });

  // 5. Organizer self-registration with valid authorization code succeeds
  await t.test('5. Organizer registers with valid generated code and redeems it', async () => {
    const orgEmail = `mit_organizer_${ts}@mit.edu`;
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: orgEmail,
        password: 'password123',
        fullName: 'Prof. John MIT',
        role: 'organizer',
        university: 'MIT',
        authorizationCode: generatedCode,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'organizer');
    assert.equal(body.user.roleCategory, 'Organizer');
    assert.equal(body.redirectPath, '/dashboard/organizer');

    // Verify invitation status transitioned to 'redeemed'
    const stored = store.organizerInvitations.find((inv) => inv.id === invitationId);
    assert.equal(stored.status, 'redeemed');
    assert.equal(stored.redeemedByUserId, body.user.id);
    assert.ok(stored.redeemedAt);
  });

  // 6. Single-use: Reusing the same authorization code fails
  await t.test('6. Reusing redeemed organizer code fails (400 Bad Request)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `another_org_${ts}@mit.edu`,
        password: 'password123',
        fullName: 'Imposter Organizer',
        role: 'organizer',
        university: 'MIT',
        authorizationCode: generatedCode,
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /already been redeemed|invalid/i);
  });

  // 7. Regex bypass prevention: Arbitrary ORG- prefixed strings are rejected
  await t.test('7. Insecure regex pattern bypass (e.g. ORG-FAKE-1234) is rejected', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `hacker_${ts}@evil.com`,
        password: 'password123',
        fullName: 'Hacker',
        role: 'organizer',
        university: 'Hacker U',
        authorizationCode: 'ORG-FAKE-1234',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /invalid or unrecognized/i);
  });

  // 8. Admin revokes an invitation code
  await t.test('8. Admin revokes invitation code and revoked code cannot be used', async () => {
    // Generate fresh code
    const createRes = await fetch(`${baseUrl}/api/v1/admin/organizers/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ organizationName: 'Temp Revoke Org' }),
    });
    assert.equal(createRes.status, 201);
    const { code: tempCode, invitation: tempInv } = await createRes.json();

    // Revoke it
    const revokeRes = await fetch(`${baseUrl}/api/v1/admin/organizers/invitations/${tempInv.id}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(revokeRes.status, 200);
    const revokeData = await revokeRes.json();
    assert.match(revokeData.message, /revoked/i);

    // Attempt to register with revoked code
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `revoked_test_${ts}@temp.edu`,
        password: 'password123',
        fullName: 'Revoked Tester',
        role: 'organizer',
        university: 'Temp Org',
        authorizationCode: tempCode,
      }),
    });
    assert.equal(regRes.status, 400);
    const regData = await regRes.json();
    assert.match(regData.message, /revoked/i);
  });

  // 9. Admin regenerates an invitation code
  await t.test('9. Admin regenerates invitation code: old is invalid, new is valid', async () => {
    // Generate initial code
    const createRes = await fetch(`${baseUrl}/api/v1/admin/organizers/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ organizationName: 'Regen Org' }),
    });
    assert.equal(createRes.status, 201);
    const { code: oldCode, invitation: initialInv } = await createRes.json();

    // Regenerate
    const regenRes = await fetch(`${baseUrl}/api/v1/admin/organizers/invitations/${initialInv.id}/regenerate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(regenRes.status, 201);
    const { code: newCode, invitation: newInv } = await regenRes.json();

    assert.notEqual(newCode, oldCode);
    assert.equal(newInv.status, 'pending');

    // Old code registration fails
    const oldRegRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `regen_old_${ts}@regen.org`,
        password: 'password123',
        fullName: 'Old Code User',
        role: 'organizer',
        university: 'Regen Org',
        authorizationCode: oldCode,
      }),
    });
    assert.equal(oldRegRes.status, 400);

    // New code registration succeeds
    const newRegRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `regen_new_${ts}@regen.org`,
        password: 'password123',
        fullName: 'New Code User',
        role: 'organizer',
        university: 'Regen Org',
        authorizationCode: newCode,
      }),
    });
    assert.equal(newRegRes.status, 201);
  });

  // 10. Direct Admin User Provisioning without codes remains fully supported
  await t.test('10. Admin can directly provision an Organizer without an invitation code', async () => {
    const directEmail = `direct_admin_org_${ts}@admincreated.org`;
    const res = await fetch(`${baseUrl}/api/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Directly Provisioned Org',
        email: directEmail,
        password: 'password123',
        role: 'organizer',
        university: 'Direct University',
        organization: 'Direct Organization',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'organizer');
    assert.equal(body.user.email, directEmail.toLowerCase());
  });

  // 11. Organizer can generate Mentor Event Code and Mentor registers with it
  await t.test('11. Organizer generates Mentor event code and Technical Mentor registers with it', async () => {
    // Generate mentor code for hack-001 (owned by organizer@hacktrack.io)
    const codeRes = await fetch(`${baseUrl}/api/v1/hackathons/hack-001/codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({ role: 'mentor' }),
    });

    assert.equal(codeRes.status, 201);
    const codeData = await codeRes.json();
    assert.equal(codeData.role, 'mentor');
    assert.match(codeData.code, /^MENTOR-/);

    // Mentor registers with the generated code
    const mentorEmail = `mentor_event_${ts}@mentornetwork.org`;
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: mentorEmail,
        password: 'password123',
        fullName: 'Dr. Mentor Jane',
        role: 'mentor',
        university: 'Tech Mentors Inc',
        domain: 'Artificial Intelligence & Cloud',
        authorizationCode: codeData.code,
      }),
    });

    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.user.role, 'mentor');
    assert.equal(regData.redirectPath, '/dashboard/mentor');
    assert.ok(regData.user.assignedHackathonIds.includes('hack-001'), 'Mentor must be assigned to hackathon');

    // Verify redemption record exists
    const codes = store.getCodesForHackathon('hack-001');
    const matched = codes.find((c) => c.code === codeData.code);
    assert.ok(matched, 'Code record must exist');
    assert.ok(matched.redeemedBy.some((r) => r.userId === regData.user.id), 'Code must be marked redeemed by mentor');
  });
});
