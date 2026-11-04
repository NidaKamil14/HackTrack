import { normalizeHackathonId } from './registrationService.js';
import { getUserAssignedHackathonIds } from './hackathonService.js';

const STORAGE_KEY = "hacktrack_notifications";

export function getNotifications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveNotifications(notifications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("hacktrack_notifications_updated"));
      window.dispatchEvent(new CustomEvent("hacktrack_data_sync", { detail: { eventType: "notifications_updated" } }));
    }
  } catch (err) {
    console.error("Failed to persist notifications:", err);
  }
}

/**
 * Synchronize role-based contextual notifications from persisted application state.
 * Uses deterministic IDs to guarantee zero duplicates and preserve read/unread states.
 */
export function syncRoleNotifications(user) {
  if (!user) return;
  const cleanEmail = (typeof user === "string" ? user : user?.email || "").toLowerCase().trim();
  if (!cleanEmail) return;

  const role = (typeof user === "object" ? user?.role : null) || "";
  let all = getNotifications();
  let updated = false;

  const pushIfAbsent = (notif) => {
    if (!all.some((n) => n.id === notif.id)) {
      all.unshift({
        ...notif,
        date: notif.date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        read: false,
      });
      updated = true;
    }
  };

  try {
    const rawHacks = localStorage.getItem("hacktrack_hackathons");
    const hackathons = rawHacks ? JSON.parse(rawHacks) : [];

    const rawRegs = localStorage.getItem("hacktrack_registrations");
    const regs = rawRegs ? JSON.parse(rawRegs) : [];

    const rawTeams = localStorage.getItem("hacktrack_teams");
    const teamsObj = rawTeams ? JSON.parse(rawTeams) : {};
    const teamsList = Object.values(teamsObj || {});

    // Compute user's legitimate hackathon associations
    const userRegHackIds = new Set();
    if (Array.isArray(regs)) {
      regs
        .filter((r) => String(r.userId || "").toLowerCase().trim() === cleanEmail)
        .forEach((r) => {
          if (r.hackathonId) userRegHackIds.add(normalizeHackathonId(r.hackathonId));
        });
    }

    const userTeamHackIds = new Set();
    teamsList.forEach((t) => {
      if (!t || !t.code) return;
      const isLead = (t.leadEmail || "").toLowerCase().trim() === cleanEmail;
      const isMember = Array.isArray(t.members) && t.members.some((m) => (m.email || "").toLowerCase().trim() === cleanEmail);
      if (isLead || isMember) {
        if (t.hackathonId) userTeamHackIds.add(normalizeHackathonId(t.hackathonId));
        if (t.hackathon) userTeamHackIds.add(normalizeHackathonId(t.hackathon));
      }
    });

    const userOrgHackIds = new Set();
    if (role === 'organizer' && Array.isArray(hackathons)) {
      hackathons.forEach((h) => {
        const hEmail = (h.organizerEmail || "").toLowerCase().trim();
        const hCreator = String(h.createdBy || "").toLowerCase().trim();
        if (hEmail === cleanEmail || (user?.id && hCreator === String(user.id).toLowerCase()) || cleanEmail === "organizer@hacktrack.io") {
          userOrgHackIds.add(normalizeHackathonId(h.id));
        }
      });
    }

    const assignedIds = getUserAssignedHackathonIds(user) || [];
    const userAssignedHackIds = new Set(assignedIds.map(normalizeHackathonId));

    // A hackathon is associated with this user if:
    // - User registered for it
    // - User is in a team for it
    // - User is the organizer for it
    // - User is an assigned reviewer (judge, screening, mentor) for it
    // - Or user is admin (admin has platform-wide oversight)
    const isAssociatedWithHackathon = (hackId) => {
      if (role === 'admin') return true;
      const norm = normalizeHackathonId(hackId);
      return userRegHackIds.has(norm) ||
        userTeamHackIds.has(norm) ||
        userOrgHackIds.has(norm) ||
        userAssignedHackIds.has(norm);
    };

    // 0. PRUNE STALE / LEAKED NOTIFICATIONS:
    // Purge any previously stored notifications for hackathons the user is NOT associated with
    const initialCount = all.length;
    all = all.filter((n) => {
      if (n.userEmail && n.userEmail.toLowerCase().trim() === cleanEmail) {
        if (n.id && n.id.startsWith("deadline-")) {
          const suffix = `-${cleanEmail}`;
          if (n.id.endsWith(suffix)) {
            const hackId = n.id.slice("deadline-".length, n.id.length - suffix.length);
            if (hackId && !isAssociatedWithHackathon(hackId)) {
              return false;
            }
          }
        }
        if (n.id && n.id.startsWith("reg-") && !n.id.startsWith("reg-demo-")) {
          const suffix = `-${cleanEmail}`;
          if (n.id.endsWith(suffix)) {
            const hackId = n.id.slice("reg-".length, n.id.length - suffix.length);
            if (hackId && !userRegHackIds.has(normalizeHackathonId(hackId))) {
              return false;
            }
          }
        }
      }
      return true;
    });
    if (all.length !== initialCount) {
      updated = true;
    }

    // 1. Approaching Deadlines: STRICTLY for associated hackathons only!
    if (Array.isArray(hackathons)) {
      hackathons.forEach((h) => {
        if (!h || !h.id) return;
        if (!isAssociatedWithHackathon(h.id)) return; // Strict Isolation Check!

        const deadline = h.deadline || h.submissionDeadline || h.dates;
        if (!deadline || deadline === "TBD") return;

        pushIfAbsent({
          id: `deadline-${h.id}-${cleanEmail}`,
          userEmail: cleanEmail,
          title: `Deadline Approaching: ${h.title}`,
          message: `The submission deadline (${deadline}) for ${h.title} is approaching. Make sure deliverables and rosters are up to date.`,
          type: "warning",
          link: `/hackathons/${h.id}`,
        });
      });
    }

    // 2. Participant / Student Notifications
    if (Array.isArray(regs)) {
      regs
        .filter((r) => String(r.userId || "").toLowerCase().trim() === cleanEmail)
        .forEach((r) => {
          pushIfAbsent({
            id: `reg-${r.hackathonId}-${cleanEmail}`,
            userEmail: cleanEmail,
            title: "Registration Confirmed",
            message: `You are officially registered for competition "${r.hackathonId}". Form your team or review tracks.`,
            type: "success",
            link: "/dashboard/student?tab=workspace",
          });
        });
    }

    // 3. Team-specific notifications (Participant & Team Leader)
    teamsList.forEach((t) => {
      if (!t || !t.code) return;
      const isLead = (t.leadEmail || "").toLowerCase().trim() === cleanEmail;
      const isMember = Array.isArray(t.members) && t.members.some((m) => (m.email || "").toLowerCase().trim() === cleanEmail);

      // If active team member
      if (isMember && !isLead) {
        pushIfAbsent({
          id: `membership-${t.code}-${cleanEmail}`,
          userEmail: cleanEmail,
          title: "Squad Roster Active",
          message: `You are an active member of squad "${t.name}" (Code: ${t.code}). Check the roster for details.`,
          type: "success",
          link: "/dashboard/student?tab=roster",
        });
      }

      // If Team Leader: check pending join requests
      if (isLead && Array.isArray(t.pendingRequests) && t.pendingRequests.length > 0) {
        t.pendingRequests.forEach((req) => {
          const reqKey = req.id || req.email || "pending";
          pushIfAbsent({
            id: `leader-req-${t.code}-${reqKey}-${cleanEmail}`,
            userEmail: cleanEmail,
            title: "New Join Request Received",
            message: `${req.name || req.email} requested to join "${t.name}". Review and accept from Team & Roster.`,
            type: "info",
            link: "/dashboard/student?tab=roster",
          });
        });
      }
    });

    // 4. Submissions & Screening Results (Team Leader & Participant)
    const rawSubs = localStorage.getItem("hacktrack_submissions");
    const subs = rawSubs ? JSON.parse(rawSubs) : [];
    if (Array.isArray(subs)) {
      subs.forEach((s) => {
        if (!s) return;
        const isSubmitter = (s.submittedBy || "").toLowerCase().trim() === cleanEmail;
        if (!isSubmitter) return;

        // Submission saved/finalized
        if (s.status === "finalized") {
          pushIfAbsent({
            id: `sub-final-${s.submissionId || s.id || s.teamId}-${cleanEmail}`,
            userEmail: cleanEmail,
            title: "Deliverables Finalized & Locked",
            message: `Project "${s.projectTitle}" has been submitted and locked for screening committee gate review.`,
            type: "success",
            link: "/dashboard/student?tab=workspace",
          });
        }

        // Screening result
        if (s.screeningStatus === "Shortlisted") {
          pushIfAbsent({
            id: `screening-shortlisted-${s.submissionId || s.id || s.teamId}-${cleanEmail}`,
            userEmail: cleanEmail,
            title: "Screening Passed: Shortlisted!",
            message: `Congratulations! "${s.projectTitle}" was shortlisted by the Screening Committee and advanced to judging.`,
            type: "success",
            link: "/dashboard/student?tab=results",
          });
        } else if (s.screeningStatus === "Rejected") {
          pushIfAbsent({
            id: `screening-rejected-${s.submissionId || s.id || s.teamId}-${cleanEmail}`,
            userEmail: cleanEmail,
            title: "Screening Decision Recorded",
            message: `Screening review for "${s.projectTitle}" concluded: Not shortlisted.`,
            type: "info",
            link: "/dashboard/student?tab=results",
          });
        }
      });
    }

    // 5. Organizer Notifications
    if (role === "organizer") {
      if (Array.isArray(hackathons) && hackathons.length > 0) {
        pushIfAbsent({
          id: `org-overview-${cleanEmail}`,
          userEmail: cleanEmail,
          title: "Organizer Portal Active",
          message: `${hackathons.length} hackathon(s) configured. Monitor tracks, review criteria, and participant registrations.`,
          type: "info",
          link: "/dashboard/organizer",
        });
      }

      // Check registrations for organizer's competitions
      if (Array.isArray(regs) && Array.isArray(hackathons)) {
        const myHacks = hackathons.filter((h) => {
          const hEmail = (h.organizerEmail || "").toLowerCase().trim();
          const hCreator = String(h.createdBy || "").toLowerCase().trim();
          return hEmail === cleanEmail || (user?.id && hCreator === String(user.id).toLowerCase()) || cleanEmail === "organizer@hacktrack.io";
        });
        const myHackIds = new Set(myHacks.map((h) => normalizeHackathonId(h.id)));
        regs
          .filter((r) => myHackIds.has(normalizeHackathonId(r.hackathonId)))
          .forEach((r) => {
            pushIfAbsent({
              id: `org-reg-${r.hackathonId}-${r.userId}-${cleanEmail}`,
              userEmail: cleanEmail,
              title: "Participant Registered",
              message: `Participant ${r.userId} registered for competition "${r.hackathonId}".`,
              type: "info",
              link: "/dashboard/organizer",
            });
          });
      }
    }

    // 6. Screening Committee Notifications
    if (role === "screening") {
      const myAssignedIds = userAssignedHackIds;
      const pendingScreening = Array.isArray(subs) && subs.filter((s) => {
        const matchHack = myAssignedIds.size === 0 || myAssignedIds.has(normalizeHackathonId(s.hackathonId));
        return matchHack && (s.screeningStatus === "Pending Review" || s.screeningStatus === "pending");
      }).length;

      if (pendingScreening > 0) {
        pushIfAbsent({
          id: `screening-pending-queue-${cleanEmail}`,
          userEmail: cleanEmail,
          title: "Teams Awaiting Screening",
          message: `${pendingScreening} project submission(s) currently awaiting screening gate verification.`,
          type: "warning",
          link: "/dashboard/screening",
        });
      }
    }

    // 7. Judge Notifications
    if (role === "judge") {
      pushIfAbsent({
        id: `judge-panel-active-${cleanEmail}`,
        userEmail: cleanEmail,
        title: "Evaluation Panel Active",
        message: "Finalist evaluations are active. Score pre-screened teams across standardized criteria rubrics.",
        type: "info",
        link: "/dashboard/judge",
      });
    }

    // 8. Mentor Notifications
    if (role === "mentor") {
      pushIfAbsent({
        id: `mentor-panel-active-${cleanEmail}`,
        userEmail: cleanEmail,
        title: "Technical Mentorship Active",
        message: "Guide competitor squads, review technical architecture drafts, and provide domain advisory.",
        type: "info",
        link: "/dashboard/mentor",
      });
    }

    // 9. Admin Notifications
    if (role === "admin") {
      pushIfAbsent({
        id: `admin-hub-active-${cleanEmail}`,
        userEmail: cleanEmail,
        title: "Platform Administration Ready",
        message: "Admin controls online. Manage users, track competition stages, and publish official results.",
        type: "info",
        link: "/dashboard/admin",
      });

      // Synchronize notifications for competitions published by organizers
      if (Array.isArray(hackathons)) {
        hackathons.forEach((h) => {
          if (!h || !h.id) return;
          pushIfAbsent({
            id: `admin-new-hack-${h.id}`,
            userEmail: cleanEmail,
            title: "New Hackathon Published",
            message: `Competition "${h.title}" has been published by ${h.organizerName || h.organizers?.[0] || 'Organizer'}.`,
            type: "info",
            link: "/dashboard/admin",
          });
        });
      }
    }

    if (updated) {
      saveNotifications(all);
    }
  } catch (err) {
    console.error("Failed to sync role notifications:", err);
  }
}

