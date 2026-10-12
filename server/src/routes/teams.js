import express from 'express';
import store from '../database/store.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/teams: List teams for a specific hackathon
router.get('/', (req, res) => {
  const { hackathonId } = req.query;
  if (!hackathonId) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'hackathonId query parameter is required.',
    });
  }

  const teams = store.getTeamsByHackathon(hackathonId).map((team) => {
    const members = store.getTeamMembers(team.id);
    return {
      ...team,
      memberCount: members.filter((m) => m.status === 'accepted').length,
      members,
    };
  });

  return res.json({
    status: 200,
    count: teams.length,
    teams,
  });
});

// GET /api/v1/teams/:id: Get team details, code, and members
router.get('/:id', (req, res) => {
  const team = store.findTeamById(req.params.id);
  if (!team) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Team not found.',
    });
  }

  const members = store.getTeamMembers(team.id);
  return res.json({
    status: 200,
    team: {
      ...team,
      members,
    },
  });
});

// POST /api/v1/teams: Create a new team (FR-12, FR-13, BR-1)
router.post('/', requireAuth, (req, res) => {
  const { hackathonId, teamName, track } = req.body || {};

  if (!hackathonId || !teamName) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'hackathonId and teamName are required.',
    });
  }

  // FR-12 & BR-1: Only users with Team Leader role can create a team
  if (req.user.role !== 'leader') {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Only users with the Team Leader role may create a team (FR-12, BR-1).',
    });
  }

  try {
    const newTeam = store.createTeam({
      hackathonId,
      leaderId: req.user.id,
      teamName,
      track,
    });

    const members = store.getTeamMembers(newTeam.id);
    return res.status(201).json({
      status: 201,
      message: 'Team created successfully with unique Team Code (FR-13).',
      team: {
        ...newTeam,
        members,
      },
    });
  } catch (err) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: err.message,
    });
  }
});

// POST /api/v1/teams/join: Student requests to join a team using Team Code (FR-14, FR-16, BR-2)
router.post('/join', requireAuth, (req, res) => {
  const { teamCode } = req.body || {};
  if (!teamCode) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'teamCode is required to submit a join request (FR-14).',
    });
  }

  try {
    const request = store.requestJoinTeam({
      teamCode,
      userId: req.user.id,
    });

    return res.status(201).json({
      status: 201,
      message: 'Join request submitted successfully. Awaiting approval from Team Leader (FR-14, BR-3).',
      request,
    });
  } catch (err) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: err.message,
    });
  }
});

// PUT /api/v1/teams/:id/requests/:requestId: Team Leader approves or rejects request (FR-15, BR-3)
router.put('/:id/requests/:requestId', requireAuth, (req, res) => {
  const { action } = req.body || {}; // 'accept' or 'reject'
  if (!action || !['accept', 'reject'].includes(action)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Action must be either "accept" or "reject".',
    });
  }

  try {
    const result = store.respondToJoinRequest({
      teamId: req.params.id,
      requestId: req.params.requestId,
      leaderId: req.user.id,
      action,
    });

    return res.json({
      status: 200,
      message: `Join request has been ${action === 'accept' ? 'accepted' : 'rejected'} successfully (FR-15).`,
      request: result,
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
