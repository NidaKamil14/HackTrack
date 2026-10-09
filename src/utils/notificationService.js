const STORAGE_KEY = "hacktrack_notifications";

const DEFAULT_NOTIFICATIONS = [
  {
    id: "notif-1",
    userEmail: "alex@university.edu",
    title: "Registration Verified",
    message: "Your registration for DevPulse National Sprint has been confirmed.",
    type: "success",
    date: "Oct 04, 2026",
    read: false,
    link: "/dashboard/student"
  },
  {
    id: "notif-2",
    userEmail: "alex@university.edu",
    title: "Squad Roster Ready",
    message: "AsyncCoders has 3 active members. Roster lock deadline is approaching.",
    type: "info",
    date: "Oct 05, 2026",
    read: false,
    link: "/dashboard/student"
  },
  {
    id: "notif-3",
    userEmail: "alex@university.edu",
    title: "Upcoming Code Freeze",
    message: "Final code freeze & demo link submission closes Oct 20 at 20:00 UTC.",
    type: "warning",
    date: "Oct 06, 2026",
    read: true,
    link: "/dashboard/student"
  },
  {
    id: "notif-4",
    userEmail: "sarah.jenkins@example.com",
    title: "Screening Passed",
    message: "NeuralShift submission was Shortlisted by the Screening Committee.",
    type: "success",
    date: "Oct 05, 2026",
    read: false,
    link: "/dashboard/student"
  }
];

export function getNotifications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
      return DEFAULT_NOTIFICATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_NOTIFICATIONS;
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

export function saveNotifications(notifications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (err) {
    console.error("Failed to persist notifications:", err);
  }
}

export function getUserNotifications(userEmail) {
  if (!userEmail) return [];
  const cleanEmail = userEmail.toLowerCase().trim();
  const all = getNotifications();
  return all.filter((n) => !n.userEmail || n.userEmail.toLowerCase().trim() === cleanEmail || n.userEmail === "all");
}

export function addNotification({ userEmail, title, message, type = "info", link = "/dashboard/student" }) {
  const all = getNotifications();
  const newNotif = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    userEmail: (userEmail || "").toLowerCase().trim(),
    title,
    message,
    type,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    read: false,
    link
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
