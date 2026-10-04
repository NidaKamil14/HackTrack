export const SYSTEM_ROLES = [
  {
    id: "students",
    title: "Students",
    summary: "Discover hackathons, register, and join teams with a single code.",
    points: [
      "Browse active hackathons and guidelines",
      "Join an existing team instantly using an invite code",
      "View submission deadlines and track status"
    ]
  },
  {
    id: "leaders",
    title: "Team Leaders",
    summary: "Form the squad, manage the roster, and handle final submission.",
    points: [
      "Generate shareable 8-character team invite codes",
      "Lock roster when the team is ready",
      "Submit repo URL, demo links, and project pitch"
    ]
  },
  {
    id: "screening",
    title: "Screening Committee",
    summary: "Quality filter ensuring only compliant submissions reach the judges.",
    points: [
      "Verify repo authenticity and working demo URLs",
      "Filter out non-compliant or incomplete entries",
      "Shortlist and forward approved teams to judges"
    ]
  },
  {
    id: "judges",
    title: "Judges",
    summary: "Objective, rubric-driven evaluation without administrative overhead.",
    points: [
      "Access only pre-screened eligible teams",
      "Score projects across defined rubric criteria",
      "Provide constructive feedback and finalize scores"
    ]
  },
  {
    id: "admins",
    title: "Admin",
    summary: "Full lifecycle governance and stage timeline management.",
    points: [
      "Create hackathons, tracks, and submission rules",
      "Manage user permissions and advance competition stages",
      "Monitor leaderboards and publish final results"
    ]
  }
];
