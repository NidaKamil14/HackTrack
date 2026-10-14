// Hackathon lifecycle helpers shared by every page that shows a stage.

// Badge tone for a stage.
const TONES = {
  'Registration Open': 'success',
  'Team Formation': 'accent',
  'Screening Gate': 'warning',
  'Rubric Judging': 'info',
  'Leaderboard Published': 'neutral',
  Archived: 'neutral',
  Upcoming: 'info',
};

export function stageTone(stage) {
  return TONES[stage] || 'neutral';
}

// Lifecycle order. Mirrors the list in advanceHackathonStage()
// (src/utils/hackathonService.js), with "Upcoming" (seed data) before it.
export const STAGE_ORDER = [
  'Upcoming',
  'Registration Open',
  'Team Formation',
  'Screening Gate',
  'Rubric Judging',
  'Leaderboard Published',
  'Archived',
];

// 0–100 position of a stage in the lifecycle (display only). Unknown → 0.
export function stageProgress(stage) {
  const index = STAGE_ORDER.indexOf(stage);
  if (index <= 0) return 0;
  return Math.round((index / (STAGE_ORDER.length - 1)) * 100);
}

// Groups used to distinguish events at a glance.
export function stagePhase(stage) {
  if (stage === 'Upcoming') return 'upcoming';
  if (stage === 'Leaderboard Published' || stage === 'Archived') return 'completed';
  return 'active';
}
