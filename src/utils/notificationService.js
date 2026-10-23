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
  const all = getNotifications();
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
    // 1. Approaching Deadlines (All authenticated users)
    const rawHacks = localStorage.getItem("hacktrack_hackathons");
    const hackathons = rawHacks ? JSON.parse(rawHacks) : [];
    if (Array.isArray(hackathons)) {
      hackathons.forEach((h) => {
        if (!h || !h.id) return;
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
    const rawRegs = localStorage.getItem("hacktrack_registrations");
    const regs = rawRegs ? JSON.parse(rawRegs) : [];
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
    const rawTeams = localStorage.getItem("hacktrack_teams");
    const teamsObj = rawTeams ? JSON.parse(rawTeams) : {};
    const teamsList = Object.values(teamsObj || {});

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
    }

    // 6. Screening Committee Notifications
    if (role === "screening") {
      const pendingScreening = Array.isArray(subs) && subs.filter((s) => s.screeningStatus === "Pending Review" || s.screeningStatus === "pending").length;
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

    // 8. Admin Notifications
    if (role === "admin") {
      pushIfAbsent({
        id: `admin-hub-active-${cleanEmail}`,
        userEmail: cleanEmail,
        title: "Platform Administration Ready",
        message: "Admin controls online. Manage users, track competition stages, and publish official results.",
        type: "info",
        link: "/dashboard/admin",
      });
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
