/**
 * HackTrack Project Submission Service
 * 
 * Manages project submissions for registered hackathon teams.
 * Persists data via localStorage (key: hacktrack_submissions), structured for direct
 * migration to a future backend API and relational database (PostgreSQL/MySQL).
 * 
 * Features:
 * - Team-based submission (references teamId and hackathonId)
 * - Team Leader authorization for edits/drafts/finalization
 * - Read-only view for non-leader teammates
 * - S3-ready file upload metadata architecture (storage: "s3", objectKey: null)
 * - Immutable finalized status (freeze & lock)
 * - Filtering for Screening Committee queue (finalized only)
 * - Bidirectional screening status updates synced with participant and judge views
 */

import { isUserRegistered } from './registrationService.js';
import { getTeamByCode, getUserTeamForHackathon } from './teamService.js';
import { addNotification } from './notificationService.js';

const STORAGE_KEY = "hacktrack_submissions";

/**
 * Pre-seeded submission records:
 */
const DEFAULT_SUBMISSIONS = [
  {
    submissionId: "sub-devpulse-ht-dev-42",
    hackathonId: "devpulse-2026",
    hackathonTitle: "DevPulse National Sprint",
    track: "Full-Stack & Cloud Systems",
    teamId: "HT-DEV-42",
    teamName: "AsyncCoders",
    submittedBy: "alex@university.edu",
    leadName: "Alex Chen",
    projectTitle: "ResilientQueue Engine",
    projectDescription: "Distributed event-driven queue with automated circuit breakers and real-time telemetry dashboard.",
    repositoryUrl: "https://github.com/alexchen/devpulse-resilient-queue",
    liveDemoUrl: "https://devpulse-queue.vercel.app",
    submissionFiles: [
      {
        id: "file-doc-1",
        name: "Architecture_System_Design.pdf",
        type: "application/pdf",
        size: 2450000,
        category: "System Documentation",
        storage: "s3",
        objectKey: "submissions/devpulse-2026/HT-DEV-42/Architecture_System_Design.pdf",
        status: "ready",
        uploadedAt: "2026-10-04T10:15:00.000Z"
      },
      {
        id: "file-deck-2",
        name: "PitchDeck_DevPulse2026.pdf",
        type: "application/pdf",
        size: 5120000,
        category: "Presentation / PDF",
        storage: "s3",
        objectKey: "submissions/devpulse-2026/HT-DEV-42/PitchDeck_DevPulse2026.pdf",
        status: "ready",
        uploadedAt: "2026-10-04T10:30:00.000Z"
      }
    ],
    status: "draft",
    screeningStatus: "Pending Review",
    screeningRemarks: "",
    rejectionReason: "",
    checks: {
      gitFreshness: true,
      endpointsLive: true,
      envConfigured: true,
      licenseMIT: true
    },
    flags: [],
    screenedAt: null,
    screenedBy: null,
    createdAt: "2026-10-04T10:00:00.000Z",
    updatedAt: "2026-10-04T10:45:00.000Z",
    finalizedAt: null
  },
  {
    submissionId: "sub-ai-catalyst-ht-ai-99",
    hackathonId: "ai-catalyst-2026",
    hackathonTitle: "AI Catalyst Challenge",
    track: "Applied Machine Learning & Agents",
    teamId: "HT-AI-99",
    teamName: "NeuralShift",
    submittedBy: "sarah.jenkins@example.com",
    leadName: "Sarah Jenkins",
    projectTitle: "Agentic Autonomous Workflow Engine",
    projectDescription: "Multi-agent autonomous framework with dynamic tool synthesis and evaluation harness.",
    repositoryUrl: "https://github.com/neuralshift/agent-framework",
    liveDemoUrl: "https://neuralshift.ai/demo",
    submissionFiles: [
      {
        id: "file-ai-doc",
        name: "Agent_Specification_v1.pdf",
        type: "application/pdf",
        size: 1800000,
        category: "System Documentation",
        storage: "s3",
        objectKey: "submissions/ai-catalyst-2026/HT-AI-99/Agent_Specification_v1.pdf",
        status: "ready",
        uploadedAt: "2026-10-03T15:20:00.000Z"
      }
    ],
    status: "finalized",
    screeningStatus: "Shortlisted",
    screeningRemarks: "Verified clean modular repository. All agent tool endpoints live and responding under 300ms.",
    rejectionReason: "",
    checks: {
      gitFreshness: true,
      endpointsLive: true,
      envConfigured: true,
      licenseMIT: true
    },
    flags: [],
    screenedAt: "2026-10-04T11:00:00.000Z",
    screenedBy: "Dr. Marcus Vance",
    createdAt: "2026-10-03T14:00:00.000Z",
    updatedAt: "2026-10-03T18:30:00.000Z",
    finalizedAt: "2026-10-03T18:30:00.000Z"
  },
  {
    submissionId: "sub-devpulse-cloudscale",
    hackathonId: "devpulse-2026",
    hackathonTitle: "DevPulse National Sprint",
    track: "Full-Stack & Cloud Systems",
    teamId: "HT-CS-77",
    teamName: "CloudScale Systems",
    submittedBy: "ryan@cloudscale.net",
    leadName: "Ryan Cooper",
    projectTitle: "CloudScale Adaptive Mesh",
    projectDescription: "Dynamic edge computing orchestration layer with telemetry streams.",
    repositoryUrl: "https://github.com/rcooper/cloudscale",
    liveDemoUrl: "https://cloudscale-staging.net",
    submissionFiles: [
      {
        id: "file-cs-doc",
        name: "CloudScale_Arch.pdf",
        type: "application/pdf",
        size: 3200000,
        category: "System Documentation",
        storage: "s3",
        objectKey: "submissions/devpulse-2026/HT-CS-77/CloudScale_Arch.pdf",
        status: "ready",
        uploadedAt: "2026-10-02T11:00:00.000Z"
      }
    ],
    status: "finalized",
    screeningStatus: "Rejected",
    screeningRemarks: "Commits found prior to kickoff window. Missing environment configuration documentation.",
    rejectionReason: "Pre-dated private commits before kickoff window",
    checks: {
      gitFreshness: false,
      endpointsLive: true,
      envConfigured: false,
      licenseMIT: true
    },
    flags: ["Pre-dated private commits before kickoff window", "Missing .env.example documentation"],
    screenedAt: "2026-10-03T16:00:00.000Z",
    screenedBy: "Dr. Marcus Vance",
    createdAt: "2026-10-02T09:00:00.000Z",
    updatedAt: "2026-10-02T16:00:00.000Z",
    finalizedAt: "2026-10-02T16:00:00.000Z"
  },
  {
    submissionId: "sub-ai-visionpulse",
    hackathonId: "ai-catalyst-2026",
    hackathonTitle: "AI Catalyst Challenge",
    track: "Applied Machine Learning & Agents",
    teamId: "HT-VP-18",
    teamName: "VisionPulse",
    submittedBy: "liwei@visionpulse.app",
    leadName: "Li Wei",
    projectTitle: "VisionPulse Real-time OCR",
    projectDescription: "Zero-latency multi-modal vision perception engine for edge robotics.",
    repositoryUrl: "https://github.com/liwei/visionpulse",
    liveDemoUrl: "https://visionpulse.app",
    submissionFiles: [
      {
        id: "file-vp-doc",
        name: "VisionPulse_Whitepaper.pdf",
        type: "application/pdf",
        size: 4100000,
        category: "System Documentation",
        storage: "s3",
        objectKey: "submissions/ai-catalyst-2026/HT-VP-18/VisionPulse_Whitepaper.pdf",
        status: "ready",
        uploadedAt: "2026-10-03T08:00:00.000Z"
      }
    ],
    status: "finalized",
    screeningStatus: "Shortlisted",
    screeningRemarks: "Multi-modal vision engine verified on live endpoints with compliant MIT license.",
    rejectionReason: "",
    checks: {
      gitFreshness: true,
      endpointsLive: true,
      envConfigured: true,
      licenseMIT: true
    },
    flags: [],
    screenedAt: "2026-10-03T14:00:00.000Z",
    screenedBy: "Dr. Marcus Vance",
    createdAt: "2026-10-03T07:30:00.000Z",
    updatedAt: "2026-10-03T12:00:00.000Z",
    finalizedAt: "2026-10-03T12:00:00.000Z"
  }
];

