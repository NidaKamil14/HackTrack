// Maps a hackathon lifecycle stage (see utils/hackathonService.js) to a Badge tone.
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
