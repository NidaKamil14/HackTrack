import express from 'express';
import store from '../database/store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notifyJudgeAssigned, notifyResultsPublished } from '../notifications/notifier.js';

const router = express.Router();

// POST /api/v1/evaluations/assign: Admin assigns Judge to Submission (FR-24, BR-7)
router.post('/assign', requireAuth, requireRole('admin'), (req, res) => {
  const { hackathonId, judgeId, submissionId } = req.body || {};

  if (!hackathonId || !judgeId || !submissionId) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'hackathonId, judgeId, and submissionId are required.',
    });
  }

  try {
    const assignment = store.assignJudgeToSubmission({ hackathonId, judgeId, submissionId });
    notifyJudgeAssigned({ hackathonId, judgeId, submissionId, ...assignment });
    return res.status(201).json({
      status: 201,
      message: 'Judge successfully assigned to project submission (FR-24).',
      assignment,
    });
  } catch (err) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: err.message,
    });
  }
});

// GET /api/v1/evaluations/assigned: Judge fetches only submissions assigned to them (FR-25, BR-7)
router.get('/assigned', requireAuth, requireRole('judge'), (req, res) => {
  const assigned = store.getJudgeAssignedSubmissions(req.user.id);
  return res.json({
    status: 200,
    count: assigned.length,
    assignedSubmissions: assigned,
  });
});

// POST /api/v1/evaluations: Judge evaluates submission against criteria (FR-26, FR-27, BR-8)
router.post('/', requireAuth, requireRole('judge'), (req, res) => {
  const { hackathonId, submissionId, scores, remarks } = req.body || {};

  if (!hackathonId || !submissionId || !Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'hackathonId, submissionId, and a non-empty array of criteria scores are required.',
    });
  }

  try {
    const evaluations = store.submitEvaluation({
      hackathonId,
      submissionId,
      judgeId: req.user.id,
      scores,
      remarks,
    });

    return res.status(201).json({
      status: 201,
      message: 'Evaluation score and feedback recorded successfully and locked (FR-26, FR-27, BR-8).',
      evaluations,
    });
  } catch (err) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: err.message,
    });
  }
});

// GET /api/v1/evaluations/leaderboard/:hackathonId: Calculated ranking & leaderboard (FR-28, FR-29)
router.get('/leaderboard/:hackathonId', (req, res) => {
  const hackathon = store.getHackathonById(req.params.hackathonId);
  if (!hackathon) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Hackathon not found.',
    });
  }

  const leaderboard = store.calculateLeaderboard(req.params.hackathonId);
  return res.json({
    status: 200,
    hackathonId: req.params.hackathonId,
    resultsPublished: hackathon.resultsPublished,
    resultsPublishedAt: hackathon.resultsPublishedAt,
    leaderboard,
  });
});

// POST /api/v1/evaluations/publish-results/:hackathonId: Organizer publishes results (FR-30, FR-31, BR-9)
// Admin is strictly restricted from publishing, modifying, or finalizing results (HTTP 403 Forbidden).
router.post('/publish-results/:hackathonId', requireAuth, (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: 'Administrators are not permitted to publish, modify, or finalize hackathon results. Result publication is reserved exclusively for authorized event organizers.',
      });
    }

    if (req.user.role !== 'organizer') {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: 'Only authorized event organizers can publish results.',
      });
    }

    const hackathon = store.getHackathonById(req.params.hackathonId);
    if (!hackathon) {
      return res.status(404).json({
        status: 404,
        error: 'Not Found',
        message: 'Hackathon not found.',
      });
    }

    const isOwner = hackathon.createdBy === req.user.id;
    const isAssigned = Array.isArray(hackathon.assignedOrganizers) && hackathon.assignedOrganizers.includes(req.user.id);

    if (!isOwner && !isAssigned) {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: 'You are not authorized to publish results for another organizer\'s hackathon.',
      });
    }

    const updatedHackathon = store.publishResults(hackathon.id);
    // Results + certificates are committed at this point; notifications follow.
    notifyResultsPublished(hackathon.id);
    return res.json({
      status: 200,
      message: 'Hackathon results successfully published and certificates issued to participants (FR-30, FR-31, FR-32, BR-9).',
      hackathon: updatedHackathon,
    });
  } catch (err) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: err.message,
    });
  }
});

export default router;
