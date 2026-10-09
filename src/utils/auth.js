// Pre-seeded demo user accounts for immediate testing
export const DEMO_USERS = [
  {
    email: "alex@university.edu",
    password: "password123",
    fullName: "Alex Chen",
    role: "leader",
    roleCategory: "Team Leader",
    university: "Stanford University",
    memberId: "LEAD-88219"
  },
  {
    email: "priya@university.edu",
    password: "password123",
    fullName: "Priya Sharma",
    role: "student",
    roleCategory: "Student / Participant",
    university: "Stanford University",
    memberId: "STU-55412"
  },
  {
    email: "screening@hacktrack.io",
    password: "password123",
    fullName: "Dr. Marcus Vance",
    role: "screening",
    roleCategory: "Screening Committee",
    university: "Engineering Review Board",
    memberId: "SC-904"
  },
  {
    email: "judge@hacktrack.io",
    password: "password123",
    fullName: "Prof. Elena Rostova",
    role: "judge",
    roleCategory: "Judge / Evaluator",
    university: "ACM Expert Panel",
    memberId: "JDG-331"
  },
  {
    email: "admin@hacktrack.io",
    password: "password123",
    fullName: "Sarah Jenkins (Admin)",
    role: "admin",
    roleCategory: "Platform Administrator",
    university: "HackTrack Central HQ",
    memberId: "ADM-001"
  },
  {
    email: "organizer@hacktrack.io",
    password: "password123",
    fullName: "Kavita Rao",
    role: "organizer",
    roleCategory: "Hackathon Organizer",
    university: "DevPulse Operations Committee",
    memberId: "ORG-102"
  },
  {
    email: "mentor@hacktrack.io",
    password: "password123",
    fullName: "David Sterling",
    role: "mentor",
    roleCategory: "Technical Mentor",
    university: "Cloud Architecture Guild",
    memberId: "MTR-404"
  }
];

const STORAGE_USERS_KEY = "hacktrack_users";
const STORAGE_CURRENT_USER_KEY = "hacktrack_current_user";

// Get all registered users including demo seeds
export function getUsers() {
  try {
    const stored = localStorage.getItem(STORAGE_USERS_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(DEMO_USERS));
      return DEMO_USERS;
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEMO_USERS;
  } catch {
    return DEMO_USERS;
  }
}

export function saveUsers(users) {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.error("Storage error:", err);
  }
}

// Get currently active logged-in user
export function getCurrentUser() {
  try {
    const stored = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Log in a user by email and password
export function authenticateUser(email, password) {
  const users = getUsers();
  const cleanEmail = email.trim().toLowerCase();
  
  const user = users.find(
    (u) => u.email.toLowerCase() === cleanEmail && u.password === password
  );

  if (user) {
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
    return { success: true, user };
  }

  return { success: false, error: "Invalid credentials. Use demo credentials or register a new account." };
}

// Register a new user
export function registerUser(userData) {
  const users = getUsers();
  const cleanEmail = userData.email.trim().toLowerCase();

  const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return { success: false, error: "An account with this email address already exists. Please log in." };
  }

  // Map role
  const normalizedRole = userData.role || "student";

  const newUser = {
    fullName: userData.fullName.trim(),
    email: cleanEmail,
    password: userData.password,
    role: normalizedRole,
    roleCategory: getRoleTitle(normalizedRole),
    university: userData.university || "University / Organization",
    memberId: userData.memberId || `ID-${Math.floor(10000 + Math.random() * 90000)}`
  };

  const updatedUsers = [...users, newUser];
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updatedUsers));
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(newUser));
  } catch (err) {
    console.error("Storage error:", err);
  }

  return { success: true, user: newUser };
}

// Log out user
export function logoutUser() {
  try {
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  } catch (err) {
    console.error("Logout error:", err);
  }
}

// Update a user's role (Admin action)
export function updateUserRole(userEmail, newRole) {
  const users = getUsers();
  const clean = userEmail.toLowerCase().trim();
  const index = users.findIndex((u) => u.email.toLowerCase() === clean);
  if (index === -1) return { success: false, error: "User not found" };

  users[index].role = newRole;
  users[index].roleCategory = getRoleTitle(newRole);
  saveUsers(users);

  // If currently logged in user is modified, update session
  const current = getCurrentUser();
  if (current && current.email.toLowerCase() === clean) {
    current.role = newRole;
    current.roleCategory = getRoleTitle(newRole);
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(current));
  }

  return { success: true, user: users[index] };
}

// Helper to get role dashboard path
export function getRoleDashboardPath(role) {
  switch (role) {
    case "leader":
      return "/dashboard/leader";
    case "screening":
      return "/dashboard/screening";
    case "judge":
      return "/dashboard/judge";
    case "admin":
      return "/dashboard/admin";
    case "organizer":
      return "/dashboard/organizer";
    case "mentor":
      return "/dashboard/mentor";
    case "student":
    default:
      return "/dashboard/student";
  }
}

// Helper to get display title for a role
export function getRoleTitle(role) {
  switch (role) {
    case "leader":
      return "Team Leader";
    case "screening":
      return "Screening Committee";
    case "judge":
      return "Judge / Evaluator";
    case "admin":
      return "Platform Administrator";
    case "organizer":
      return "Hackathon Organizer";
    case "mentor":
      return "Technical Mentor";
    case "student":
    default:
      return "Student / Participant";
  }
}
