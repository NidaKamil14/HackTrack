import test from 'node:test';
import assert from 'node:assert/strict';
import { mapServerSubmission } from './serverSubmissions.js';

// Screening applies to finalized (locked) submissions only: a draft is never
// shown as shortlisted or rejected, whatever the server recorded.

const base = { id: 'sub-1', projectTitle: 'P', abstract: 'A', repoUrl: 'r', demoUrl: 'd', updatedAt: '2026-11-03T00:00:00Z' };

test('a draft submission is awaiting final submission, never shortlisted', () => {
  assert.equal(mapServerSubmission({ ...base, isLocked: false, screeningStatus: 'shortlisted' }).screeningStatus, 'Awaiting final submission');
  assert.equal(mapServerSubmission({ ...base, isLocked: false, screeningStatus: 'not_submitted' }).screeningStatus, 'Awaiting final submission');
  assert.equal(mapServerSubmission({ ...base, isLocked: false, screeningStatus: 'shortlisted' }).status, 'draft');
});

test('locked submissions map pending / shortlisted / rejected', () => {
  assert.equal(mapServerSubmission({ ...base, isLocked: true, screeningStatus: 'pending' }).screeningStatus, 'Pending Review');
  assert.equal(mapServerSubmission({ ...base, isLocked: true, screeningStatus: 'shortlisted' }).screeningStatus, 'Shortlisted');
  assert.equal(mapServerSubmission({ ...base, isLocked: true, screeningStatus: 'rejected' }).screeningStatus, 'Rejected');
});

test('missing status defaults to Pending Review; no submission maps to null', () => {
  assert.equal(mapServerSubmission({ ...base, isLocked: true }).screeningStatus, 'Pending Review');
  assert.equal(mapServerSubmission(null), null);
});

test('only team-visible feedback is carried over', () => {
  const m = mapServerSubmission({ ...base, isLocked: true, screeningStatus: 'rejected', screeningFeedback: 'Shown to team', internalNote: 'SECRET' });
  assert.equal(m.screeningRemarks, 'Shown to team');
  assert.ok(!JSON.stringify(m).includes('SECRET'));
});
