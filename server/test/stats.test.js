import test from 'node:test';
import assert from 'node:assert/strict';
import {
  queryLiveStats,
  statsHandler,
  setDbPool,
  resetDbPool,
} from '../src/routes/stats.js';

// Helper to simulate an Express res object in-process (no network/socket dependency)
function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

// Database fixture simulation engine executing the exact LIVE_STATS_SQL aggregate rules
function createFixtureDb(initialData = {}) {
  const db = {
    hackathons: [...(initialData.hackathons || [])],
    teams: [...(initialData.teams || [])],
    users: [...(initialData.users || [])],
    team_members: [...(initialData.team_members || [])],
    hackathon_registrations: [...(initialData.hackathon_registrations || [])],

    async query(sql, params = []) {
      // Ensure the query being executed is the exact LIVE_STATS_SQL query
      assert.ok(
        sql.includes('hackathonsHosted') && sql.includes('teamsParticipated') &&
        sql.includes('participants') && sql.includes('upcomingEvents'),
        'SQL query must contain all four aggregate metrics'
      );

      const nowUtc = params[0] || new Date().toISOString().slice(0, 19).replace('T', ' ');

      const hackathonsHosted = db.hackathons.filter((h) => h.status !== 'draft').length;
      const teamsParticipated = db.teams.filter((t) => t.status === 'active').length;
      const participants = new Set(
        db.users
          .filter((u) => ['student', 'leader'].includes(u.role) && u.is_active === 1)
          .map((u) => u.id)
      ).size;
      const upcomingEvents = db.hackathons.filter(
        (h) => h.status === 'published' && h.start_date > nowUtc
      ).length;

      return [[{
        hackathonsHosted,
        teamsParticipated,
        participants,
        upcomingEvents,
      }]];
    },
  };

  return db;
}

