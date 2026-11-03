import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import analyticsStore, { normalisePath, resolvePeriod, trend, monthOverMonth } from '../src/analytics/analyticsStore.js';

// Platform Traffic Analytics: ingestion validation, privacy, exclusion rules,
// aggregation and authorization. Events are recorded in memory only (MySQL
// writes are disabled under `node --test`).

let server;
let baseUrl;
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

const api = async (path, { method = 'GET', token, body, headers = {}, raw } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'User-Agent': BROWSER_UA,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json };
};

const id = (seed) => `${seed}-${'x'.repeat(20)}`.slice(0, 32);
const collect = (payload, opts = {}) => api('/api/v1/analytics/collect', { method: 'POST', body: payload, ...opts });

async function login(email) {
  const res = await api('/api/v1/auth/login', { method: 'POST', body: { email, password: 'password123' } });
  assert.equal(res.status, 200, `login ${email}`);
  return res.body.token;
}

async function registerStudent() {
  const email = `analytics_${Date.now()}${Math.floor(Math.random() * 1e6)}@pccoe.edu.in`;
  const res = await api('/api/v1/auth/register', {
    method: 'POST',
    body: { email, password: 'password123', fullName: 'Analytics Student', role: 'student', university: 'PCCOE' },
  });
  assert.equal(res.status, 201);
  return res.body.token;
}

let organizerToken; // owns hack-001 and hack-002
let otherOrganizerToken; // owns hack-shesolves-001
let adminToken;
let studentToken;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  organizerToken = await login('organizer@hacktrack.io');
  otherOrganizerToken = await login('marcus.ai@hacktrack.io');
  adminToken = await login('admin@hacktrack.io');
  studentToken = await registerStudent();
});

test.after(() => new Promise((resolve) => server.close(resolve)));
test.beforeEach(() => analyticsStore.reset());

test('Path normalisation drops query strings and maps routes to templates', () => {
  assert.deepEqual(normalisePath('/reset-password?token=secret123'), { page: '/reset-password', hackathonRef: null });
  assert.deepEqual(normalisePath('/hackathons/hack-001'), { page: '/hackathons/:id', hackathonRef: 'hack-001' });
  assert.deepEqual(normalisePath('/dashboard/organizer'), { page: '/dashboard', hackathonRef: null });
  assert.equal(normalisePath('/somewhere/else').page, 'other');
  assert.equal(normalisePath('https://evil.example/x'), null);
  assert.equal(normalisePath(''), null);
});

test('A valid page view is recorded with hashed identifiers only', async () => {
  const res = await collect({ path: '/hackathons/hack-001?utm=x', visitorId: id('visitor-a'), sessionId: id('session-a'), referrer: 'search' });
  assert.equal(res.status, 202);
  assert.equal(analyticsStore.events.length, 1);
  const ev = analyticsStore.events[0];
  assert.equal(ev.page, '/hackathons/:id');
  assert.equal(ev.hackathonId, 'hack-001');
  assert.equal(ev.referrer, 'search');
  assert.equal(ev.device, 'desktop');
  assert.notEqual(ev.visitorHash, id('visitor-a'), 'raw visitor id must not be stored');
  assert.match(ev.visitorHash, /^[a-f0-9]{32}$/);
  const stored = JSON.stringify(ev);
  assert.ok(!stored.includes('utm') && !stored.includes('visitor-a') && !stored.includes('127.0.0.1') && !stored.includes('Chrome'));
});

test('Text/plain bodies (no-preflight beacons) are accepted', async () => {
  const res = await api('/api/v1/analytics/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    raw: JSON.stringify({ path: '/', visitorId: id('beacon'), sessionId: id('beacon-s') }),
  });
  assert.equal(res.status, 202);
  assert.equal(analyticsStore.events.length, 1);
});

test('Invalid input is rejected with 400', async () => {
  assert.equal((await collect({ path: 'not-a-path' })).status, 400);
  assert.equal((await collect({})).status, 400);
  assert.equal((await collect({ path: '/', type: 'purchase' })).status, 400);
  assert.equal((await collect({ path: '/', visitorId: 'short' })).status, 400);
  assert.equal((await collect({ path: '/', visitorId: '<script>alert(1)</script>-xxxxxxxx' })).status, 400);
  const bad = await api('/api/v1/analytics/collect', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, raw: '{not json' });
  assert.equal(bad.status, 400);
  assert.equal(analyticsStore.events.length, 0);
});

