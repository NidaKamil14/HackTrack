import { HACKATHONS } from '../data/hackathons.js';
import { triggerDataSync } from './syncService.js';

const STORAGE_KEY = "hacktrack_hackathons";

export function getStoredHackathons() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(HACKATHONS));
      return HACKATHONS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return HACKATHONS;
    }
    // Merge any missing seeded hackathons (e.g. hack-shesolves-001)
    const combined = [...parsed];
    for (const def of HACKATHONS) {
      if (!combined.some((h) => h.id === def.id || (h.title && h.title.toLowerCase() === def.title.toLowerCase()))) {
        combined.push(def);
      }
    }
    return combined;
  } catch {
    return HACKATHONS;
  }
}

export function saveStoredHackathons(hackathons) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hackathons));
    triggerDataSync("hackathons_updated");
  } catch (err) {
    console.error("Failed to save hackathons:", err);
  }
}

export function getHackathonById(id) {
  if (!id) return null;
  const list = getStoredHackathons();
  const raw = String(id).trim();
  const clean = raw.toLowerCase();
  const alpha = clean.replace(/[^a-z0-9]/g, '');

  const exact = list.find((h) => h.id === raw || h.id.toLowerCase() === clean);
  if (exact) return exact;

  const aliases = {
    'devpulse-2026': 'hack-001',
    'devpulse': 'hack-001',
    'pccoe-innovatex-2026': 'hack-002',
    'she-solves-2026': 'hack-shesolves-001',
    'shesolves': 'hack-shesolves-001',
    'she-solves': 'hack-shesolves-001',
    'shesolves-2026': 'hack-shesolves-001',
  };
  if (aliases[clean]) {
    const aliasMatch = list.find((h) => h.id === aliases[clean]);
    if (aliasMatch) return aliasMatch;
  }

  return list.find((h) => {
    if (h.id.replace(/[^a-z0-9]/g, '') === alpha) return true;
    const hTitle = (h.title || '').toLowerCase();
    const hSlug = hTitle.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (hTitle === clean || hSlug === clean) return true;
    const hNormTitle = hTitle.replace(/[^a-z0-9]/g, '');
    if (hNormTitle === alpha) return true;
    if (alpha.length >= 4 && (hNormTitle.includes(alpha) || alpha.includes(hNormTitle))) return true;
    return false;
  }) || null;
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
  if (!organizerEmail) return [];
  const cleanEmail = organizerEmail.toLowerCase().trim();
  return list.filter((h) => {
    if (h.organizerEmail && h.organizerEmail.toLowerCase().trim() === cleanEmail) return true;
    if (h.organizers && h.organizers.some((o) => typeof o === 'string' && o.toLowerCase().includes(cleanEmail))) return true;
    if (cleanEmail === "organizer@hacktrack.io" && h.id === "devpulse-2026") return true;
    return false;
  });
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

// -------------------------------------------------------------
// Hackathon Access Code & Committee Management
// -------------------------------------------------------------
const CODES_STORAGE_KEY = "hacktrack_access_codes";
const ASSIGNMENTS_STORAGE_KEY = "hacktrack_user_hackathons";

const DEFAULT_CODES = [
  {
    id: "code-devp-judge",
    hackathonId: "devpulse-2026",
    hackathonTitle: "DevPulse National Sprint",
    role: "judge",
    code: "JUDGE-DEVPULSE-7X9K",
    createdBy: "organizer@hacktrack.io",
    createdAt: new Date().toISOString(),
    redeemedBy: [
      { userId: "usr-judge-005", email: "judge@hacktrack.io", fullName: "Prof. Elena Rostova", redeemedAt: new Date().toISOString() }
    ]
  },
  {
    id: "code-devp-screen",
    hackathonId: "devpulse-2026",
    hackathonTitle: "DevPulse National Sprint",
    role: "screening",
    code: "SCREEN-DEVPULSE-3M2P",
    createdBy: "organizer@hacktrack.io",
    createdAt: new Date().toISOString(),
    redeemedBy: [
      { userId: "usr-screening-004", email: "screening@hacktrack.io", fullName: "Dr. Marcus Vance", redeemedAt: new Date().toISOString() }
    ]
  },
  {
    id: "code-aicat-judge",
    hackathonId: "ai-catalyst-2026",
    hackathonTitle: "AI Catalyst Challenge",
    role: "judge",
    code: "JUDGE-AICAT-8K4T",
    createdBy: "organizer@hacktrack.io",
    createdAt: new Date().toISOString(),
    redeemedBy: []
  },
  {
    id: "code-aicat-screen",
    hackathonId: "ai-catalyst-2026",
    hackathonTitle: "AI Catalyst Challenge",
    role: "screening",
    code: "SCREEN-AICAT-2N9L",
    createdBy: "organizer@hacktrack.io",
    createdAt: new Date().toISOString(),
    redeemedBy: []
  },
  {
    id: "code-campus-judge",
    hackathonId: "smart-campus-2026",
    hackathonTitle: "Smart Campus Hack",
    role: "judge",
    code: "JUDGE-CAMPUS-5W1Q",
    createdBy: "organizer@hacktrack.io",
    createdAt: new Date().toISOString(),
    redeemedBy: []
  },
  {
    id: "code-campus-screen",
    hackathonId: "smart-campus-2026",
    hackathonTitle: "Smart Campus Hack",
    role: "screening",
    code: "SCREEN-CAMPUS-9Y4R",
    createdBy: "organizer@hacktrack.io",
    createdAt: new Date().toISOString(),
    redeemedBy: []
  }
];

export function getAllAccessCodes() {
  try {
    const raw = localStorage.getItem(CODES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CODES_STORAGE_KEY, JSON.stringify(DEFAULT_CODES));
      return DEFAULT_CODES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CODES;
  } catch {
    return DEFAULT_CODES;
  }
}

export function saveAllAccessCodes(codes) {
  try {
    localStorage.setItem(CODES_STORAGE_KEY, JSON.stringify(codes));
    triggerDataSync("access_codes_updated");
  } catch (err) {
    console.error("Failed to save access codes:", err);
  }
}

export function getCodesForHackathon(hackathonId) {
  const all = getAllAccessCodes();
  return all.filter((c) => c.hackathonId === hackathonId);
}

export function generateHackathonCode(hackathonId, role, createdBy = "organizer@hacktrack.io") {
  const hackathon = getHackathonById(hackathonId);
  if (!hackathon) return { success: false, error: "Hackathon not found" };

  const prefix = role.toUpperCase();
  const abbrev = (hackathon.title || "HACK")
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.substring(0, 4).toUpperCase())
    .join('');
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `${prefix}-${abbrev || 'HACK'}-${suffix}`;

  const all = getAllAccessCodes();
  // Filter out any previous code for the same hackathon + role
  const filtered = all.filter((c) => !(c.hackathonId === hackathonId && c.role === role));

  const newRecord = {
    id: `code-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    hackathonId,
    hackathonTitle: hackathon.title,
    role,
    code,
    createdBy,
    createdAt: new Date().toISOString(),
    redeemedBy: []
  };

  const updated = [...filtered, newRecord];
  saveAllAccessCodes(updated);
  return { success: true, codeRecord: newRecord };
}

export function redeemAccessCode(rawCode, user) {
  if (!rawCode || !rawCode.trim()) {
    return { success: false, error: "Please enter an access code." };
  }
  const cleanCode = rawCode.trim().toUpperCase();
  const allCodes = getAllAccessCodes();
  const record = allCodes.find((c) => c.code.toUpperCase() === cleanCode);

  if (!record) {
    return { success: false, error: "Invalid or unavailable access code." };
  }

  // Role validation: generic error on mismatch to prevent information leakage
  if (user?.role && user.role !== 'admin' && user.role !== record.role) {
    return {
      success: false,
      error: "Invalid or unavailable access code."
    };
  }

  // Record redemption in the code record
  const userIdentifier = user?.id || user?.email || "anonymous";
  const userEmail = user?.email || "user@hacktrack.io";
  const userName = user?.fullName || user?.name || "Committee Member";

  const alreadyRedeemed = (record.redeemedBy || []).some(
    (r) => r.userId === userIdentifier || r.email === userEmail
  );

  if (!alreadyRedeemed) {
    record.redeemedBy = record.redeemedBy || [];
    record.redeemedBy.push({
      userId: userIdentifier,
      email: userEmail,
      fullName: userName,
      redeemedAt: new Date().toISOString()
    });
    saveAllAccessCodes(allCodes);
  }

  // Store user assignment in localStorage
  saveUserHackathonAssignment(userIdentifier, record.hackathonId);

  return {
    success: true,
    hackathonId: record.hackathonId,
    hackathonTitle: record.hackathonTitle,
    role: record.role,
    message: `Successfully bound to "${record.hackathonTitle}" as ${record.role.toUpperCase()}!`
  };
}

export function getUserAssignedHackathonIds(user) {
  const userIdentifier = user?.id || user?.email;
  if (!userIdentifier) return ["devpulse-2026"];

  try {
    const raw = localStorage.getItem(`${ASSIGNMENTS_STORAGE_KEY}_${userIdentifier}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }

  // Default pre-assigned hackathons for demo roles
  if (user?.role === 'judge' || user?.role === 'screening') {
    return ["devpulse-2026"];
  }

  return ["devpulse-2026"];
}

