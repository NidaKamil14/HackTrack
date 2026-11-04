// Server screening status → the labels used across the UI.
// "not_submitted": the team has no finalized submission yet, so it is not in screening.
export const SERVER_SCREENING_LABEL = { not_submitted: "Awaiting final submission", pending: "Pending Review", shortlisted: "Shortlisted", rejected: "Rejected" };

/** Server submission → the shape the participant workspace and screening views use. */
export function mapServerSubmission(s) {
  if (!s) return null;
  return {
    id: s.id,
    projectTitle: s.projectTitle || "",
    projectDescription: s.abstract || "",
    repositoryUrl: s.repoUrl || "",
    liveDemoUrl: s.demoUrl || "",
    submissionFiles: [],
    status: s.isLocked ? "finalized" : "draft",
    // The server reports "not_submitted" until the submission is finalized; a
    // draft is never shown as shortlisted or rejected.
    screeningStatus: s.isLocked ? SERVER_SCREENING_LABEL[s.screeningStatus] || "Pending Review" : SERVER_SCREENING_LABEL.not_submitted,
    screeningRemarks: s.screeningFeedback || "",
    // Basis of the decision (checklist + date); internal notes never arrive here.
    checks: s.isLocked && s.screeningChecks ? s.screeningChecks : undefined,
    screenedAt: s.isLocked ? s.screenedAt || null : null,
    judgingProgress: s.judgingProgress || null,
    finalizedAt: s.updatedAt,
    isServer: true,
  };
}