test('HackTrack Live Database Statistics — Regression Suite', async (t) => {
  t.afterEach(() => {
    resetDbPool();
  });

  await t.test('1. Verify baseline counts against database fixtures with diverse roles & statuses', async () => {
    const futureDate = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const pastDate = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 19).replace('T', ' ');

    const fixture = createFixtureDb({
      hackathons: [
        { id: 'h-pub-upcoming', status: 'published', start_date: futureDate },
        { id: 'h-pub-ongoing', status: 'published', start_date: pastDate },
        { id: 'h-judging', status: 'judging', start_date: pastDate },
        { id: 'h-completed', status: 'completed', start_date: pastDate },
        { id: 'h-draft', status: 'draft', start_date: futureDate }, // must be excluded from hosted & upcoming
      ],
      teams: [
        { id: 't-1', status: 'active' },
        { id: 't-2', status: 'active' },
        { id: 't-withdrawn', status: 'withdrawn' }, // must be excluded
        { id: 't-disqualified', status: 'disqualified' }, // must be excluded
      ],
      users: [
        { id: 'u-stu-1', role: 'student', is_active: 1, email: 's1@test.com' },
        { id: 'u-stu-2', role: 'student', is_active: 1, email: 's2@test.com' },
        { id: 'u-lead-1', role: 'leader', is_active: 1, email: 'l1@test.com' },
        { id: 'u-stu-inactive', role: 'student', is_active: 0, email: 'inactive@test.com' }, // excluded
        { id: 'u-org-1', role: 'organizer', is_active: 1, email: 'org@test.com' }, // excluded
        { id: 'u-judge-1', role: 'judge', is_active: 1, email: 'j@test.com' }, // excluded
        { id: 'u-screen-1', role: 'screening', is_active: 1, email: 'sc@test.com' }, // excluded
        { id: 'u-admin-1', role: 'admin', is_active: 1, email: 'adm@test.com' }, // excluded
        { id: 'u-mentor-1', role: 'mentor', is_active: 1, email: 'm@test.com' }, // excluded
      ],
      team_members: [
        { id: 'tm-1', team_id: 't-1', user_id: 'u-stu-1', status: 'accepted' },
        { id: 'tm-2', team_id: 't-1', user_id: 'u-stu-2', status: 'pending' }, // pending request
      ],
    });

    setDbPool(fixture);
    const res = createMockResponse();
    await statsHandler({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.stats, {
      hackathonsHosted: 4, // 4 non-draft
      teamsParticipated: 2, // 2 active
      participants: 3, // u-stu-1, u-stu-2, u-lead-1
      upcomingEvents: 1, // h-pub-upcoming
    });
  });

  await t.test('2. Verify a new participant account increases the participant count', async () => {
    const fixture = createFixtureDb({
      users: [
        { id: 'u-1', role: 'student', is_active: 1 },
      ],
    });
    setDbPool(fixture);

    let stats = await queryLiveStats(fixture);
    assert.equal(stats.participants, 1);

    // Register a new student participant
    fixture.users.push({ id: 'u-2', role: 'student', is_active: 1, email: 'new@student.edu' });
    stats = await queryLiveStats(fixture);
    assert.equal(stats.participants, 2, 'New participant signup must increase count');

    // Register a new team leader participant
    fixture.users.push({ id: 'u-3', role: 'leader', is_active: 1, email: 'leader@student.edu' });
    stats = await queryLiveStats(fixture);
    assert.equal(stats.participants, 3, 'New team leader participant must increase count');

    // Register non-participant staff (should NOT increase count)
    fixture.users.push({ id: 'u-judge', role: 'judge', is_active: 1 });
    fixture.users.push({ id: 'u-admin', role: 'admin', is_active: 1 });
    fixture.users.push({ id: 'u-org', role: 'organizer', is_active: 1 });
    fixture.users.push({ id: 'u-screen', role: 'screening', is_active: 1 });
    fixture.users.push({ id: 'u-mentor', role: 'mentor', is_active: 1 });
    stats = await queryLiveStats(fixture);
    assert.equal(stats.participants, 3, 'Staff roles must never inflate participant count');
  });

  await t.test('3. Verify a new team increases the team count', async () => {
    const fixture = createFixtureDb({
      teams: [{ id: 'team-alpha', status: 'active' }],
    });
    setDbPool(fixture);

    let stats = await queryLiveStats(fixture);
    assert.equal(stats.teamsParticipated, 1);

    // Form a new team
    fixture.teams.push({ id: 'team-beta', status: 'active' });
    stats = await queryLiveStats(fixture);
    assert.equal(stats.teamsParticipated, 2, 'New active team must increase team count');

    // Withdrawn or disqualified team does not increase
    fixture.teams.push({ id: 'team-gamma', status: 'withdrawn' });
    stats = await queryLiveStats(fixture);
    assert.equal(stats.teamsParticipated, 2, 'Withdrawn team must not increase count');
  });

  await t.test('4. Verify creating/publishing a hackathon updates hosted and upcoming counts appropriately', async () => {
    const futureDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const fixture = createFixtureDb({ hackathons: [] });
    setDbPool(fixture);

    let stats = await queryLiveStats(fixture);
    assert.equal(stats.hackathonsHosted, 0);
    assert.equal(stats.upcomingEvents, 0);

    // Create a draft hackathon (neither hosted nor upcoming)
    const draftHack = { id: 'hack-draft', status: 'draft', start_date: futureDate };
    fixture.hackathons.push(draftHack);
    stats = await queryLiveStats(fixture);
    assert.equal(stats.hackathonsHosted, 0, 'Draft hackathons must not be counted as hosted');
    assert.equal(stats.upcomingEvents, 0, 'Draft hackathons must not be counted as upcoming');

    // Publish the hackathon
    draftHack.status = 'published';
    stats = await queryLiveStats(fixture);
    assert.equal(stats.hackathonsHosted, 1, 'Publishing makes it a hosted hackathon');
    assert.equal(stats.upcomingEvents, 1, 'Publishing with future date makes it upcoming');
  });

  await t.test('5. Verify starting or unpublishing a hackathon removes it from the upcoming count when appropriate', async () => {
    const futureDate = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const pastDate = new Date(Date.now() - 1000).toISOString().slice(0, 19).replace('T', ' ');

    const hackathon = { id: 'hack-live', status: 'published', start_date: futureDate };
    const fixture = createFixtureDb({ hackathons: [hackathon] });
    setDbPool(fixture);

    let stats = await queryLiveStats(fixture);
    assert.equal(stats.upcomingEvents, 1);
    assert.equal(stats.hackathonsHosted, 1);

    // Event starts: start_date transitions to past
    hackathon.start_date = pastDate;
    stats = await queryLiveStats(fixture);
    assert.equal(stats.upcomingEvents, 0, 'Started hackathon must be removed from upcoming count');
    assert.equal(stats.hackathonsHosted, 1, 'Started hackathon remains counted in hosted');

    // Reset to future then unpublish back to draft
    hackathon.start_date = futureDate;
    hackathon.status = 'draft';
    stats = await queryLiveStats(fixture);
    assert.equal(stats.upcomingEvents, 0, 'Unpublished hackathon must be removed from upcoming count');
    assert.equal(stats.hackathonsHosted, 0, 'Draft hackathon must be removed from hosted count');
  });

  await t.test('6. Verify duplicate registrations and pending team requests do not inflate unrelated statistics', async () => {
    const fixture = createFixtureDb({
      users: [
        { id: 'u-student-1', role: 'student', is_active: 1 },
      ],
      teams: [
        { id: 'team-1', status: 'active' },
      ],
      team_members: [
        { id: 'tm-1', team_id: 'team-1', user_id: 'u-student-1', status: 'accepted' },
      ],
      hackathon_registrations: [
        { id: 'reg-1', hackathon_id: 'h-1', user_id: 'u-student-1' },
      ],
    });
    setDbPool(fixture);

    const initial = await queryLiveStats(fixture);

    // Pending join request from a student
    fixture.team_members.push({ id: 'tm-pending', team_id: 'team-1', user_id: 'u-student-2', status: 'pending' });
    let current = await queryLiveStats(fixture);
    assert.equal(current.teamsParticipated, initial.teamsParticipated, 'Pending team request must not inflate teamsParticipated');

    // Multiple registrations for different hackathons by same user
    fixture.hackathon_registrations.push({ id: 'reg-2', hackathon_id: 'h-2', user_id: 'u-student-1' });
    fixture.hackathon_registrations.push({ id: 'reg-3', hackathon_id: 'h-3', user_id: 'u-student-1' });
    current = await queryLiveStats(fixture);
    assert.equal(current.participants, initial.participants, 'Duplicate/multiple hackathon registrations must not inflate distinct participants');
    assert.equal(current.teamsParticipated, initial.teamsParticipated, 'Registrations must not inflate teams');
  });

  await t.test('7. Verify the endpoint does not expose private user data', async () => {
    const fixture = createFixtureDb({
      users: [
        {
          id: 'u-secret',
          role: 'student',
          is_active: 1,
          email: 'secret@university.edu',
          password_hash: '$2a$10$abcdef1234567890',
          reset_token: 'secret-reset-token',
        },
      ],
    });
    setDbPool(fixture);

    const res = createMockResponse();
    await statsHandler({}, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.stats, 'Response must have stats object');

    const serialized = JSON.stringify(res.body);
    assert.equal(serialized.includes('secret@university.edu'), false, 'Email must not be in payload');
    assert.equal(serialized.includes('$2a$10$'), false, 'Password hash must not be in payload');
    assert.equal(serialized.includes('secret-reset-token'), false, 'Reset token must not be in payload');
    assert.equal(serialized.includes('u-secret'), false, 'User ID must not be in payload');

    const keys = Object.keys(res.body.stats);
    assert.deepEqual(keys.sort(), ['hackathonsHosted', 'participants', 'teamsParticipated', 'upcomingEvents'].sort());
  });

  await t.test('8. Verify database failure returns HTTP 503 and safe error response', async () => {
    const failingDb = {
      async query() {
        const err = new Error('connect ECONNREFUSED 127.0.0.1:3306');
        err.code = 'ECONNREFUSED';
        throw err;
      },
    };
    setDbPool(failingDb);

    const res = createMockResponse();
    await statsHandler({}, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.status, 503);
    assert.equal(res.body.error, 'Database Unavailable');
    assert.equal(typeof res.body.message, 'string');
    assert.equal(res.body.stats, undefined);
  });
});
