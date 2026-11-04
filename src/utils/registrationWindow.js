/*
 * Whether an event accepts registrations right now, and how to say so.
 * Shared by the event page, discovery and the participant dashboard so every
 * place opens and closes registration by the same rules as the server:
 * published, results not out, before the registration deadline, and still in
 * its registration stage.
 */
export function getRegistrationWindow(h) {
  if (!h) return { open: false, label: "Unavailable", reason: "This event can't be found." };
  const deadlinePassed = h.registrationDeadline && Date.now() > Date.parse(h.registrationDeadline);

  if (h.resultsPublished || h.status === "completed" || ["Leaderboard Published", "Archived"].includes(h.stage)) {
    return { open: false, label: "Event completed", reason: "This hackathon has finished and results are out. Registration is closed." };
  }
  if (h.status === "draft" || h.stage === "Upcoming") {
    return { open: false, label: "Opens soon", reason: "Registration hasn't opened yet. Check back when the organizer opens it." };
  }
  if (
    h.status === "judging" ||
    h.status === "registration_closed" ||
    h.isRegistrationClosed ||
    deadlinePassed ||
    ["Team Formation", "Screening Gate", "Rubric Judging"].includes(h.stage)
  ) {
    return { open: false, label: "Registration closed", reason: "The registration period for this hackathon is over." };
  }
  return { open: true, label: "Registration open", reason: null };
}