test('Bots, signed-in staff and unknown events are not counted', async () => {
  await collect({ path: '/', visitorId: id('bot') }, { headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' } });
  await collect({ path: '/', visitorId: id('nobody') }, { headers: { 'User-Agent': '' } });
  await collect({ path: '/hackathons/hack-001', visitorId: id('staff') }, { token: organizerToken });
  await collect({ path: '/hackathons/does-not-exist-anywhere-zzz', visitorId: id('typo') });
  assert.equal(analyticsStore.events.length, 0);

  // A signed-in participant is a genuine visitor.
  const res = await collect({ path: '/hackathons', visitorId: id('participant'), sessionId: id('participant-s') }, { token: studentToken });
  assert.equal(res.status, 202);
  assert.equal(analyticsStore.events.length, 1);
});

test('Repeated views of the same page in the same session are deduplicated', async () => {
  const payload = { path: '/hackathons/hack-002', visitorId: id('dup-v'), sessionId: id('dup-s') };
  await collect(payload);
  await collect(payload);
  await collect(payload);
  assert.equal(analyticsStore.events.length, 1);
  await collect({ ...payload, path: '/hackathons' });
  assert.equal(analyticsStore.events.length, 2);
});

test('Ingestion is rate limited per client', async () => {
  process.env.ANALYTICS_RATE_PER_MINUTE = '5';
  try {
    const statuses = [];
    for (let i = 0; i < 7; i += 1) {
      statuses.push((await collect({ path: '/', sessionId: id(`rate-${i}`) })).status);
    }
    assert.deepEqual(statuses.slice(0, 5), [202, 202, 202, 202, 202]);
    assert.equal(statuses[5], 429);
    assert.equal(statuses[6], 429);
  } finally {
    delete process.env.ANALYTICS_RATE_PER_MINUTE;
  }
});

test('Platform analytics separates page views, sessions and unique visitors', async () => {
  // Visitor A: 2 sessions, 3 page views. Visitor B: 1 session, 1 view (phone).
  await collect({ path: '/', visitorId: id('A'), sessionId: id('A1') });
  await collect({ path: '/hackathons', visitorId: id('A'), sessionId: id('A1') });
  await collect({ path: '/', visitorId: id('A'), sessionId: id('A2') });
  await collect({ path: '/hackathons/hack-001', visitorId: id('B'), sessionId: id('B1') }, { headers: { 'User-Agent': PHONE_UA } });
  // Visitor without consent: counted as a page view only.
  await collect({ path: '/login' });

  const res = await api('/api/v1/analytics/platform?range=7d', { token: organizerToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.totals.pageViews, 5);
  assert.equal(res.body.totals.sessions, 3);
  assert.equal(res.body.totals.uniqueVisitors, 2);
  assert.equal(res.body.totals.identifiedPageViews, 4);
  assert.equal(res.body.last7Days.uniqueVisitors, 2);
  assert.equal(res.body.devices.mobile, 1);
  assert.equal(res.body.period.timezone, 'UTC');
  assert.equal(res.body.trend.length, 7);
  assert.equal(res.body.trend.reduce((s, d) => s + d.pageViews, 0), 5);
  assert.equal(res.body.growth.available, false, 'growth needs 60 days of history');
  assert.ok(!JSON.stringify(res.body).match(/[a-f0-9]{32}/), 'no hashed identifiers in the response');

  const admin = await api('/api/v1/analytics/platform?range=all', { token: adminToken });
  assert.equal(admin.status, 200);
  assert.equal(admin.body.allTime.pageViews, 5);
});

test('Empty analytics return zeros and no fabricated growth', async () => {
  const res = await api('/api/v1/analytics/platform?range=30d', { token: organizerToken });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.totals, { pageViews: 0, sessions: 0, uniqueVisitors: 0, identifiedPageViews: 0 });
  assert.equal(res.body.trackingSince, null);
  assert.equal(res.body.growth.available, false);
  assert.ok(res.body.trend.every((d) => d.pageViews === 0));
});

test('Participants, judges and anonymous callers cannot read analytics', async () => {
  const judgeToken = await login('judge@hacktrack.io');
  for (const path of ['/api/v1/analytics/platform', '/api/v1/analytics/events', '/api/v1/analytics/events/hack-001']) {
    assert.equal((await api(path)).status, 401, `anonymous ${path}`);
    assert.equal((await api(path, { token: studentToken })).status, 403, `student ${path}`);
    assert.equal((await api(path, { token: judgeToken })).status, 403, `judge ${path}`);
  }
});

test('Organizers see only their own events; another organizer’s event is 404', async () => {
  await collect({ path: '/hackathons/hack-001', visitorId: id('E1'), sessionId: id('E1s') });
  await collect({ path: '/hackathons/hack-shesolves-001', visitorId: id('E2'), sessionId: id('E2s') });

  const own = await api('/api/v1/analytics/events?range=30d', { token: organizerToken });
  assert.equal(own.status, 200);
  const ids = own.body.events.map((e) => e.hackathonId);
  assert.ok(ids.includes('hack-001'));
  assert.ok(!ids.includes('hack-shesolves-001'), 'must not include another organizer’s event');
  assert.equal(own.body.events.find((e) => e.hackathonId === 'hack-001').detailPageViews, 1);

  // organizerId is ignored for organizers (cannot be used to read someone else's events)
  const spoof = await api('/api/v1/analytics/events?organizerId=usr-organizer-008', { token: organizerToken });
  assert.ok(!spoof.body.events.some((e) => e.hackathonId === 'hack-shesolves-001'));

  assert.equal((await api('/api/v1/analytics/events/hack-shesolves-001', { token: organizerToken })).status, 404);
  assert.equal((await api('/api/v1/analytics/events/hack-001', { token: otherOrganizerToken })).status, 404);
  assert.equal((await api('/api/v1/analytics/events/no-such-event', { token: organizerToken })).status, 404);

  const detail = await api('/api/v1/analytics/events/hack-001?range=7d', { token: organizerToken });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.event.detailPageViews, 1);
  assert.equal(detail.body.event.trend.length, 7);
  assert.equal(detail.body.event.conversionRatePct, null, 'too few visitors for a conversion rate');

  // Admins can see every event, or filter by organizer.
  const adminAll = await api('/api/v1/analytics/events', { token: adminToken });
  assert.ok(adminAll.body.events.some((e) => e.hackathonId === 'hack-shesolves-001'));
  const adminFiltered = await api('/api/v1/analytics/events?organizerId=usr-organizer-008', { token: adminToken });
  assert.ok(adminFiltered.body.events.every((e) => e.hackathonId !== 'hack-001'));
});

test('Conversion rate uses registrations over estimated unique visitors once there is enough data', async () => {
  for (let i = 0; i < 10; i += 1) {
    await collect({ path: '/hackathons/hack-001', visitorId: id(`conv-${i}`), sessionId: id(`conv-s-${i}`) });
  }
  const res = await api('/api/v1/analytics/events/hack-001?range=30d', { token: organizerToken });
  const ev = res.body.event;
  assert.equal(ev.uniqueVisitors, 10);
  assert.equal(typeof ev.registrations.inPeriod, 'number');
  assert.equal(ev.conversionRatePct, Math.round((ev.registrations.inPeriod / 10) * 1000) / 10);
});

test('Date range validation', async () => {
  const bad = ['range=1y', 'from=2026-01-01', 'from=2026-02-01&to=2026-01-01', 'from=2020-01-01&to=2026-01-01', 'from=yesterday&to=today'];
  for (const q of bad) {
    assert.equal((await api(`/api/v1/analytics/platform?${q}`, { token: organizerToken })).status, 400, q);
  }
  const ok = await api('/api/v1/analytics/platform?from=2026-01-01&to=2026-01-31', { token: organizerToken });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.trend.length, 31);
});

