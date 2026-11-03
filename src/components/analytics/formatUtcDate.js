// Analytics buckets are UTC calendar dates; format them in UTC so they never shift a day.
export const formatUtcDate = (iso, opts = { month: 'short', day: 'numeric' }) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
