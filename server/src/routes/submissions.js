import express from 'express';
import store from '../database/store.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { notifySubmissionSaved } from '../notifications/notifier.js';

const router = express.Router();

// GET /api/v1/submissions: List submissions for a hackathon
router.get('/', optionalAuth, (req, res) => {
  const { hackathonId } = req.query;
  if (!hackathonId) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'hackathonId query parameter is required.',
    });
  }

  // Organizer data isolation: organizers can only view submissions for hackathons they created or manage
  if (req.user && req.user.role === 'organizer') {
    const hackathon = store.getHackathonById(hackathonId);
    if (!hackathon || (hackathon.createdBy !== req.user.id && !(hackathon.assignedOrganizers && hackathon.assignedOrganizers.includes(req.user.id)))) {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: 'Organizers can only view submissions for hackathons they created or manage.',
      });
    }
  }

  const submissions = store.getSubmissionsByHackathon(hackathonId).map((s) => {
    const team = store.findTeamById(s.teamId);
    return {
      ...s,
      teamName: team?.teamName || 'Unknown Team',
    };
  });

  return res.json({
    status: 200,
    count: submissions.length,
    submissions,
  });
});

// GET /api/v1/submissions/:id: Get single submission by ID
router.get('/:id', optionalAuth, (req, res) => {
  const submission = store.getSubmissionById(req.params.id);
  if (!submission) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Submission not found.',
    });
  }

  // Organizer data isolation: organizers cannot access submissions belonging to other hackathons
  if (req.user && req.user.role === 'organizer') {
    const hackathon = store.getHackathonById(submission.hackathonId);
    if (!hackathon || (hackathon.createdBy !== req.user.id && !(hackathon.assignedOrganizers && hackathon.assignedOrganizers.includes(req.user.id)))) {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: 'Organizers cannot access submissions belonging to other hackathons.',
      });
    }
  }

  const team = store.findTeamById(submission.teamId);
  return res.json({
    status: 200,
    submission: {
      ...submission,
      teamName: team?.teamName || 'Unknown Team',
    },
  });
});

// GET /api/v1/submissions/team/:teamId: Get submission by Team ID
router.get('/team/:teamId', optionalAuth, (req, res) => {
  const submission = store.getSubmissionByTeamId(req.params.teamId);
  if (!submission) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'No project submission found for this team.',
    });
  }

  // Organizer data isolation: organizers cannot access submissions belonging to other hackathons
  if (req.user && req.user.role === 'organizer') {
    const hackathon = store.getHackathonById(submission.hackathonId);
    if (!hackathon || (hackathon.createdBy !== req.user.id && !(hackathon.assignedOrganizers && hackathon.assignedOrganizers.includes(req.user.id)))) {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: 'Organizers cannot access submissions belonging to other hackathons.',
      });
    }
  }

  const team = store.findTeamById(submission.teamId);
  return res.json({
    status: 200,
    submission: {
      ...submission,
      teamName: team?.teamName || 'Unknown Team',
    },
  });
});

// POST /api/v1/submissions: Team Leader submits or updates project (FR-17 to FR-21, BR-1, BR-8)
router.post('/', requireAuth, (req, res) => {
  const { teamId, projectTitle, abstract, track, repoUrl, demoUrl, presentationUrl, fileUrl } = req.body || {};

  if (!teamId || !projectTitle || !abstract) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'teamId, projectTitle, and abstract are mandatory fields (FR-19).',
    });
  }

  // FR-17 & BR-1: Only Team Leader can submit on behalf of their team
  if (req.user.role !== 'leader') {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Only the Team Leader is authorized to submit a project (FR-17, BR-1).',
    });
  }

  const team = store.findTeamById(teamId);
  if (!team) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Team not found.',
    });
  }

  // Verify that the logged-in user is the actual Team Leader of this specific team
  if (team.leaderId !== req.user.id) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Only the Team Leader of this team is authorized to submit a project (FR-17, BR-1).',
    });
  }

  try {
    const isNew = !store.getSubmissionByTeamId(teamId);
    const submission = store.createOrUpdateSubmission({
      teamId,
      submittedBy: req.user.id,
      projectTitle,
      abstract,
      track,
      repoUrl,
      demoUrl,
      presentationUrl,
      fileUrl,
    });

    notifySubmissionSaved(submission, { isNew });

    return res.status(201).json({
      status: 201,
      message: 'Project details successfully recorded and stored (FR-19, FR-20).',
      submission,
    });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Team Leader') ? 403 : 400);
    return res.status(status).json({
      status,
      error: status === 403 ? 'Forbidden' : 'Bad Request',
      message: err.message,
    });
  }
});

// PATCH /api/v1/submissions/:id/lock: Team Leader or Admin locks the project submission
router.patch('/:id/lock', requireAuth, (req, res) => {
  const submission = store.getSubmissionById(req.params.id);
  if (!submission) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Submission not found.',
    });
  }

  const team = store.findTeamById(submission.teamId);
  if (req.user.role !== 'admin' && (!team || team.leaderId !== req.user.id)) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Only the Team Leader of this team or an Admin is authorized to lock the project submission.',
    });
  }

  const lockedSubmission = store.lockSubmission(req.params.id);
  return res.json({
    status: 200,
    message: 'Project submission has been locked successfully (FR-21, BR-8).',
    submission: lockedSubmission,
  });
});

export default router;
