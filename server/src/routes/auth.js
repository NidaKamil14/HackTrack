import express from 'express';
import store, { toSafeUser } from '../database/store.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { loginLimiter, registerLimiter, forgotIpLimiter, forgotEmailLimiter, resetLimiter, redeemLimiter } from '../middleware/rateLimit.js';
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

const isStr = (v, max = 500) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

// Platform invite keys for roles that aren't tied to one event (organizer,
// mentor). Configure ORGANIZER_INVITE_CODES / MENTOR_INVITE_CODES (comma
// separated). Outside production the documented demo keys also work; in
// production only configured keys are accepted.
const DEV_ORGANIZER_KEYS = ['ORG-INVITE-2026', 'ORGANIZER-AUTH-2026', 'ORG-2026-DEV', 'DEVPULSE-ORG-2026', 'PCCOE-ORG-2026'];
const DEV_MENTOR_KEYS = ['MENTOR-INVITE-2026'];
function inviteKeys(envName, devDefaults) {
  const configured = String(process.env[envName] || '')
    .split(',')
    .map((k) => k.trim().toUpperCase())
    .filter(Boolean);
  return new Set(process.env.NODE_ENV === 'production' ? configured : [...configured, ...devDefaults]);
}

// FR-1: Register with unique email address and role-specific validation
router.post('/register', registerLimiter, (req, res) => {
  const {
    email,
    password,
    fullName,
    role = 'student',
    university,
    memberId,
    department,
    yearOfStudy,
    designation,
    phone,
    accessCode,
    inviteCode,
  } = req.body || {};

  // 1. Mandatory core credentials (strings only, bounded length)
  if (!isStr(email, 320) || !isStr(password, 200) || !isStr(fullName, 120)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Email, password, and fullName are mandatory fields.',
    });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Please provide a valid email address.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Password must be at least 6 characters long.',
    });
  }

  const cleanRole = String(role || 'student').trim().toLowerCase();
  const validRoles = ['student', 'leader', 'judge', 'admin', 'screening', 'mentor', 'organizer'];
  if (!validRoles.includes(cleanRole)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: `Invalid role: ${cleanRole}. Valid roles are: ${validRoles.join(', ')}`,
    });
  }

  // 2. Prevent unauthorized administrative registration
  if (cleanRole === 'admin') {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Public registration for Platform Administrator accounts is not permitted. Admin accounts must be provisioned through the administrative workspace (FR-42).',
    });
  }

  const codeToVerify = String(accessCode || inviteCode || '').trim();
  let matchedCodeRecord = null;

  // 3. Role-specific validation rules
  if (['student', 'leader'].includes(cleanRole)) {
    if (!university || !String(university).trim()) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'College or university name is required for student registration.',
      });
    }
    if (!memberId || !String(memberId).trim()) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Student / Member ID is required for student and team leader accounts.',
      });
    }
  } else if (cleanRole === 'screening') {
    if (!university || !String(university).trim()) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Institution or organization is required for Screening Committee registration.',
      });
    }
    if (!department || !String(department).trim()) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Committee or department affiliation is required for Screening Committee registration.',
      });
    }
    if (!codeToVerify) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'A valid Screening Committee Access Code or Invitation Key is required.',
      });
    }
    // Only a real code issued by an event organizer counts; it also binds the
    // reviewer to that event. (A prefix check would let any made-up value in.)
    matchedCodeRecord = store.hackathonCodes.find(
      (c) => c.code.toUpperCase() === codeToVerify.toUpperCase() && c.role === 'screening'
    );
    if (!matchedCodeRecord) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Invalid or unavailable Screening Committee Access Code.',
      });
    }
  } else if (cleanRole === 'judge') {
    if (!university || !String(university).trim()) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Organization or affiliation is required for Judge registration.',
      });
    }
    if (!designation || !String(designation).trim()) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Professional designation or area of expertise is required for Judge registration.',
      });
    }
    if (!codeToVerify) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'A valid Judge Access Code or Invitation Code is required to register as a Judge.',
      });
    }
    matchedCodeRecord = store.hackathonCodes.find(
      (c) => c.code.toUpperCase() === codeToVerify.toUpperCase() && c.role === 'judge'
    );
    if (!matchedCodeRecord) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Invalid or unavailable Judge Access Code. Please enter an active access code generated by an event organizer.',
      });
    }
  } else if (cleanRole === 'organizer') {
    if (!university || !String(university).trim()) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Host organization or institution is required for Organizer registration.',
      });
    }
    if (!department || !String(department).trim()) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Department or organizing committee is required for Organizer registration.',
      });
    }
    if (!codeToVerify) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'A valid Organizer Authorization Code or Invitation Key is required.',
      });
    }
    if (!inviteKeys('ORGANIZER_INVITE_CODES', DEV_ORGANIZER_KEYS).has(codeToVerify.toUpperCase())) {
      return res.status(400).json({
        status: 400,
        error: 'Bad Request',
        message: 'Invalid or unauthorized Organizer Authorization Code.',
      });
    }
  }

  if (cleanRole === 'mentor' && !inviteKeys('MENTOR_INVITE_CODES', DEV_MENTOR_KEYS).has(codeToVerify.toUpperCase())) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'A valid Mentor Invitation Code is required to register as a mentor.',
    });
  }

  try {
    const roleCategory = cleanRole === 'judge'
      ? (designation ? String(designation).trim() : undefined)
      : (['screening', 'organizer'].includes(cleanRole) && department ? String(department).trim() : undefined);

    const user = store.createUser({
      email: cleanEmail,
      password,
      fullName: fullName.trim(),
      role: cleanRole,
      university: university ? String(university).trim() : 'University / Organization',
      memberId: ['student', 'leader'].includes(cleanRole) && memberId ? String(memberId).trim() : null,
      roleCategory,
    });

    // Auto-redeem hackathon access code if linked to a competition
    if (matchedCodeRecord) {
      try {
        store.redeemHackathonCode(matchedCodeRecord.code, user.id);
      } catch (err) {
        console.warn(`[Register] Code auto-redemption notice: ${err.message}`);
      }
    }

    const token = signToken(user);
    const redirectPath = getRoleDashboardPath(user.role);

    // FR-1: Trigger email notification for account registration
    notifyUserRegistered(user);

    return res.status(201).json({
      status: 201,
      message: 'User registered successfully (FR-1).',
      token,
      redirectPath,
      user: toSafeUser(user),
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
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};

  if (!isStr(email, 320) || !isStr(password, 200)) {
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

  const safeUser = toSafeUser(user);
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
  const safeUser = toSafeUser(req.user);
  return res.json({
    status: 200,
    user: safeUser,
    redirectPath: getRoleDashboardPath(safeUser.role),
  });
});

// FR-5: Password reset request via registered email
router.post('/forgot-password', forgotIpLimiter, forgotEmailLimiter, (req, res) => {
  const { email } = req.body || {};
  if (!isStr(email, 320)) {
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

  // Same answer whether or not the account exists (no email enumeration).
  // The token is only ever delivered by email — never in this response.
  return res.json({
    status: 200,
    message: 'If an account exists with this email address, a password reset link has been dispatched (FR-5).',
  });
});

// FR-5: Complete password reset with token
router.post('/reset-password', resetLimiter, (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!isStr(token, 200) || !isStr(newPassword, 200)) {
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

// Demo account directory for local development only: names, emails and
// roles of the seeded accounts — never passwords — and disabled in production.
router.get('/demo-users', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Not available.' });
  }
  const demoUsers = store
    .getAllUsers()
    .filter((u) => u.email.endsWith('@university.edu') || u.email.endsWith('@hacktrack.io') || u.email.endsWith('@demo.hacktrack.io'))
    .map((u) => ({
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      roleCategory: u.roleCategory,
      // Accounts of the shared demonstration scenario (one event, one team).
      demoScenario: u.email.endsWith('@demo.hacktrack.io'),
    }));
  return res.json({
    status: 200,
    users: demoUsers,
  });
});

// Redeem access code to bind judge or screening member to a hackathon
router.post('/redeem-code', requireAuth, redeemLimiter, (req, res) => {
  const { code } = req.body || {};
  if (!isStr(code, 100)) {
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
      user: toSafeUser(req.user),
    });
  } catch (err) {
    console.warn(`[AccessCode] Failed redemption for user ${req.user.id}: ${err.message}`);
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Invalid or unavailable access code.',
    });
  }
});

// GET /api/v1/auth/my-registrations: the signed-in user's hackathon registrations
router.get('/my-registrations', requireAuth, (req, res) => {
  const registrations = store.registrations
    .filter((r) => r.userId === req.user.id)
    .map((r) => {
      const hackathon = store.getHackathonById(r.hackathonId);
      return { id: r.id, hackathonId: r.hackathonId, hackathonTitle: hackathon?.title || r.hackathonId, status: r.status, registeredAt: r.registeredAt };
    });
  return res.json({ status: 200, registrations });
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
