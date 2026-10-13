import { HACKATHONS } from '../data/hackathons.js';

const STORAGE_KEY = "hacktrack_hackathons";

export function getStoredHackathons() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(HACKATHONS));
      return HACKATHONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : HACKATHONS;
  } catch {
    return HACKATHONS;
  }
}

export function saveStoredHackathons(hackathons) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hackathons));
  } catch (err) {
    console.error("Failed to save hackathons:", err);
  }
}

export function getHackathonById(id) {
  const list = getStoredHackathons();
  return list.find((h) => h.id === id) || null;
}

export function createNewHackathon(hackathonData) {
  const list = getStoredHackathons();
  const id = hackathonData.id || hackathonData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const created = {
    id,
    title: hackathonData.title,
    headline: hackathonData.headline || `${hackathonData.track} Innovation Sprint`,
    deadline: hackathonData.deadline || "TBD",
    dates: hackathonData.dates || "Upcoming",
    stage: hackathonData.stage || "Registration Open",
    category: hackathonData.category || "Full-Stack",
    track: hackathonData.track || "General Track",
    teamSize: hackathonData.teamSize || "2 - 4 Members",
    prizePool: hackathonData.prizePool || hackathonData.prize || "$10,000 USD",
    summary: hackathonData.summary || `Build and ship next-generation solutions in ${hackathonData.track}.`,
    overview: hackathonData.overview || "Join elite teams to design, architect, and deploy real-world software solutions.",
    eligibility: hackathonData.eligibility || [
      "Open to university undergraduates, graduates, and early career developers.",
      "Cross-institutional teams are permitted.",
      "Valid email verification required."
    ],
    rules: hackathonData.rules || [
      "All code commits must happen within the specified sprint window.",
      "Open-source libraries and APIs are permitted with clear attribution.",
      "Repositories must include open license and verifiable documentation."
    ],
    submissionReqs: hackathonData.submissionReqs || [
      "Public git repository with README and setup instructions.",
      "Live deployment link or interactive test endpoint.",
      "Architecture brief or walk-through video."
    ],
    screeningReqs: hackathonData.screeningReqs || [
      "Git freshness and clean commit history verification.",
      "Live HTTPS endpoint responding without errors.",
      "Environment configuration documentation (.env.example)."
    ],
    rubrics: hackathonData.rubrics || [
      { name: "Technical Depth & Architecture", weight: "30%", desc: "Clean architecture, API design, resilience." },
      { name: "Practical Usability & UX", weight: "25%", desc: "Accessibility, polish, responsiveness." },
      { name: "Innovation & Problem Solving", weight: "25%", desc: "Novelty, ingenuity, practical impact." },
      { name: "Screening & Completeness", weight: "20%", desc: "Completeness, compliance, documentation." }
    ],
    tags: hackathonData.tags || ["HackTrack", "Innovation", "Open Source"],
    enabledModules: hackathonData.enabledModules || {
      screeningGate: true,
      rubricJudging: true,
      mentorship: true,
      certificates: true
    },
    resultsPublished: false,
    organizers: hackathonData.organizers || [hackathonData.organizerName || "HackTrack Central Committee"],
    mentors: hackathonData.mentors || ["ACM Mentor Network"],
    organizerEmail: hackathonData.organizerEmail || "organizer@hacktrack.io",
    organizerName: hackathonData.organizerName || "Kavita Rao",
    organizerUniversity: hackathonData.organizerUniversity || "DevPulse Operations Committee"
  };

  const updated = [created, ...list];
  saveStoredHackathons(updated);
  return { success: true, hackathon: created };
}

export function getHackathonsByOrganizer(organizerEmail) {
  const list = getStoredHackathons();
  if (!organizerEmail) return list;
  return list.filter((h) =>
    h.organizerEmail === organizerEmail ||
    (h.organizers && h.organizers.some((o) => typeof o === 'string' && o.toLowerCase().includes(organizerEmail.toLowerCase()))) ||
    h.id === "devpulse-2026"
  );
}

export function updateHackathon(id, updates) {
  const list = getStoredHackathons();
  const index = list.findIndex((h) => h.id === id);
  if (index === -1) return { success: false, error: "Hackathon not found" };

  list[index] = { ...list[index], ...updates };
  saveStoredHackathons(list);
  return { success: true, hackathon: list[index] };
}

export function advanceHackathonStage(id) {
  const stagesList = [
    "Registration Open",
    "Team Formation",
    "Screening Gate",
    "Rubric Judging",
    "Leaderboard Published",
    "Archived"
  ];

  const list = getStoredHackathons();
  const index = list.findIndex((h) => h.id === id);
  if (index === -1) return { success: false, error: "Hackathon not found" };

  const current = list[index];
  const currentIndex = stagesList.indexOf(current.stage);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % stagesList.length : 0;
  const nextStage = stagesList[nextIndex];

  list[index] = {
    ...current,
    stage: nextStage,
    resultsPublished: nextStage === "Leaderboard Published" ? true : current.resultsPublished
  };

  saveStoredHackathons(list);
  return { success: true, hackathon: list[index] };
}