test('Trend buckets are weekly for long ranges and growth needs full history', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const end = new Date('2026-06-01T00:00:00Z');
  const weeks = trend([], start, end, 'week');
  assert.ok(weeks.length >= 21 && weeks.length <= 23);
  assert.equal(new Date(`${weeks[1].date}T00:00:00Z`).getUTCDay(), 1, 'weeks start on Monday');

  const now = new Date('2026-06-30T12:00:00Z');
  const fake = {
    events: [],
    earliest: () => new Date('2026-04-01T00:00:00Z'),
    between: (s, e) => [
      { occurredAt: '2026-05-10T00:00:00Z', visitorHash: 'a' },
      { occurredAt: '2026-06-10T00:00:00Z', visitorHash: 'a' },
      { occurredAt: '2026-06-11T00:00:00Z', visitorHash: 'b' },
    ].filter((ev) => Date.parse(ev.occurredAt) >= s && Date.parse(ev.occurredAt) < e),
  };
  const growth = monthOverMonth(fake, now);
  assert.equal(growth.available, true);
  assert.equal(growth.previous.uniqueVisitors, 1);
  assert.equal(growth.current.uniqueVisitors, 2);
  assert.equal(growth.uniqueVisitorsChangePct, 100);

  assert.equal(resolvePeriod({ range: '90d' }, fake, now).range, '90d');
});