export function getUserNotifications(user) {
  if (!user) return [];
  const cleanEmail = (typeof user === "string" ? user : user?.email || "").toLowerCase().trim();
  if (!cleanEmail) return [];

  // Run dynamic synchronization
  syncRoleNotifications(user);

  const all = getNotifications();
  return all.filter((n) => !n.userEmail || n.userEmail.toLowerCase().trim() === cleanEmail || n.userEmail === "all");
}

export function getUnreadNotificationCount(user) {
  return getUserNotifications(user).filter((n) => !n.read).length;
}

export function addNotification({ userEmail, title, message, type = "info", link = "/dashboard/student" }) {
  const all = getNotifications();
  const cleanEmail = (userEmail || "").toLowerCase().trim();

  const newNotif = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    userEmail: cleanEmail,
    title,
    message,
    type,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    read: false,
    link,
  };

  const updated = [newNotif, ...all];
  saveNotifications(updated);
  return newNotif;
}

export function markAsRead(id) {
  const all = getNotifications();
  const updated = all.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(updated);
}

export function markAllAsRead(userEmail) {
  const cleanEmail = (userEmail || "").toLowerCase().trim();
  const all = getNotifications();
  const updated = all.map((n) => {
    if (!cleanEmail || !n.userEmail || n.userEmail.toLowerCase().trim() === cleanEmail || n.userEmail === "all") {
      return { ...n, read: true };
    }
    return n;
  });
  saveNotifications(updated);
}
