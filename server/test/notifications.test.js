import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import store from '../src/database/store.js';
import { memoryProvider } from '../src/notifications/providers.js';
import { waitForEmailIdle } from '../src/notifications/emailQueue.js';
import { renderEmail } from '../src/notifications/templates.js';
import { signUnsubscribe } from '../src/notifications/notifier.js';

// Email delivery uses the in-memory provider automatically under `node --test`
// (see notifications/config.js); no real email is ever sent from tests.
process.env.EMAIL_PROVIDER = 'memory';

let server;
let baseUrl;

const api = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, body: json, text };
};

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

async function registerUser(role, fullName) {
  const email = `${role}_${unique()}@pccoe.edu.in`;
  const res = await api('/api/v1/auth/register', {
    method: 'POST',
    body: { email, password: 'password123', fullName, role, university: 'PCCOE' },
  });
  assert.equal(res.status, 201, `register ${role}: ${JSON.stringify(res.body)}`);
  await settle();
  return { token: res.body.token, id: res.body.user.id, email, fullName };
}

async function login(email) {
  const res = await api('/api/v1/auth/login', { method: 'POST', body: { email, password: 'password123' } });
  return res.body.token;
}

const sentTo = (email) => memoryProvider.sent.filter((m) => m.to === email);
const settle = () => waitForEmailIdle(3000);

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(() => memoryProvider.reset());