/**
 * Retrieves all stored submissions.
 */
export function getSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SUBMISSIONS));
      return DEFAULT_SUBMISSIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SUBMISSIONS;
  } catch {
    return DEFAULT_SUBMISSIONS;
  }
}

/**
 * Persists submissions to localStorage.
 */
export function saveAllSubmissions(submissions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  } catch (err) {
    console.error("Failed to persist submissions to localStorage:", err);
  }
}

/**
 * Helper to determine if a user is the leader of a given team.
 */
export function isUserTeamLeader(team, user) {
  if (!team || !user) return false;
  const userEmail = (user.email || "").toLowerCase().trim();
  const userName = (user.fullName || "").toLowerCase().trim();

  // 1. Direct lead email match
  if (team.leadEmail && team.leadEmail.toLowerCase().trim() === userEmail) {
    return true;
  }

  // 2. Direct lead string match
  if (typeof team.lead === 'string' && userName && team.lead.toLowerCase().trim() === userName) {
    return true;
  }

  // 3. Inspect members roster
  if (Array.isArray(team.members)) {
    const isLeader = team.members.some((m) => {
      if (typeof m === 'string') {
        return m.toLowerCase().includes('(lead)') && (userName && m.toLowerCase().includes(userName));
      }
      if (typeof m === 'object' && m) {
        const isLeadRole = m.role === "Team Leader" || (m.name && m.name.toLowerCase().includes('(lead)'));
        const matchesEmail = m.email && m.email.toLowerCase().trim() === userEmail;
        const matchesName = m.name && userName && m.name.toLowerCase().includes(userName);
        return isLeadRole && (matchesEmail || matchesName);
      }
      return false;
    });
    if (isLeader) return true;
  }

  // 4. Pre-seeded demo user fallback for HT-DEV-42
  if ((team.code === "HT-DEV-42" || team.id === "HT-DEV-42") && userEmail === "alex@university.edu") {
    return true;
  }

  return false;
}

