import express from 'express';
import store from '../database/store.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyJoinDecision, notifyJoinRequested, notifyTeamCreated } from '../notifications/notifier.js';

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

// GET /api/v1/teams/mine: List teams and pending join requests for authenticated user
router.get('/mine', requireAuth, (req, res) => {
  const userId = req.user.id;
  const userMemberships = store.teamMembers.filter((m) => m.userId === userId);

  const activeTeamIds = new Set();
  const leaderTeams = store.teams.filter((t) => t.leaderId === userId);
  leaderTeams.forEach((t) => activeTeamIds.add(t.id));

  userMemberships
    .filter((m) => m.status === 'accepted')
    .forEach((m) => activeTeamIds.add(m.teamId));

  const myTeams = Array.from(activeTeamIds).map((teamId) => {
    const team = store.findTeamById(teamId);
    if (!team) return null;
    const members = store.getTeamMembers(team.id);
    const myMem = userMemberships.find((m) => m.teamId === team.id) || (team.leaderId === userId ? { role: 'leader', status: 'accepted' } : null);
    const hackathon = store.getHackathonById(team.hackathonId);
    return {
      ...team,
      hackathonTitle: hackathon?.title || team.hackathonId,
      memberCount: members.filter((m) => m.status === 'accepted').length,
      members,
      myMembership: myMem,
    };
  }).filter(Boolean);

  const pendingRequests = userMemberships
    .filter((m) => m.status === 'pending')
    .map((m) => {
      const team = store.findTeamById(m.teamId);
      const hackathon = team ? store.getHackathonById(team.hackathonId) : null;
      return {
        ...m,
        teamName: team?.teamName || 'Unknown Team',
        teamCode: team?.teamCode || '',
        hackathonId: team?.hackathonId,
        hackathonTitle: hackathon?.title || '',
        rosterLocked: Boolean(team?.rosterLocked),
      };
    });

  return res.json({
    status: 200,
    teams: myTeams,
    pendingRequests,
  });
});

// PUT /api/v1/teams/:id/roster-lock: Team Leader locks or unlocks team roster
router.put('/:id/roster-lock', requireAuth, (req, res) => {
  const { locked } = req.body || {};
  try {
    const team = store.setTeamRosterLock({
      teamId: req.params.id,
      leaderId: req.user.id,
      locked: Boolean(locked),
    });
    return res.json({
      status: 200,
      message: `Team roster ${team.rosterLocked ? 'locked' : 'unlocked'} successfully.`,
      team,
    });
  } catch (err) {
    const status = err.message.includes('Only the Team Leader') ? 403 : 400;
    return res.status(status).json({
      status,
      error: status === 403 ? 'Forbidden' : 'Bad Request',
      message: err.message,
    });
  }
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

    // Notify only after the team exists (helpers never throw).
    notifyTeamCreated(newTeam);

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

    notifyJoinRequested(request);

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

    // Only reached when the leader was authorised and the decision was saved.
    notifyJoinDecision(result, req.user.id);

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

// PATCH /api/v1/teams/:id/screening: Screening committee / Admin updates screening status
router.patch('/:id/screening', requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'shortlisted', 'rejected'].includes(status)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Status must be one of: pending, shortlisted, rejected.',
    });
  }

  const team = store.updateTeamScreeningStatus(req.params.id, status);
  if (!team) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Team not found.',
    });
  }

  return res.json({
    status: 200,
    message: `Team screening status updated to ${status}.`,
    team,
  });
});

export default router;
