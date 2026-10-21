import express from 'express';
import store from '../database/store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notifyAnnouncement } from '../notifications/notifier.js';

const router = express.Router();

// GET /api/v1/admin/users: List all users from MySQL database (FR-42)
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { role, search, status } = req.query || {};
    const users = await store.getUsersFromDb({ role, search, status });
    return res.json({
      status: 200,
      count: users.length,
      users,
    });
  } catch (err) {
    return res.status(500).json({
      status: 500,
      error: 'Internal Server Error',
      message: err.message,
    });
  }
});

// POST /api/v1/admin/users: Create a new user (FR-42)
router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
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

  const validRoles = ['student', 'leader', 'judge', 'admin', 'screening', 'mentor', 'organizer'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: `Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`,
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

    return res.status(201).json({
      status: 201,
      message: 'User created successfully.',
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

// PUT /api/v1/admin/users/:id/role: Update user role in MySQL (FR-42)
router.put('/users/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
  const { role } = req.body || {};
  if (!role) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Role is required.',
    });
  }

  const validRoles = ['student', 'leader', 'judge', 'admin', 'screening', 'mentor', 'organizer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: `Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`,
    });
  }

  try {
    const updated = await store.updateUserRole(req.params.id, role);
    const { passwordHash: _hash, ...safeUser } = updated;
    return res.json({
      status: 200,
      message: 'User role updated successfully (FR-42).',
      user: safeUser,
    });
  } catch (err) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: err.message,
    });
  }
});

// Helper for status updates
const handleStatusChange = async (req, res, targetActive) => {
  try {
    const updated = await store.setUserActiveStatus(req.params.id, targetActive, req.user.id);
    return res.json({
      status: 200,
      message: targetActive
        ? `User ${updated.fullName || updated.email} has been reactivated successfully.`
        : `User ${updated.fullName || updated.email} has been deactivated successfully.`,
      user: updated,
    });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('not found') ? 404 : 400);
    return res.status(status).json({
      status,
      error: status === 404 ? 'Not Found' : 'Bad Request',
      message: err.message,
    });
  }
};

// PUT /api/v1/admin/users/:id/status: Update user active status in MySQL (FR-42)
router.put('/users/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  const { isActive, status } = req.body || {};
  let targetActive = isActive;
  if (targetActive === undefined && status !== undefined) {
    targetActive = status === 'active' || status === true;
  }

  if (targetActive === undefined || typeof targetActive !== 'boolean') {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Active status is required as a boolean (isActive: true | false) or status: "active" | "inactive".',
    });
  }

  return handleStatusChange(req, res, targetActive);
});

// PATCH /api/v1/admin/users/:id/status
router.patch('/users/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  const { isActive, status } = req.body || {};
  let targetActive = isActive;
  if (targetActive === undefined && status !== undefined) {
    targetActive = status === 'active' || status === true;
  }

  if (targetActive === undefined || typeof targetActive !== 'boolean') {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Active status is required as a boolean (isActive: true | false) or status: "active" | "inactive".',
    });
  }

  return handleStatusChange(req, res, targetActive);
});

// POST /api/v1/admin/users/:id/deactivate: Deactivate user account (FR-42)
router.post('/users/:id/deactivate', requireAuth, requireRole('admin'), (req, res) => {
  return handleStatusChange(req, res, false);
});

// POST /api/v1/admin/users/:id/reactivate: Reactivate user account (FR-42)
router.post('/users/:id/reactivate', requireAuth, requireRole('admin'), (req, res) => {
  return handleStatusChange(req, res, true);
});

// GET /api/v1/admin/stats: System usage statistics (FR-41)
router.get('/stats', requireAuth, requireRole('admin'), (req, res) => {
  const stats = store.getSystemStats();
  return res.json({
    status: 200,
    stats,
  });
});

// GET /api/v1/admin/reports/hackathon/:id: Detailed hackathon summary report (FR-40)
router.get('/reports/hackathon/:id', requireAuth, requireRole('admin'), (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Hackathon not found.',
    });
  }

  const teams = store.getTeamsByHackathon(hackathon.id);
  const submissions = store.getSubmissionsByHackathon(hackathon.id);
  const leaderboard = store.calculateLeaderboard(hackathon.id);

  return res.json({
    status: 200,
    report: {
      hackathonId: hackathon.id,
      title: hackathon.title,
      status: hackathon.status,
      totalTeams: teams.length,
      totalSubmissions: submissions.length,
      evaluatedTeamsCount: leaderboard.filter((l) => l.evalCount > 0).length,
      leaderboard,
    },
  });
});

// Announcements (FR-46)
router.get('/announcements', (req, res) => {
  const announcements = store.getAnnouncements(req.query.hackathonId);
  return res.json({
    status: 200,
    announcements,
  });
});

router.post('/announcements', requireAuth, requireRole('admin'), (req, res) => {
  const { hackathonId, title, content, targetRole } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Title and content are required.',
    });
  }

  const announcement = store.createAnnouncement({
    hackathonId,
    title,
    content,
    targetRole,
    createdBy: req.user.id,
  });

  notifyAnnouncement(announcement);

  return res.status(201).json({
    status: 201,
    message: 'Announcement broadcasted successfully (FR-46).',
    announcement,
  });
});

export default router;