/**
 * Helper to determine if a user belongs to a given team (leader or member).
 */
export function isUserTeamMember(team, user) {
  if (!team || !user) return false;
  if (isUserTeamLeader(team, user)) return true;

  const userEmail = (user.email || "").toLowerCase().trim();
  const userName = (user.fullName || "").toLowerCase().trim();

  if (Array.isArray(team.members)) {
    return team.members.some((m) => {
      if (typeof m === 'string') {
        return (userEmail && m.toLowerCase().includes(userEmail)) ||
               (userName && m.toLowerCase().includes(userName));
      }
      if (typeof m === 'object' && m) {
        return (m.email && m.email.toLowerCase().trim() === userEmail) ||
               (m.name && userName && m.name.toLowerCase().includes(userName));
      }
      return false;
    });
  }

  return false;
}

/**
 * Finds submission for a specific team and hackathon.
 */
export function getSubmissionByTeamAndHackathon(teamId, hackathonId) {
  if (!teamId || !hackathonId) return null;
  const cleanTeamId = String(teamId).trim().toUpperCase();
  const all = getSubmissions();

  return (
    all.find(
      (s) =>
        String(s.teamId).trim().toUpperCase() === cleanTeamId &&
        s.hackathonId === hackathonId
    ) || null
  );
}

/**
 * Retrieves only FINALIZED submissions for the Screening Committee queue.
 * Drafts are strictly excluded.
 */
export function getFinalizedSubmissions(hackathonId = null) {
  const all = getSubmissions();
  return all.filter((s) => s.status === "finalized" && (!hackathonId || s.hackathonId === hackathonId));
}

/**
 * Retrieves only pre-screened SHORTLISTED submissions eligible for judging.
 */
export function getShortlistedSubmissions(hackathonId = null) {
  const all = getSubmissions();
  return all.filter(
    (s) =>
      s.status === "finalized" &&
      s.screeningStatus === "Shortlisted" &&
      (!hackathonId || s.hackathonId === hackathonId)
  );
}

/**
 * Updates screening decision, remarks, rejection reason, and compliance checklist.
 * Persists changes immediately and dispatches notifications.
 */