export function saveUserHackathonAssignment(userIdentifier, hackathonId) {
  if (!userIdentifier || !hackathonId) return;
  try {
    const key = `${ASSIGNMENTS_STORAGE_KEY}_${userIdentifier}`;
    const raw = localStorage.getItem(key);
    let list = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch { list = []; }
    }
    if (!list.includes(hackathonId)) {
      list.push(hackathonId);
    }
    localStorage.setItem(key, JSON.stringify(list));
    triggerDataSync("assignment_saved");
  } catch (err) {
    console.error("Failed to save user assignment:", err);
  }
}

export function getHackathonCommittee(hackathonId) {
  const allCodes = getAllAccessCodes();
  const hackCodes = allCodes.filter((c) => c.hackathonId === hackathonId);

  const judges = [];
  const screeners = [];

  hackCodes.forEach((c) => {
    if (c.role === "judge") {
      (c.redeemedBy || []).forEach((u) => {
        if (!judges.some((j) => j.email === u.email)) judges.push(u);
      });
    } else if (c.role === "screening") {
      (c.redeemedBy || []).forEach((u) => {
        if (!screeners.some((s) => s.email === u.email)) screeners.push(u);
      });
    }
  });

  // Include default seeded demo committee if devpulse-2026
  if (hackathonId === "devpulse-2026") {
    if (!judges.some((j) => j.email === "judge@hacktrack.io")) {
      judges.push({
        userId: "usr-judge-005",
        email: "judge@hacktrack.io",
        fullName: "Prof. Elena Rostova",
        redeemedAt: new Date().toISOString()
      });
    }
    if (!screeners.some((s) => s.email === "screening@hacktrack.io")) {
      screeners.push({
        userId: "usr-screening-004",
        email: "screening@hacktrack.io",
        fullName: "Dr. Marcus Vance",
        redeemedAt: new Date().toISOString()
      });
    }
  }

  return {
    codes: hackCodes,
    judges,
    screeners
  };
}

