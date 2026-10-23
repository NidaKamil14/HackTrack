import api from './api.js';
import { addNotification } from './notificationService.js';
import { triggerDataSync } from './syncService.js';

const STORAGE_KEY = "hacktrack_registrations";

// Pre-seeded registrations so demo users are already registered for their events
const DEFAULT_REGISTRATIONS = [
  {
    id: "reg-devpulse-alex",
    userId: "alex@university.edu",
    hackathonId: "devpulse-2026",
    registrationDate: "Oct 04, 2026",
    status: "Registration Verified"
  },
  {
    id: "reg-devpulse-priya",
    userId: "priya@university.edu",
    hackathonId: "devpulse-2026",
    registrationDate: "Oct 05, 2026",
    status: "Registration Verified"
  },
  {
    id: "reg-shesolves-nida",
    userId: "nida@university.edu",
    hackathonId: "hack-shesolves-001",
    registrationDate: "Oct 20, 2026",
    status: "Registration Verified"
  }
];

// Helper to normalize hackathon IDs across canonical IDs and slug aliases
export function normalizeHackathonId(id) {
  if (!id) return '';
  const clean = String(id).trim().toLowerCase();
  const map = {
    'devpulse-2026': 'hack-001',
    'devpulse': 'hack-001',
    'pccoe-innovatex-2026': 'hack-002',
    'innovatex-2026': 'hack-002',
    'innovatex': 'hack-002',
    'she-solves-2026': 'hack-shesolves-001',
    'shesolves': 'hack-shesolves-001',
    'she-solves': 'hack-shesolves-001',
    'shesolves-2026': 'hack-shesolves-001',
    'shesolves2026': 'hack-shesolves-001',
  };
  return map[clean] || clean;
}

export function getRegistrations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_REGISTRATIONS));
      return DEFAULT_REGISTRATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_REGISTRATIONS;
  } catch {
    return DEFAULT_REGISTRATIONS;
  }
}

export function getUserRegistrations(userId) {
  if (!userId) return [];
  const cleanId = String(userId).trim().toLowerCase();
  const all = getRegistrations();
  return all.filter((r) => String(r.userId).toLowerCase() === cleanId);
}

export function isUserRegistered(userId, hackathonId) {
  if (!userId || !hackathonId) return false;
  const userRegs = getUserRegistrations(userId);
  const normTarget = normalizeHackathonId(hackathonId);
  return userRegs.some((r) => {
    if (r.hackathonId === hackathonId) return true;
    if (normalizeHackathonId(r.hackathonId) === normTarget) return true;
    return false;
  });
}

export function registerForHackathon(userId, hackathonId) {
  if (!userId || !hackathonId) {
    return { success: false, error: "User ID and Hackathon ID are required." };
  }

  const cleanId = String(userId).trim().toLowerCase();
  const all = getRegistrations();
  const normTarget = normalizeHackathonId(hackathonId);

  const existing = all.find(
    (r) =>
      String(r.userId).toLowerCase() === cleanId &&
      (r.hackathonId === hackathonId || normalizeHackathonId(r.hackathonId) === normTarget)
  );

  if (existing) {
    return {
      success: false,
      alreadyRegistered: true,
      error: "You are already registered for this competition.",
      registration: existing
    };
  }

  const newReg = {
    id: `reg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId: cleanId,
    hackathonId,
    registrationDate: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    }),
    status: "Registration Verified"
  };

  const updated = [newReg, ...all];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    triggerDataSync("registration_created");
  } catch (err) {
    console.error("Failed to persist registration:", err);
  }

  // Attempt backend persistence to MySQL
  if (api.getToken()) {
    api.registerForHackathon(hackathonId).catch((err) => {
      console.warn("Backend registration sync warning:", err.message);
    });
  }

  addNotification({
    userEmail: cleanId,
    title: "Registration Confirmed",
    message: `Your registration for "${hackathonId}" has been confirmed. You can now form or join a squad.`,
    type: "success",
    link: "/dashboard/student?tab=workspace"
  });

  return { success: true, registration: newReg };
}