test('Email notifications for team, submission, results and admin workflows', async (t) => {
  const leader = await registerUser('leader', 'Shruti Mane');
  const member = await registerUser('student', 'Aarav Deshmukh');
  const second = await registerUser('student', 'Nida Kamil');
  const outsider = await registerUser('student', 'Mandar Patil');
  let team;
  let firstRequestId;

  await t.test('team created → the leader receives a branded email without the invite code', async () => {
    const res = await api('/api/v1/teams', {
      method: 'POST', token: leader.token,
      body: { hackathonId: 'hack-001', teamName: 'Byte <Brigade>', track: 'AI' },
    });
    assert.equal(res.status, 201);
    team = res.body.team;
    await settle();

    const mails = sentTo(leader.email);
    assert.equal(mails.length, 1);
    assert.match(mails[0].subject, /Byte <Brigade>/);
    // HTML is escaped, plain-text alternative exists, invite code never included
    assert.ok(mails[0].html.includes('Byte &lt;Brigade&gt;'));
    assert.ok(!mails[0].html.includes('<Brigade>'));
    assert.ok(mails[0].text.includes('Hi Shruti,'));
    assert.ok(!mails[0].html.includes(team.teamCode) && !mails[0].text.includes(team.teamCode));
    assert.ok(mails[0].headers['List-Unsubscribe']);

    const inApp = store.getUserNotifications(leader.id).find((n) => n.type === 'team_created');
    assert.equal(inApp.emailStatus, 'sent');
  });

  await t.test('join request → requester gets a confirmation and leader gets an action email', async () => {
    const res = await api('/api/v1/teams/join', { method: 'POST', token: member.token, body: { teamCode: team.teamCode } });
    assert.equal(res.status, 201);
    firstRequestId = res.body.request.id;
    await settle();

    assert.equal(sentTo(member.email).length, 1);
    assert.match(sentTo(member.email)[0].subject, /Request sent to join/);
    const leaderMail = sentTo(leader.email);
    assert.equal(leaderMail.length, 1);
    assert.match(leaderMail[0].subject, /Aarav Deshmukh wants to join/);
    // The requester's email address is not disclosed to the leader
    assert.ok(!leaderMail[0].html.includes(member.email));
    // Nobody else is emailed
    assert.equal(memoryProvider.sent.length, 2);
  });

  await t.test('unauthorized users cannot trigger decision emails', async () => {
    const res = await api(`/api/v1/teams/${team.id}/requests/${firstRequestId}`, {
      method: 'PUT', token: outsider.token, body: { action: 'accept' },
    });
    assert.equal(res.status, 400);
    await settle();
    assert.equal(memoryProvider.sent.length, 0);
  });

  await t.test('approval → requester notified; repeating the same approval sends nothing new', async () => {
    const res = await api(`/api/v1/teams/${team.id}/requests/${firstRequestId}`, {
      method: 'PUT', token: leader.token, body: { action: 'accept' },
    });
    assert.equal(res.status, 200);
    await settle();
    assert.equal(sentTo(member.email).length, 1);
    assert.match(sentTo(member.email)[0].subject, /You’re on the team/);
    assert.equal(sentTo(leader.email).length, 0, 'the leader who acted is not emailed');

    // Retried request (same decision) must not produce duplicate emails
    await api(`/api/v1/teams/${team.id}/requests/${firstRequestId}`, { method: 'PUT', token: leader.token, body: { action: 'accept' } });
    await settle();
    assert.equal(memoryProvider.sent.length, 1);
  });

  await t.test('a second member joining notifies existing members (not the new member or the leader)', async () => {
    const join = await api('/api/v1/teams/join', { method: 'POST', token: second.token, body: { teamCode: team.teamCode } });
    await api(`/api/v1/teams/${team.id}/requests/${join.body.request.id}`, { method: 'PUT', token: leader.token, body: { action: 'accept' } });
    await settle();
    const joinedMails = memoryProvider.sent.filter((m) => /joined “Byte <Brigade>”/.test(m.subject));
    assert.deepEqual(joinedMails.map((m) => m.to), [member.email]);
  });

  await t.test('rejection → requester receives a decline email', async () => {
    const join = await api('/api/v1/teams/join', { method: 'POST', token: outsider.token, body: { teamCode: team.teamCode } });
    await settle(); // let the join-request emails finish before counting decision emails
    memoryProvider.reset();
    await api(`/api/v1/teams/${team.id}/requests/${join.body.request.id}`, { method: 'PUT', token: leader.token, body: { action: 'reject' } });
    await settle();
    assert.equal(sentTo(outsider.email).length, 1);
    assert.match(sentTo(outsider.email)[0].subject, /Update on your request/);
  });

  await t.test('submission → every accepted member; edits are throttled', async () => {
    const body = { teamId: team.id, projectTitle: 'Carbon Lens', abstract: 'Tracks campus emissions.' };
    const first = await api('/api/v1/submissions', { method: 'POST', token: leader.token, body });
    assert.equal(first.status, 201);
    await settle();
    const received = memoryProvider.sent.filter((m) => /Submission received/.test(m.subject)).map((m) => m.to).sort();
    assert.deepEqual(received, [leader.email, member.email, second.email].sort());

    memoryProvider.reset();
    await api('/api/v1/submissions', { method: 'POST', token: leader.token, body: { ...body, abstract: 'v2' } });
    await api('/api/v1/submissions', { method: 'POST', token: leader.token, body: { ...body, abstract: 'v3' } });
    await settle();
    // Two quick edits → one "updated" email per member, not two
    assert.equal(memoryProvider.sent.filter((m) => /Submission updated/.test(m.subject)).length, 3);
  });

  await t.test('preferences are respected and validated', async () => {
    const memberToken = member.token;
    const bad = await api('/api/v1/notifications/preferences', { method: 'PUT', token: memberToken, body: { nope: false } });
    assert.equal(bad.status, 400);
    const off = await api('/api/v1/notifications/preferences', { method: 'PUT', token: memberToken, body: { submissions: false } });
    assert.equal(off.status, 200);
    assert.equal(off.body.preferences.submissions, false);

    // Force a new "updated" window by clearing the throttle key for this test
    for (const k of [...store.notificationKeys]) if (k.startsWith('submission_updated')) store.notificationKeys.delete(k);
    memoryProvider.reset();
    await api('/api/v1/submissions', { method: 'POST', token: leader.token, body: { teamId: team.id, projectTitle: 'Carbon Lens', abstract: 'v4' } });
    await settle();
    assert.equal(sentTo(member.email).length, 0, 'opted-out member gets no email');
    assert.equal(sentTo(second.email).length, 1, 'other members still do');
    const skipped = store.getUserNotifications(member.id).find((n) => n.type === 'submission_updated' && n.emailStatus === 'skipped');
    assert.ok(skipped, 'in-app notification is still recorded, with email marked skipped');
    await api('/api/v1/notifications/preferences', { method: 'PUT', token: memberToken, body: { submissions: true } });
  });

  await t.test('signed unsubscribe links work; tampered links are rejected', async () => {
    const good = await api(`/api/v1/notifications/unsubscribe?u=${second.id}&c=announcements&s=${signUnsubscribe(second.id, 'announcements')}`);
    assert.equal(good.status, 200);
    assert.equal(store.getEmailPreferences(second.id, ['announcements']).announcements, false);
    const tampered = await api(`/api/v1/notifications/unsubscribe?u=${member.id}&c=announcements&s=${signUnsubscribe(second.id, 'announcements')}`);
    assert.equal(tampered.status, 400);
    assert.equal(store.getEmailPreferences(member.id, ['announcements']).announcements, true);
  });

  await t.test('provider failure never undoes the business operation; failed emails can be retried', async () => {
    const newcomer = await registerUser('student', 'Riya Kulkarni');
    memoryProvider.reset();
    memoryProvider.failures.push({ transient: false, message: 'Simulated 422 from provider' });
    const res = await api('/api/v1/teams/join', { method: 'POST', token: newcomer.token, body: { teamCode: team.teamCode } });
    assert.equal(res.status, 201, 'join request still succeeds');
    await settle();
    const failed = store.getUserNotifications(newcomer.id).find((n) => n.type === 'join_request_submitted');
    assert.equal(failed.emailStatus, 'failed');
    assert.match(failed.emailStatusReason, /Simulated/);
    assert.ok(store.teamMembers.find((m) => m.id === res.body.request.id), 'membership request persisted');

    const adminToken = await login('admin@hacktrack.io');
    const forbidden = await api('/api/v1/notifications/email/retry-failed', { method: 'POST', token: newcomer.token });
    assert.equal(forbidden.status, 403);
    const retry = await api('/api/v1/notifications/email/retry-failed', { method: 'POST', token: adminToken });
    assert.ok(retry.body.requeued >= 1);
    await settle();
    assert.equal(store.findNotificationById(failed.id).emailStatus, 'sent');
  });

  await t.test('transient failures are retried automatically', async () => {
    const solo = await registerUser('leader', 'Kiran Joshi');
    memoryProvider.reset();
    memoryProvider.failures.push({ transient: true, message: 'HTTP 503' });
    await api('/api/v1/teams', { method: 'POST', token: solo.token, body: { hackathonId: 'hack-001', teamName: 'Retry Rangers' } });
    await settle();
    const n = store.getUserNotifications(solo.id).find((x) => x.type === 'team_created');
    assert.equal(n.emailStatus, 'sent');
    assert.equal(n.emailAttempts, 2);
    assert.equal(sentTo(solo.email).length, 1);
  });

  await t.test('missing or invalid email addresses are skipped safely', async () => {
    const noMail = await registerUser('leader', 'No Mail');
    memoryProvider.reset();
    store.findUserById(noMail.id).email = 'not-an-email';
    await api('/api/v1/teams', { method: 'POST', token: noMail.token, body: { hackathonId: 'hack-001', teamName: 'Silent Squad' } });
    await settle();
    const n = store.getUserNotifications(noMail.id).find((x) => x.type === 'team_created');
    assert.equal(n.emailStatus, 'skipped');
    assert.match(n.emailStatusReason, /No valid email/);
    assert.equal(memoryProvider.sent.length, 0);
  });

  await t.test('announcements: admin only, scoped to the hackathon audience', async () => {
    const studentRes = await api('/api/v1/admin/announcements', {
      method: 'POST', token: member.token, body: { hackathonId: 'hack-001', title: 'Spam', content: 'x' },
    });
    assert.equal(studentRes.status, 403);
    await settle();
    assert.equal(memoryProvider.sent.length, 0, 'unauthorized announcement sends nothing');

    const adminToken = await login('admin@hacktrack.io');
    const res = await api('/api/v1/admin/announcements', {
      method: 'POST', token: adminToken,
      body: { hackathonId: 'hack-001', title: 'Deadline extended', content: 'Submissions now close 2 hours later.', targetRole: 'all' },
    });
    assert.equal(res.status, 201);
    await settle();
    const recipients = memoryProvider.sent.map((m) => m.to);
    assert.ok(recipients.includes(member.email), 'accepted participant receives it');
    assert.ok(!recipients.includes(second.email), 'opted-out participant does not');
    const unrelated = await registerUser('student', 'Unrelated Student');
    assert.ok(!recipients.includes(unrelated.email), 'users outside the hackathon are not emailed');
    assert.ok(!recipients.includes('admin@hacktrack.io'), 'the author is not emailed');
  });

  await t.test('results published → members get results + certificate email once', async () => {
    const adminToken = await login('admin@hacktrack.io');
    const res = await api('/api/v1/evaluations/publish-results/hack-001', { method: 'POST', token: adminToken });
    assert.equal(res.status, 200);
    await settle();
    const mine = sentTo(member.email);
    assert.equal(mine.length, 1);
    assert.match(mine[0].subject, /Results are out/);
    assert.match(mine[0].text, /certificate has been issued/);

    memoryProvider.reset();
    await api('/api/v1/evaluations/publish-results/hack-001', { method: 'POST', token: adminToken });
    await settle();
    assert.equal(memoryProvider.sent.length, 0, 're-publishing does not resend');
  });

  await t.test('access-code redemption → reviewer and the issuing organizer', async () => {
    const judgeToken = await login('judge@hacktrack.io');
    const res = await api('/api/v1/auth/redeem-code', { method: 'POST', token: judgeToken, body: { code: 'JUDGE-PCCO-8A4B' } });
    assert.equal(res.status, 200);
    await settle();
    assert.equal(sentTo('judge@hacktrack.io').length, 1);
    assert.equal(sentTo('organizer@hacktrack.io').length, 1);
    assert.ok(!sentTo('judge@hacktrack.io')[0].html.includes('JUDGE-PCCO-8A4B'), 'access code not included in email');
  });

  await t.test('notifications API returns only the caller’s notifications with email status', async () => {
    const res = await api('/api/v1/notifications', { token: member.token });
    assert.equal(res.status, 200);
    assert.ok(res.body.notifications.length > 0);
    assert.ok(res.body.notifications.every((n) => store.findNotificationById(n.id).userId === member.id));
    assert.ok(res.body.notifications.every((n) => n.email && 'status' in n.email));
    assert.ok(!JSON.stringify(res.body).includes(member.email), 'no addresses in API payload');

    const first = res.body.notifications[0];
    const read = await api(`/api/v1/notifications/${first.id}/read`, { method: 'PATCH', token: member.token });
    assert.equal(read.status, 200);
    const othersAttempt = await api(`/api/v1/notifications/${first.id}/read`, { method: 'PATCH', token: second.token });
    assert.equal(othersAttempt.status, 404, 'cannot touch another user’s notification');
    const unauthenticated = await api('/api/v1/notifications');
    assert.equal(unauthenticated.status, 401);
  });
});

