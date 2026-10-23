import { PRELOADED_TEAMS } from '../data/teams.js';
import { isUserRegistered, normalizeHackathonId } from './registrationService.js';
import { addNotification } from './notificationService.js';
import { triggerDataSync } from './syncService.js';
import api from './api.js';

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
    triggerDataSync("teams_updated");
  } catch (err) {
    console.error("Failed to save teams:", err);
  }
}

export function saveTeam(team) {
  if (!team) return;
  const code = (team.code || team.teamCode || '').trim().toUpperCase();
  if (!code) return;
  const all = getAllTeams();
  all[code] = {
    ...team,
    code,
  };
  saveAllTeams(all);
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
  const targetNorm = normalizeHackathonId(hackathonId);

  for (const teamCode of Object.keys(all)) {
    const t = all[teamCode];
    const tNorm = normalizeHackathonId(t.hackathonId);
    if (t.hackathonId === hackathonId || (tNorm && targetNorm && tNorm === targetNorm)) {
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

  // Pre-seeded demo user fallback for Alex Chen on devpulse-2026 only
  if (cleanUser === 'alex@university.edu' && (hackathonId === 'devpulse-2026' || targetNorm === 'hack-001')) {
    return { ...all['HT-DEV-42'], code: 'HT-DEV-42' };
  }

  return null;
}

export function createTeam({ name, hackathonId, hackathonTitle, track, leadName, leadEmail, user }) {
  if (!leadEmail || !hackathonId || !name) {
    return { success: false, error: "Team name and hackathon are required." };
  }

  // Enforce Team Leader role (FR-12, BR-1)
  let effectiveRole = user?.role;
  if (!effectiveRole) {
    try {
      const cur = JSON.parse(localStorage.getItem('hacktrack_current_user') || '{}');
      effectiveRole = cur?.role;
    } catch {
      effectiveRole = null;
    }
  }

  if (effectiveRole && effectiveRole !== 'leader') {
    return {
      success: false,
      error: "Only users with the Team Leader role are authorized to create a team (FR-12, BR-1)."
    };
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
    code,
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

export async function joinTeamWithCode(code, user) {
  if (!code || !user) {
    return { success: false, error: "Invite code and user profile are required." };
  }

  const cleanCode = code.trim().toUpperCase();

  // Route through backend API if authenticated with backend JWT
  if (api.getToken()) {
    try {
      const data = await api.joinTeam(cleanCode);
      return {
        success: true,
        pending: true,
        message: data.message || "Join request submitted! Awaiting Team Leader approval.",
        request: data.request,
      };
    } catch (err) {
      return {
        success: false,
        error: err.data?.message || err.message || "Failed to submit join request.",
      };
    }
  }

  // Local fallback mode
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
      return { success: false, error: `You are already an accepted member of "${targetTeam.name}".` };
    }
    return {
      success: false,
      error: `You already belong to team "${existingTeam.name}" for this hackathon. You cannot join multiple teams in the same competition.`
    };
  }

  // 3. Check if user already submitted a pending request
  targetTeam.pendingRequests = targetTeam.pendingRequests || [];
  const alreadyPending = targetTeam.pendingRequests.find(
    (p) => (p.email && p.email.toLowerCase() === userEmail) || p.name === userName
  );
  if (alreadyPending) {
    return { success: false, error: "Join request already pending approval by the Team Leader." };
  }

  // 4. Check active capacity limit
  const activeMembers = Array.isArray(targetTeam.members) ? targetTeam.members.filter((m) => m.status === 'Active') : [];
  if (activeMembers.length >= 4) {
    return { success: false, error: `Team "${targetTeam.name}" has reached maximum capacity (4 members).` };
  }

  // 5. Store request in pendingRequests (DO NOT add to active members!)
  const newRequest = {
    id: `req-${Date.now()}`,
    name: userName,
    email: userEmail,
    university: user.university || "University",
    requestedAt: new Date().toISOString(),
    status: "Pending",
  };
  targetTeam.pendingRequests.push(newRequest);

  all[cleanCode] = targetTeam;
  saveAllTeams(all);

  // Notify team leader of incoming request
  if (targetTeam.leadEmail) {
    addNotification({
      userEmail: targetTeam.leadEmail,
      title: "New Join Request Received",
      message: `${userName} (${userEmail}) requested to join "${targetTeam.name}". Review in your Team & Roster dashboard.`,
      type: "info",
      link: "/dashboard/student"
    });
  }

  // Notify participant of submitted request
  addNotification({
    userEmail: userEmail,
    title: "Join Request Submitted",
    message: `Your request to join "${targetTeam.name}" (Code: ${cleanCode}) has been submitted to the Team Leader.`,
    type: "info",
    link: "/dashboard/student?tab=roster"
  });

  return {
    success: true,
    pending: true,
    message: `Join request submitted for "${targetTeam.name}". Awaiting Team Leader approval.`,
    team: targetTeam,
    request: newRequest,
  };
}

export function respondToTeamJoinRequest(code, requestId, action, user) {
  const cleanCode = (code || "").trim().toUpperCase();
  const all = getAllTeams();
  const team = all[cleanCode];
  if (!team) return { success: false, error: "Team not found." };

  const userEmail = (user?.email || "").toLowerCase().trim();
  const isLead = team.leadEmail?.toLowerCase().trim() === userEmail || team.lead?.toLowerCase() === user?.fullName?.toLowerCase();
  if (!isLead) {
    return { success: false, error: "Only the Team Leader can approve or reject join requests." };
  }

  team.pendingRequests = team.pendingRequests || [];
  const reqIdx = team.pendingRequests.findIndex((r) => r.id === requestId);
  if (reqIdx === -1) return { success: false, error: "Join request not found." };

  const req = team.pendingRequests[reqIdx];

  if (action === "accept") {
    if (team.rosterLocked) {
      return { success: false, error: "Team roster is locked. Cannot accept join requests while roster is locked." };
    }
    const activeMembers = (team.members || []).filter((m) => m.status === "Active");
    if (activeMembers.length >= 4) {
      return { success: false, error: "Team has reached maximum capacity (4 members)." };
    }

    team.pendingRequests.splice(reqIdx, 1);
    team.members = team.members || [];
    team.members.push({
      name: req.name,
      role: "Member",
      email: req.email,
      status: "Active",
      university: req.university,
    });
    team.capacity = `${team.members.filter((m) => m.status === "Active").length} / 4 Members`;

    all[cleanCode] = team;
    saveAllTeams(all);

    if (req.email) {
      addNotification({
        userEmail: req.email,
        title: "Join Request Approved",
        message: `Your request to join "${team.name}" was accepted! You are now an active team member.`,
        type: "success",
        link: "/dashboard/student",
      });
    }

    if (userEmail) {
      addNotification({
        userEmail: userEmail,
        title: "New Member Added to Roster",
        message: `You accepted ${req.name} (${req.email}) into squad "${team.name}".`,
        type: "success",
        link: "/dashboard/student?tab=roster",
      });
    }

    return { success: true, message: `${req.name} has been added to the team roster.`, team };
  } else {
    team.pendingRequests.splice(reqIdx, 1);
    all[cleanCode] = team;
    saveAllTeams(all);

    if (req.email) {
      addNotification({
        userEmail: req.email,
        title: "Join Request Declined",
        message: `Your request to join "${team.name}" was declined by the Team Leader.`,
        type: "info",
        link: "/dashboard/student",
      });
    }

    if (userEmail) {
      addNotification({
        userEmail: userEmail,
        title: "Join Request Declined",
        message: `You declined ${req.name}'s request to join "${team.name}".`,
        type: "info",
        link: "/dashboard/student?tab=roster",
      });
    }

    return { success: true, message: `Join request for ${req.name} has been rejected.`, team };
  }
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
