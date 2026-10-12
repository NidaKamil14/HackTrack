import express from 'express';
import store from '../database/store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/admin/users: List all users (FR-42)
router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = store.getAllUsers();
  return res.json({
    status: 200,
    count: users.length,
    users,
  });
});

// PUT /api/v1/admin/users/:id/role: Update user role (FR-42)
router.put('/users/:id/role', requireAuth, requireRole('admin'), (req, res) => {
  const { role } = req.body || {};
  if (!role) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Role is required.',
    });
  }

  try {
    const updated = store.updateUserRole(req.params.id, role);
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

  return res.status(201).json({
    status: 201,
    message: 'Announcement broadcasted successfully (FR-46).',
    announcement,
  });
});

export default router;