test('development console provider is never reported as "sent"', async () => {
  const previous = process.env.EMAIL_PROVIDER;
  process.env.EMAIL_PROVIDER = 'console';
  const originalLog = console.log;
  console.log = () => {}; // keep test output clean
  try {
    const leader = await registerUser('leader', 'Dev Console');
    await api('/api/v1/teams', { method: 'POST', token: leader.token, body: { hackathonId: 'hack-001', teamName: 'Log Only' } });
    await settle();
    const n = store.getUserNotifications(leader.id).find((x) => x.type === 'team_created');
    assert.equal(n.emailStatus, 'skipped');
    assert.match(n.emailStatusReason, /no email provider is configured/);
  } finally {
    console.log = originalLog;
    if (previous === undefined) delete process.env.EMAIL_PROVIDER; else process.env.EMAIL_PROVIDER = previous;
  }
});

test('templates render every event with subject, CTA and plain text', () => {
  const recipient = { fullName: 'Priya Sharma' };
  const hackathon = { id: 'hack-001', title: 'CodeSprint' };
  const team = { teamName: 'Team <X>' };
  const opts = { frontendUrl: 'https://app.example', unsubscribeUrl: 'https://api.example/u', categoryLabel: 'Team activity' };
  const cases = {
    team_created: { team, hackathon },
    join_request_submitted: { team, hackathon },
    join_request_received: { team, hackathon, requester: { fullName: 'A B' } },
    join_request_approved: { team, hackathon },
    join_request_rejected: { team, hackathon },
    team_member_joined: { team, hackathon, member: { fullName: 'C D' } },
    submission_received: { team, hackathon, submission: { projectTitle: 'P' } },
    submission_updated: { team, hackathon, submission: { projectTitle: 'P' } },
    judge_assigned: { hackathon, submission: { projectTitle: 'P' } },
    results_published: { hackathon, team, rank: 2, certificate: { certificateType: 'runner_up' } },
    announcement: { hackathon, announcement: { title: 'T', content: 'C' } },
    access_granted: { hackathon, role: 'judge' },
    reviewer_joined: { hackathon, role: 'screening', reviewer: { fullName: 'E F' } },
    user_registered: { user: { fullName: 'Priya Sharma', role: 'student', roleCategory: 'Participant' } },
    certificate_issued: { certificate: { participantName: 'Priya Sharma', certificateType: 'participation', hackathonTitle: 'CodeSprint' }, hackathon },
  };
  for (const [type, data] of Object.entries(cases)) {
    const email = renderEmail(type, { recipient, ...data }, opts);
    assert.ok(email.subject.length > 5, `${type} subject`);
    assert.ok(email.html.includes('https://app.example'), `${type} CTA link`);
    assert.ok(email.text.includes('Hi Priya,'), `${type} plain text greeting`);
    assert.ok(!email.html.includes('<X>'), `${type} escapes HTML`);
  }
});

