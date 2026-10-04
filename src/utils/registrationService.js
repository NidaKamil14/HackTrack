const STORAGE_KEY = "hacktrack_registrations";

// Pre-seeded registration so demo user (Alex Chen) is already registered for DevPulse
const DEFAULT_REGISTRATIONS = [
  {
    id: "reg-devpulse-alex",
    userId: "alex@university.edu",
    hackathonId: "devpulse-2026",
    registrationDate: "Oct 04, 2026",
    status: "Registration Verified"
  }
];

export function getRegistrations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_REGISTRATIONS));
      return DEFAULT_REGISTRATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_REGISTRATIONS;
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
  return userRegs.some((r) => r.hackathonId === hackathonId);
}

export function registerForHackathon(userId, hackathonId) {
  if (!userId || !hackathonId) {
    return { success: false, error: "User ID and Hackathon ID are required." };
  }

  const cleanId = String(userId).trim().toLowerCase();
  const all = getRegistrations();

  const existing = all.find(
    (r) => String(r.userId).toLowerCase() === cleanId && r.hackathonId === hackathonId
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
  } catch (err) {
    console.error("Failed to persist registration:", err);
  }

  return { success: true, registration: newReg };
}