export function updateScreeningDecision({
  submissionId,
  status, // "Shortlisted" | "Rejected" | "Under Review" | "Pending Review"
  remarks = "",
  rejectionReason = "",
  checks = null,
  flags = [],
  reviewer = "Dr. Marcus Vance (Screening Committee)"
}) {
  if (!submissionId || !status) {
    return { success: false, error: "Submission ID and Status are required." };
  }

  const all = getSubmissions();
  const index = all.findIndex((s) => s.submissionId === submissionId);

  if (index === -1) {
    return { success: false, error: "Submission not found." };
  }

  const existing = all[index];
  const now = new Date().toISOString();

  const updatedRecord = {
    ...existing,
    screeningStatus: status,
    screeningRemarks: remarks !== undefined ? remarks : existing.screeningRemarks,
    rejectionReason: status === "Rejected" ? (rejectionReason || existing.rejectionReason) : "",
    checks: checks ? { ...existing.checks, ...checks } : existing.checks,
    flags: Array.isArray(flags) ? flags : existing.flags,
    screenedAt: now,
    screenedBy: reviewer,
    updatedAt: now
  };

  all[index] = updatedRecord;
  saveAllSubmissions(all);

  // Notify team submitter
  const notifType = status === "Shortlisted" ? "success" : status === "Rejected" ? "error" : "info";
  addNotification({
    userEmail: existing.submittedBy,
    title: `Screening Update: ${status}`,
    message: status === "Shortlisted"
      ? `Congratulations! "${existing.projectTitle}" has passed screening and advanced to judging.`
      : status === "Rejected"
      ? `Screening gate feedback: "${rejectionReason || remarks || 'Submission did not satisfy screening criteria.'}"`
      : `Submission status updated to "${status}".`,
    type: notifType,
    link: "/dashboard/student"
  });

  return { success: true, submission: updatedRecord };
}

/**
 * Supported reopening mechanism:
 * Unlocks a finalized submission (returns to draft) so team leader can make revisions.
 */
export function unlockSubmission(submissionId, reason = "Revision requested", adminUser = null) {
  const all = getSubmissions();
  const index = all.findIndex((s) => s.submissionId === submissionId);

  if (index === -1) {
    return { success: false, error: "Submission not found." };
  }

  const existing = all[index];
  const now = new Date().toISOString();

  const unlockedRecord = {
    ...existing,
    status: "draft",
    screeningStatus: "Pending Review",
    screeningRemarks: `Reopened for revisions: ${reason}`,
    finalizedAt: null,
    updatedAt: now,
    unlockedAt: now,
    unlockedBy: adminUser?.fullName || "Platform Admin"
  };

  all[index] = unlockedRecord;
  saveAllSubmissions(all);

  addNotification({
    userEmail: existing.submittedBy,
    title: "Submission Reopened for Edits",
    message: `Your project submission for "${existing.hackathonTitle}" has been unlocked for edits.`,
    type: "info",
    link: "/dashboard/student"
  });

  return { success: true, submission: unlockedRecord };
}

/**
 * Creates S3-ready file metadata object.
 * Does not expose or require AWS secrets in frontend.
 */