test('user registration sends confirmation email to new user', async () => {
  memoryProvider.reset();
  const res = await api('/api/v1/auth/register', {
    method: 'POST',
    body: {
      email: `welcome_${unique()}@pccoe.edu.in`,
      password: 'password123',
      fullName: 'Aayush Phadke',
      role: 'student',
      university: 'PCCOE',
    },
  });
  assert.equal(res.status, 201);
  await settle();

  const mails = sentTo(res.body.user.email);
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /Welcome to HackTrack/);
  assert.ok(mails[0].text.includes('Aayush Phadke'));
  assert.ok(mails[0].html.includes('Go to your dashboard'));

  const n = store.getUserNotifications(res.body.user.id).find((x) => x.type === 'user_registered');
  assert.ok(n);
  assert.equal(n.emailStatus, 'sent');
});

test('certificate availability notification emails recipient', async () => {
  const certUser = await registerUser('student', 'Cert Recipient');
  memoryProvider.reset();
  const cert = {
    id: `cert-test-${unique()}`,
    certificateCode: `HT-CERT-${unique()}`,
    hackathonId: 'hack-001',
    userId: certUser.id,
    teamId: 'team-001',
    certificateType: 'participation',
    participantName: 'Cert Recipient',
    hackathonTitle: 'CodeSprint 2026',
    issuedAt: new Date().toISOString(),
  };

  const { notifyCertificateIssued } = await import('../src/notifications/notifier.js');
  notifyCertificateIssued(cert);
  await settle();

  const mails = sentTo(certUser.email);
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /Your Certificate for CodeSprint Global 2026 is ready/);
  assert.ok(mails[0].text.includes('Cert Recipient'));
  assert.ok(mails[0].html.includes('View Certificate'));
});

