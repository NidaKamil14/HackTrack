// Where a notification takes the reader when they click it.
//
// Participant notifications link to `/dashboard/student?tab=…&event=…`. A
// leader and a member share the same dashboard component on different routes,
// so the link is mapped to the reader's own route, and the leader-only
// "Project submission" tab falls back to "Screening & judging" for members.

const PARTICIPANT_PATHS = new Set(['/dashboard/student', '/dashboard/leader']);

export function resolveNotificationLink(link, user) {
  if (!link || typeof link !== 'string') return null;
  // Only in-app paths; never follow absolute or protocol-relative URLs.
  if (!link.startsWith('/') || link.startsWith('//')) return null;

  const url = new URL(link, 'http://hacktrack.local');
  if (!PARTICIPANT_PATHS.has(url.pathname)) return `${url.pathname}${url.search}${url.hash}`;

  const role = user?.role;
  if (role !== 'leader' && role !== 'student') return `${url.pathname}${url.search}${url.hash}`;

  const isLeader = role === 'leader';
  url.pathname = isLeader ? '/dashboard/leader' : '/dashboard/student';
  if (!isLeader && url.searchParams.get('tab') === 'workspace') url.searchParams.set('tab', 'results');
  return `${url.pathname}${url.search}${url.hash}`;
}
