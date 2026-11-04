import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNotificationLink } from './notificationLinks.js';

const leader = { role: 'leader' };
const member = { role: 'student' };

test('a leader opens their own dashboard on the linked tab and event', () => {
  assert.equal(
    resolveNotificationLink('/dashboard/student?tab=results&event=hack-001', leader),
    '/dashboard/leader?tab=results&event=hack-001'
  );
});

test('a member stays on the student dashboard', () => {
  assert.equal(
    resolveNotificationLink('/dashboard/leader?tab=roster&event=hack-001', member),
    '/dashboard/student?tab=roster&event=hack-001'
  );
});

test('the leader-only submission tab sends members to screening & judging', () => {
  assert.equal(
    resolveNotificationLink('/dashboard/student?tab=workspace&event=hack-001', member),
    '/dashboard/student?tab=results&event=hack-001'
  );
  assert.equal(
    resolveNotificationLink('/dashboard/student?tab=workspace&event=hack-001', leader),
    '/dashboard/leader?tab=workspace&event=hack-001'
  );
});

test('other in-app links are kept; external or missing links are ignored', () => {
  assert.equal(resolveNotificationLink('/hackathons/hack-001', leader), '/hackathons/hack-001');
  assert.equal(resolveNotificationLink('/dashboard/judge', { role: 'judge' }), '/dashboard/judge');
  assert.equal(resolveNotificationLink('https://evil.example/x', leader), null);
  assert.equal(resolveNotificationLink('//evil.example/x', leader), null);
  assert.equal(resolveNotificationLink(null, leader), null);
});