test('Resend provider: sends payload correctly and parses message id', async () => {
  const originalFetch = global.fetch;
  const originalProvider = process.env.EMAIL_PROVIDER;
  const originalKey = process.env.EMAIL_API_KEY;

  process.env.EMAIL_PROVIDER = 'resend';
  process.env.EMAIL_API_KEY = 're_test_mock_123';

  let capturedUrl = null;
  let capturedHeaders = null;
  let capturedBody = null;

  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options.headers;
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 're-msg-12345' }),
    };
  };

  try {
    const { getProvider } = await import('../src/notifications/providers.js');
    const provider = getProvider();
    assert.equal(provider.name, 'resend');

    const result = await provider.send({
      to: 'student@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
      headers: { 'X-Test': 'true' },
    });

    assert.equal(result.id, 're-msg-12345');
    assert.equal(capturedUrl, 'https://api.resend.com/emails');
    assert.equal(capturedHeaders['Authorization'], 'Bearer re_test_mock_123');
    assert.deepEqual(capturedBody.to, ['student@example.com']);
    assert.equal(capturedBody.subject, 'Test Subject');
  } finally {
    global.fetch = originalFetch;
    process.env.EMAIL_PROVIDER = originalProvider;
    process.env.EMAIL_API_KEY = originalKey;
  }
});

test('Resend provider: extracts error message on HTTP 422/403 failure', async () => {
  const originalFetch = global.fetch;
  const originalProvider = process.env.EMAIL_PROVIDER;
  const originalKey = process.env.EMAIL_API_KEY;

  process.env.EMAIL_PROVIDER = 'resend';
  process.env.EMAIL_API_KEY = 're_test_mock_123';

  global.fetch = async () => ({
    ok: false,
    status: 422,
    json: async () => ({
      statusCode: 422,
      name: 'validation_error',
      message: 'The from domain is not verified',
    }),
  });

  try {
    const { getProvider } = await import('../src/notifications/providers.js');
    const provider = getProvider();
    await assert.rejects(
      () => provider.send({ to: 'student@example.com', subject: 'Test', html: '<p>Hi</p>', text: 'Hi' }),
      (err) => {
        assert.equal(err.name, 'EmailDeliveryError');
        assert.ok(err.message.includes('The from domain is not verified'));
        assert.equal(err.transient, false);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
    process.env.EMAIL_PROVIDER = originalProvider;
    process.env.EMAIL_API_KEY = originalKey;
  }
});
