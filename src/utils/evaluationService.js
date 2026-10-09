import { addNotification } from './notificationService.js';

const STORAGE_EVALS_KEY = "hacktrack_evaluations";
const STORAGE_RESULTS_KEY = "hacktrack_published_results";

const DEFAULT_EVALUATIONS = [
  {
    evaluationId: "eval-ai-catalyst-ht-ai-99",
    teamId: "HT-AI-99",
    teamName: "NeuralShift",
    hackathonId: "ai-catalyst-2026",
    hackathonTitle: "AI Catalyst Challenge",
    track: "Applied Machine Learning & Agents",
    judgeEmail: "judge@hacktrack.io",
    judgeName: "Prof. Elena Rostova",
    scores: {
      architecture: 28,
      usability: 24,
      innovation: 25,
      completeness: 18
    },
    totalScore: 95,
    feedback: "Exceptional agent tool orchestration with reliable fallback mechanisms. Very clean API design and resilient test suites.",
    status: "Evaluated",
    certifiedAt: "2026-10-04T14:30:00.000Z"
  },
  {
    evaluationId: "eval-devpulse-ht-dev-42",
    teamId: "HT-DEV-42",
    teamName: "AsyncCoders",
    hackathonId: "devpulse-2026",
    hackathonTitle: "DevPulse National Sprint",
    track: "Full-Stack & Cloud Systems",
    judgeEmail: "judge@hacktrack.io",
    judgeName: "Prof. Elena Rostova",
    scores: {
      architecture: 29,
      usability: 23,
      innovation: 25,
      completeness: 19
    },
    totalScore: 96,
    feedback: "Superb distributed queue implementation. Circuit breaker state machine handles edge telemetry disconnects flawlessly.",
    status: "Evaluated",
    certifiedAt: "2026-10-05T11:00:00.000Z"
  }
];

// Which hackathons have officially published public results
const DEFAULT_PUBLISHED_RESULTS = {
  "ai-catalyst-2026": false,
  "devpulse-2026": false,
  "smart-campus-2026": false
};

export function getEvaluations(hackathonId = null) {
  try {
    const raw = localStorage.getItem(STORAGE_EVALS_KEY);
    const evals = raw ? JSON.parse(raw) : DEFAULT_EVALUATIONS;
    const list = Array.isArray(evals) ? evals : DEFAULT_EVALUATIONS;
    if (hackathonId) {
      return list.filter((e) => e.hackathonId === hackathonId);
    }
    return list;
  } catch {
    return DEFAULT_EVALUATIONS;
  }
}

export function saveAllEvaluations(evals) {
  try {
    localStorage.setItem(STORAGE_EVALS_KEY, JSON.stringify(evals));
  } catch (err) {
    console.error("Failed to save evaluations:", err);
  }
}

export function getTeamEvaluation(teamId, hackathonId) {
  if (!teamId) return null;
  const cleanTeam = String(teamId).trim().toUpperCase();
  const all = getEvaluations();
  return (
    all.find(
      (e) =>
        String(e.teamId).trim().toUpperCase() === cleanTeam &&
        (!hackathonId || e.hackathonId === hackathonId)
    ) || null
  );
}

export function saveEvaluation({
  teamId,
  teamName,
  hackathonId,
  hackathonTitle,
  track,
  judgeEmail,
  judgeName,
  scores,
  feedback
}) {
  if (!teamId || !hackathonId) {
    return { success: false, error: "Team ID and Hackathon ID are required." };
  }

  const cleanTeam = String(teamId).trim().toUpperCase();
  const all = getEvaluations();

  const totalScore = Object.values(scores || {}).reduce(
    (acc, curr) => acc + (Number(curr) || 0),
    0
  );

  const existingIdx = all.findIndex(
    (e) =>
      String(e.teamId).trim().toUpperCase() === cleanTeam &&
      e.hackathonId === hackathonId
  );

  const evalRecord = {
    evaluationId: existingIdx >= 0 ? all[existingIdx].evaluationId : `eval-${hackathonId}-${cleanTeam.toLowerCase()}`,
    teamId: cleanTeam,
    teamName: teamName || (existingIdx >= 0 ? all[existingIdx].teamName : "Team"),
    hackathonId,
    hackathonTitle: hackathonTitle || (existingIdx >= 0 ? all[existingIdx].hackathonTitle : hackathonId),
    track: track || "General Track",
    judgeEmail: judgeEmail || "judge@hacktrack.io",
    judgeName: judgeName || "Judge",
    scores: scores || { architecture: 0, usability: 0, innovation: 0, completeness: 0 },
    totalScore,
    feedback: (feedback || "").trim(),
    status: "Evaluated",
    certifiedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    all[existingIdx] = evalRecord;
  } else {
    all.push(evalRecord);
  }

  saveAllEvaluations(all);

  return { success: true, evaluation: evalRecord };
}

export function getPublishedResultsMap() {
  try {
    const raw = localStorage.getItem(STORAGE_RESULTS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_RESULTS_KEY, JSON.stringify(DEFAULT_PUBLISHED_RESULTS));
      return DEFAULT_PUBLISHED_RESULTS;
    }
    return JSON.parse(raw) || DEFAULT_PUBLISHED_RESULTS;
  } catch {
    return DEFAULT_PUBLISHED_RESULTS;
  }
}

export function isResultsPublished(hackathonId) {
  if (!hackathonId) return false;
  const map = getPublishedResultsMap();
  return Boolean(map[hackathonId]);
}

export function setResultsPublished(hackathonId, published = true) {
  if (!hackathonId) return;
  const map = getPublishedResultsMap();
  map[hackathonId] = published;
  try {
    localStorage.setItem(STORAGE_RESULTS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error("Failed to update published results map:", err);
  }

  if (published) {
    addNotification({
      userEmail: "all",
      title: "Results Officially Published!",
      message: `Official rankings, judge scores, and certificates are now released for ${hackathonId}.`,
      type: "success",
      link: "/dashboard/student"
    });
  }
}

export function getLeaderboard(hackathonId) {
  const evals = getEvaluations(hackathonId);
  const sorted = [...evals].sort((a, b) => b.totalScore - a.totalScore);

  return sorted.map((entry, index) => {
    let rankLabel = `${index + 1}th Place`;
    let award = "Finalist";
    if (index === 0) {
      rankLabel = "1st Place";
      award = "Grand Prize Champion";
    } else if (index === 1) {
      rankLabel = "2nd Place";
      award = "1st Runner Up";
    } else if (index === 2) {
      rankLabel = "3rd Place";
      award = "Technical Excellence Award";
    }

    return {
      ...entry,
      rank: index + 1,
      rankLabel,
      award
    };
  });
}
