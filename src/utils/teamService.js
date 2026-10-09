import { PRELOADED_TEAMS } from '../data/teams.js';
import { isUserRegistered } from './registrationService.js';
import { addNotification } from './notificationService.js';

const STORAGE_KEY = "hacktrack_teams";

export function getAllTeams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(PRELOADED_TEAMS));
      return { ...PRELOADED_TEAMS };
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...PRELOADED_TEAMS, ...parsed } : { ...PRELOADED_TEAMS };
  } catch {
    return { ...PRELOADED_TEAMS };
  }
}

export function saveAllTeams(teams) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  } catch (err) {
    console.error("Failed to save teams:", err);
  }
}

export function getTeamByCode(code) {
  if (!code) return null;
  const clean = code.trim().toUpperCase();
  const all = getAllTeams();
  return all[clean] || null;
}

export function getUserTeamForHackathon(userId, hackathonId) {
  if (!userId || !hackathonId) return null;
  const cleanUser = String(userId).trim().toLowerCase();
  const all = getAllTeams();

  for (const teamCode of Object.keys(all)) {
    const t = all[teamCode];
    if (t.hackathonId === hackathonId) {
      const isLead = t.leadEmail && String(t.leadEmail).toLowerCase() === cleanUser;
      const isMember = t.members?.some(
        (m) =>
          (typeof m === 'string' && m.toLowerCase().includes(cleanUser)) ||
          (typeof m === 'object' && m.email && String(m.email).toLowerCase() === cleanUser)
      );
      // Also check fallback lead string matching
      const isLeadName = typeof t.lead === 'string' && t.lead.toLowerCase() === cleanUser;

      if (isLead || isMember || isLeadName) {
        return { ...t, code: teamCode };
      }
    }
  }

  // Pre-seeded demo user fallback for Alex Chen on devpulse-2026
  if (cleanUser === 'alex@university.edu' && hackathonId === 'devpulse-2026') {
    return { ...all['HT-DEV-42'], code: 'HT-DEV-42' };
  }

  return null;
}

export function createTeam({ name, hackathonId, hackathonTitle, track, leadName, leadEmail }) {
  if (!leadEmail || !hackathonId || !name) {
    return { success: false, error: "Team name and hackathon are required." };
  }

  // 1. Check if user is registered for this hackathon
  if (!isUserRegistered(leadEmail, hackathonId)) {
    return {
      success: false,
      requiresRegistration: true,
      hackathonId,
      error: `You must register for "${hackathonTitle || hackathonId}" before creating a team.`
    };
  }

  // 2. Check if user already has a team for this hackathon
  const existingTeam = getUserTeamForHackathon(leadEmail, hackathonId);
  if (existingTeam) {
    return {
      success: false,
      error: `You already belong to team "${existingTeam.name}" for this competition.`
    };
  }

  const all = getAllTeams();
  // Generate random 8-character unique code e.g. HT-K8-20
  const randomSuffix = Math.floor(10 + Math.random() * 90);
  const randomMid = Math.random().toString(36).substring(2, 4).toUpperCase();
  const code = `HT-${randomMid}-${randomSuffix}`;

  const newTeam = {
    name: name.trim(),
    hackathon: hackathonTitle || hackathonId,
    hackathonId,
    track: track || "General Track",
    lead: leadName || "Team Lead",
    leadEmail: leadEmail.trim().toLowerCase(),
    members: [
      { name: `${leadName || "Team Lead"} (Lead)`, role: "Team Leader", email: leadEmail, status: "Active" }
    ],
    capacity: "1 / 4 Members",
    isOpen: true,
    rosterLocked: false
  };

  all[code] = newTeam;
  saveAllTeams(all);

  addNotification({
    userEmail: leadEmail,
    title: "Team Created Successfully",
    message: `Team "${newTeam.name}" created with code: ${code}. Share this code with prospective teammates.`,
    type: "success",
    link: "/dashboard/student"
  });

  return { success: true, team: { ...newTeam, code } };
}

