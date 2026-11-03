// Server screening status → the labels used across the UI.
export const SERVER_SCREENING_LABEL = { pending: "Pending Review", shortlisted: "Shortlisted", rejected: "Rejected" };

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
    // The screening decision belongs to the team and applies whether or not
    // the submission has been locked yet.
    screeningStatus: SERVER_SCREENING_LABEL[s.screeningStatus] || "Pending Review",
    screeningRemarks: s.screeningFeedback || "",
    judgingProgress: s.judgingProgress || null,
    finalizedAt: s.updatedAt,
    isServer: true,
  };
}