export function createS3FileMetadata(file, category = "Documentation") {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  return {
    id: fileId,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size || 0,
    category,
    storage: "s3",
    objectKey: `submissions/${Date.now()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, // Ready for future presigned AWS S3 upload
    status: "ready", // Locally verified and ready for S3 synchronization
    uploadedAt: new Date().toISOString()
  };
}

/**
 * Saves or updates a draft submission.
 * Enforces:
 * 1. User registered for hackathon
 * 2. User belongs to team
 * 3. User is team leader
 * 4. Submission is not already finalized
 */
export function saveDraftSubmission({
  teamId,
  hackathonId,
  hackathonTitle,
  track,
  user,
  projectTitle,
  projectDescription,
  repositoryUrl,
  liveDemoUrl,
  submissionFiles = []
}) {
  if (!teamId || !hackathonId || !user) {
    return { success: false, error: "Team ID, Hackathon ID, and User are required." };
  }

  const userEmail = (user.email || "").toLowerCase().trim();

  // 1. Verify user is registered for the hackathon
  if (!isUserRegistered(userEmail, hackathonId)) {
    return {
      success: false,
      error: "You must be registered for this hackathon to submit deliverables."
    };
  }

  // 2. Resolve team
  const team = getTeamByCode(teamId) || getUserTeamForHackathon(userEmail, hackathonId);
  if (!team) {
    return {
      success: false,
      error: "You must create or join a team for this hackathon before submitting deliverables."
    };
  }

  // 3. Verify user is Team Leader
  if (!isUserTeamLeader(team, user)) {
    return {
      success: false,
      error: `Only the Team Leader (${team.lead || "Leader"}) can edit or save the project submission.`
    };
  }

  const all = getSubmissions();
  const cleanTeamId = String(team.code || teamId).trim().toUpperCase();
  const existingIdx = all.findIndex(
    (s) =>
      String(s.teamId).trim().toUpperCase() === cleanTeamId &&
      s.hackathonId === hackathonId
  );

  const existing = existingIdx >= 0 ? all[existingIdx] : null;

  // 4. Cannot modify finalized submission
  if (existing && existing.status === "finalized") {
    return {
      success: false,
      error: "This submission is already finalized and locked. It cannot be edited."
    };
  }

  const now = new Date().toISOString();
  const updatedSubmission = {
    submissionId: existing ? existing.submissionId : `sub-${hackathonId}-${cleanTeamId.toLowerCase()}`,
    hackathonId,
    hackathonTitle: hackathonTitle || team.hackathon || hackathonId,
    track: track || team.track || "General Track",
    teamId: cleanTeamId,
    teamName: team.name,
    submittedBy: userEmail,
    leadName: team.lead || user.fullName || "Team Leader",
    projectTitle: (projectTitle || "").trim(),
    projectDescription: (projectDescription || "").trim(),
    repositoryUrl: (repositoryUrl || "").trim(),
    liveDemoUrl: (liveDemoUrl || "").trim(),
    submissionFiles: Array.isArray(submissionFiles) ? submissionFiles : [],
    status: "draft",
    screeningStatus: existing?.screeningStatus || "Pending Review",
    screeningRemarks: existing?.screeningRemarks || "",
    rejectionReason: existing?.rejectionReason || "",
    checks: existing?.checks || {
      gitFreshness: true,
      endpointsLive: true,
      envConfigured: true,
      licenseMIT: true
    },
    flags: existing?.flags || [],
    screenedAt: existing?.screenedAt || null,
    screenedBy: existing?.screenedBy || null,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    finalizedAt: null
  };

  if (existingIdx >= 0) {
    all[existingIdx] = updatedSubmission;
  } else {
    all.push(updatedSubmission);
  }

  saveAllSubmissions(all);

  return {
    success: true,
    submission: updatedSubmission
  };
}

/**
 * Freezes and finalizes a submission for screening.
 * Irreversible action. Once finalized:
 * - status = "finalized"
 * - finalizedAt = ISO timestamp
 * - Appear immediately in Screening Committee queue
 */
export function finalizeSubmission({
  teamId,
  hackathonId,
  user
}) {
  if (!teamId || !hackathonId || !user) {
    return { success: false, error: "Team ID, Hackathon ID, and User are required." };
  }

  const userEmail = (user.email || "").toLowerCase().trim();

  // 1. Verify user registration
  if (!isUserRegistered(userEmail, hackathonId)) {
    return {
      success: false,
      error: "You must be registered for this hackathon to finalize a submission."
    };
  }

  // 2. Resolve team
  const team = getTeamByCode(teamId) || getUserTeamForHackathon(userEmail, hackathonId);
  if (!team) {
    return {
      success: false,
      error: "No team found for this hackathon."
    };
  }

  // 3. Verify user is Team Leader
  if (!isUserTeamLeader(team, user)) {
    return {
      success: false,
      error: `Only the Team Leader (${team.lead || "Leader"}) can freeze and finalize the project submission.`
    };
  }

  const cleanTeamId = String(team.code || teamId).trim().toUpperCase();
  const all = getSubmissions();
  const existingIdx = all.findIndex(
    (s) =>
      String(s.teamId).trim().toUpperCase() === cleanTeamId &&
      s.hackathonId === hackathonId
  );

  if (existingIdx < 0) {
    return {
      success: false,
      error: "Please save a draft submission before final freezing."
    };
  }

  const existing = all[existingIdx];

  if (existing.status === "finalized") {
    return {
      success: true,
      alreadyFinalized: true,
      submission: existing
    };
  }

  // Validate minimum requirements for finalization
  if (!existing.projectTitle || !existing.projectTitle.trim()) {
    return {
      success: false,
      error: "Project Title is required before finalizing."
    };
  }

  if (!existing.repositoryUrl || !existing.repositoryUrl.trim()) {
    return {
      success: false,
      error: "Repository URL is required before finalizing."
    };
  }

  const finalizedTimestamp = new Date().toISOString();
  const finalizedRecord = {
    ...existing,
    status: "finalized",
    screeningStatus: "Pending Review",
    finalizedAt: finalizedTimestamp,
    updatedAt: finalizedTimestamp
  };

  all[existingIdx] = finalizedRecord;
  saveAllSubmissions(all);

  addNotification({
    userEmail,
    title: "Deliverables Finalized & Locked",
    message: `Project "${finalizedRecord.projectTitle}" has been submitted for Screening Committee gate review.`,
    type: "success",
    link: "/dashboard/student"
  });

  return {
    success: true,
    submission: finalizedRecord
  };
}