export function joinTeamWithCode(code, user) {
  if (!code || !user) {
    return { success: false, error: "Invite code and user profile are required." };
  }

  const cleanCode = code.trim().toUpperCase();
  const all = getAllTeams();
  const targetTeam = all[cleanCode];

  if (!targetTeam) {
    return { success: false, error: `Team code "${cleanCode}" not found. Try HT-DEV-42 or HT-AI-99.` };
  }

  if (targetTeam.rosterLocked) {
    return { success: false, error: `Team "${targetTeam.name}" roster is locked by the Team Leader and no longer accepting members.` };
  }

  const userEmail = user.email ? user.email.toLowerCase() : "";
  const userName = user.fullName || "New Member";

  // 1. Verify user is registered for the hackathon this team belongs to
  if (!isUserRegistered(userEmail, targetTeam.hackathonId)) {
    return {
      success: false,
      requiresRegistration: true,
      hackathonId: targetTeam.hackathonId,
      hackathonTitle: targetTeam.hackathon,
      error: `You must register for "${targetTeam.hackathon}" before joining this team roster.`
    };
  }

  // 2. Check if user already belongs to another team in this same hackathon
  const existingTeam = getUserTeamForHackathon(userEmail, targetTeam.hackathonId);
  if (existingTeam) {
    if (existingTeam.code === cleanCode) {
      return { success: false, error: `You are already a member of "${targetTeam.name}".` };
    }
    return {
      success: false,
      error: `You already belong to team "${existingTeam.name}" for this hackathon. You cannot join multiple teams in the same competition.`
    };
  }

  // 3. Add to roster
  const updatedMembers = Array.isArray(targetTeam.members) ? [...targetTeam.members] : [];
  if (updatedMembers.length >= 4) {
    return { success: false, error: `Team "${targetTeam.name}" has reached maximum capacity (4 members).` };
  }

  updatedMembers.push({
    name: userName,
    role: "Member",
    email: userEmail,
    status: "Active"
  });

  const memberCount = updatedMembers.length;
  const updatedTeam = {
    ...targetTeam,
    members: updatedMembers,
    capacity: `${memberCount} / 4 Members`
  };

  all[cleanCode] = updatedTeam;
  saveAllTeams(all);

  // Notify team leader
  if (targetTeam.leadEmail) {
    addNotification({
      userEmail: targetTeam.leadEmail,
      title: "New Team Member Joined",
      message: `${userName} (${userEmail}) joined your team "${targetTeam.name}".`,
      type: "info",
      link: "/dashboard/student"
    });
  }

  return { success: true, team: { ...updatedTeam, code: cleanCode } };
}

export function lockTeamRoster(code, user) {
  const cleanCode = (code || "").trim().toUpperCase();
  const all = getAllTeams();
  const team = all[cleanCode];

  if (!team) return { success: false, error: "Team not found." };

  const userEmail = (user?.email || "").toLowerCase().trim();
  const isLead = team.leadEmail?.toLowerCase().trim() === userEmail || team.lead?.toLowerCase() === user?.fullName?.toLowerCase();

  if (!isLead) {
    return { success: false, error: "Only the Team Leader can lock the roster." };
  }

  team.rosterLocked = true;
  team.isOpen = false;
  all[cleanCode] = team;
  saveAllTeams(all);

  return { success: true, team: { ...team, code: cleanCode } };
}

export function unlockTeamRoster(code, user) {
  const cleanCode = (code || "").trim().toUpperCase();
  const all = getAllTeams();
  const team = all[cleanCode];

  if (!team) return { success: false, error: "Team not found." };

  const userEmail = (user?.email || "").toLowerCase().trim();
  const isLead = team.leadEmail?.toLowerCase().trim() === userEmail || team.lead?.toLowerCase() === user?.fullName?.toLowerCase();

  if (!isLead) {
    return { success: false, error: "Only the Team Leader can unlock the roster." };
  }

  team.rosterLocked = false;
  team.isOpen = true;
  all[cleanCode] = team;
  saveAllTeams(all);

  return { success: true, team: { ...team, code: cleanCode } };
}

export function removeTeamMember(code, memberEmail, user) {
  const cleanCode = (code || "").trim().toUpperCase();
  const all = getAllTeams();
  const team = all[cleanCode];

  if (!team) return { success: false, error: "Team not found." };

  const userEmail = (user?.email || "").toLowerCase().trim();
  const isLead = team.leadEmail?.toLowerCase().trim() === userEmail || team.lead?.toLowerCase() === user?.fullName?.toLowerCase();

  if (!isLead) {
    return { success: false, error: "Only the Team Leader can remove members." };
  }

  const targetClean = (memberEmail || "").toLowerCase().trim();
  if (targetClean === team.leadEmail?.toLowerCase().trim()) {
    return { success: false, error: "The Team Leader cannot be removed from the team." };
  }

  const updatedMembers = (team.members || []).filter((m) => {
    if (typeof m === 'string') return !m.toLowerCase().includes(targetClean);
    if (typeof m === 'object' && m.email) return m.email.toLowerCase().trim() !== targetClean;
    return true;
  });

  team.members = updatedMembers;
  team.capacity = `${updatedMembers.length} / 4 Members`;
  all[cleanCode] = team;
  saveAllTeams(all);

  addNotification({
    userEmail: targetClean,
    title: "Team Roster Update",
    message: `You were removed from team "${team.name}".`,
    type: "warning",
    link: "/dashboard/student"
  });

  return { success: true, team: { ...team, code: cleanCode } };
}
