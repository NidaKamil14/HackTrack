import express from 'express';
import store from '../database/store.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { notifyAccessCodeRedeemed, notifyUserRegistered, notifyPasswordReset } from '../notifications/notifier.js';

const router = express.Router();

// Helper to determine role redirect dashboard path (FR-3)
function getRoleDashboardPath(role) {
  switch (role) {
    case 'leader':
      return '/dashboard/leader';
    case 'screening':
      return '/dashboard/screening';
    case 'judge':
      return '/dashboard/judge';
    case 'admin':
      return '/dashboard/admin';
    case 'organizer':
      return '/dashboard/organizer';
    case 'mentor':
      return '/dashboard/mentor';
    case 'student':
    default:
      return '/dashboard/student';
  }
}

// FR-1: Register with unique email address
router.post('/register', (req, res) => {
  const { email, password, fullName, role, university, memberId } = req.body || {};

  if (!email || !password || !fullName) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Email, password, and fullName are mandatory fields.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Password must be at least 6 characters long.',
    });
  }

  try {
    const user = store.createUser({
      email,
      password,
      fullName,
      role: role || 'student',
      university,
      memberId,
    });

    const token = signToken(user);
    const redirectPath = getRoleDashboardPath(user.role);

    // FR-1: Trigger email notification for account registration
    notifyUserRegistered(user);

    return res.status(201).json({
      status: 201,
      message: 'User registered successfully (FR-1).',
      token,
      redirectPath,
      user,
    });
  } catch (err) {
    return res.status(409).json({
      status: 409,
      error: 'Conflict',
      message: err.message,
    });
  }
});

// FR-2: Authenticate registered user against stored credentials
// FR-3: Redirect to role-specific dashboard
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Email and password are required.',
    });
  }

  const user = store.findUserByEmail(email);
  if (!user || !store.verifyPassword(user, password)) {
    return res.status(401).json({
      status: 401,
      error: 'Unauthorized',
      message: 'Invalid email or password. Please verify your credentials.',
    });
  }

  // Enforce account active status (FR-1, FR-42)
  if (user.isActive === false || user.is_active === 0) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Your account has been deactivated. Please contact an administrator.',
    });
  }

  const { passwordHash: _hash, ...safeUser } = user;
  const token = signToken(safeUser);
  const redirectPath = getRoleDashboardPath(safeUser.role);

  return res.json({
    status: 200,
    message: 'Authentication successful (FR-2).',
    token,
    redirectPath,
    user: safeUser,
  });
});

// Get current authenticated user profile (FR-4)
router.get('/me', requireAuth, (req, res) => {
  const { passwordHash: _hash, ...safeUser } = req.user;
  return res.json({
    status: 200,
    user: safeUser,
    redirectPath: getRoleDashboardPath(safeUser.role),
  });
});

// FR-5: Password reset request via registered email
router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Email address is required.',
    });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = store.findUserByEmail(cleanEmail);
  let resetRecord = null;
  if (user) {
    resetRecord = store.createPasswordResetToken(cleanEmail);
    if (resetRecord) {
      notifyPasswordReset({ user, token: resetRecord.token });
    }
  }

  // Even if user does not exist, return standard safe message to prevent email enumeration
  return res.json({
    status: 200,
    message: 'If an account exists with this email address, a password reset link has been dispatched (FR-5).',
    // In dev environment, return preview reset token for automated testing
    resetTokenPreview: process.env.NODE_ENV !== 'production' && resetRecord ? resetRecord.token : undefined,
  });
});

// FR-5: Complete password reset with token
router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Reset token and newPassword are required.',
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'New password must be at least 6 characters long.',
    });
  }

  try {
    store.resetPasswordWithToken(token, newPassword);
    return res.json({
      status: 200,
      message: 'Password has been successfully updated. You may now log in.',
    });
  } catch (err) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: err.message,
    });
  }
});

// Seed demo users list for quick testing
router.get('/demo-users', (req, res) => {
  const demoUsers = store.getAllUsers().filter((u) => u.email.includes('university.edu') || u.email.includes('hacktrack.io'));
  return res.json({
    status: 200,
    users: demoUsers,
  });
});

// Redeem access code to bind judge or screening member to a hackathon
router.post('/redeem-code', requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Access code is required.',
    });
  }

  try {
    const result = store.redeemHackathonCode(code, req.user.id);
    const codeRecord = store.hackathonCodes.find((c) => c.code.toUpperCase() === String(code).trim().toUpperCase());
    notifyAccessCodeRedeemed(result, req.user.id, codeRecord?.createdBy);
    return res.json({
      status: 200,
      message: `Successfully bound to ${result.hackathonTitle} as ${result.role}.`,
      assignment: result,
      user: req.user,
    });
  } catch (err) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: err.message,
    });
  }
});

// Get hackathons assigned to current user
router.get('/my-hackathons', requireAuth, (req, res) => {
  const hackathons = store.getUserAssignedHackathons(req.user.id);
  return res.json({
    status: 200,
    hackathons,
  });
});

export default router;
