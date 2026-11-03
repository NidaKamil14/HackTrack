import api from './api';

/*
 * Server hackathons → the shape the UI uses, and one mapping from the
 * backend's status (draft | published | registration_closed | judging |
 * completed) to the lifecycle stages shown in the UI (stageTone.js), so every
 * page labels the same event the same way.
 */

const fmt = (iso, opts) => (iso ? new Date(iso).toLocaleDateString('en-US', opts) : '');

export function stageFromServer(sh) {
  if (sh.status === 'draft') return 'Upcoming';
  if (sh.status === 'completed' || sh.resultsPublished) return 'Leaderboard Published';
  if (sh.status === 'judging' || sh.isSubmissionClosed) return 'Rubric Judging';
  if (sh.status === 'registration_closed' || sh.isRegistrationClosed) return 'Team Formation';
  return 'Registration Open';
}

export function normalizeServerHackathon(sh) {
  return {
    id: sh.id,
    title: sh.title,
    headline: sh.tagLine || `${sh.title} Innovation Sprint`,
    deadline: sh.submissionDeadline ? fmt(sh.submissionDeadline, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD',
    dates: `${fmt(sh.startDate, { month: 'short', day: 'numeric' })} - ${fmt(sh.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}`,
    stage: stageFromServer(sh),
    status: sh.status,
    resultsPublished: Boolean(sh.resultsPublished),
    isRegistrationClosed: sh.isRegistrationClosed,
    registrationDeadline: sh.registrationDeadline,
    submissionDeadline: sh.submissionDeadline,
    track: sh.track || 'General Track',
    category: sh.category || 'Full-Stack',
    tags: Array.isArray(sh.tags) ? sh.tags : [],
    teamSize: `${sh.minTeamSize || 1} - ${sh.maxTeamSize || 4} Members`,
    summary: sh.description || sh.summary || `Official ${sh.title} competition.`,
    // The configured judging rubric, in the shape the rubric views use.
    rubrics: Array.isArray(sh.criteria) ? sh.criteria.map((c) => ({ name: c.name, weight: `${c.maxScore}%`, desc: c.description || '' })) : undefined,
    createdBy: sh.createdBy,
    assignedOrganizers: sh.assignedOrganizers,
    isServer: true,
  };
}

/** Local records enriched/overridden by the server's version of the same event. */
export function mergeHackathons(local, server) {
  if (!server?.length) return local;
  const combined = [...local];
  server.forEach((sh) => {
    const idx = combined.findIndex((h) => h.id === sh.id || h.title?.toLowerCase() === sh.title?.toLowerCase());
    const normalized = normalizeServerHackathon(sh);
    if (idx >= 0) combined[idx] = { ...combined[idx], ...normalized, tags: combined[idx].tags?.length ? combined[idx].tags : normalized.tags, id: sh.id };
    else combined.push(normalized);
  });
  return combined;
}

/** Public catalogue (never drafts), regardless of who is signed in. */
export async function fetchPublicHackathons() {
  try {
    const res = await api.request('/hackathons?scope=public');
    return Array.isArray(res?.hackathons) ? res.hackathons : [];
  } catch {
    return [];
  }
}
