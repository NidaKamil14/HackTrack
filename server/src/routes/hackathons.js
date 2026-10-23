import express from 'express';
import store from '../database/store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Helper to verify organizer ownership or assignment
export function checkOrganizerAccess(user, hackathon) {
  if (!user || !hackathon) return false;
  if (user.role === 'admin') return false; // Admin cannot manage hackathons as an organizer
  if (user.role === 'organizer') {
    if (hackathon.createdBy === user.id) return true;
    if (hackathon.assignedOrganizers && Array.isArray(hackathon.assignedOrganizers) && hackathon.assignedOrganizers.includes(user.id)) return true;
    return false;
  }
  return false;
}

// Helper to determine if registration is open (FR-11)
function enrichHackathonStatus(hackathon) {
  const now = new Date();
  const regDeadline = new Date(hackathon.registrationDeadline);
  const subDeadline = new Date(hackathon.submissionDeadline);

  const isRegistrationClosed = now > regDeadline;
  const isSubmissionClosed = now > subDeadline;

  return {
    ...hackathon,
    isRegistrationClosed,
    isSubmissionClosed,
    effectiveStatus:
      hackathon.status === 'published' && isRegistrationClosed
        ? 'registration_closed'
        : hackathon.status,
  };
}

// GET /api/v1/hackathons: Browse published hackathons (public / student) or own hackathons (organizer data isolation)
router.get('/', optionalAuth, (req, res) => {
  const { status } = req.query;
  let all = store.getAllHackathons();

  // Organizer data isolation: organizers see only hackathons they created or are assigned to manage
  if (req.user && req.user.role === 'organizer') {
    all = all.filter((h) => checkOrganizerAccess(req.user, h));
  }

  if (status) {
    all = all.filter((h) => h.status === status);
  }

  const enriched = all.map(enrichHackathonStatus);
  return res.json({
    status: 200,
    count: enriched.length,
    hackathons: enriched,
  });
});

// GET /api/v1/hackathons/:id: Get hackathon details & evaluation criteria
router.get('/:id', (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Hackathon with specified ID does not exist.',
    });
  }

  return res.json({
    status: 200,
    hackathon: enrichHackathonStatus(hackathon),
  });
});

// POST /api/v1/hackathons: Organizer creates a new hackathon (Admins blocked with 403 Forbidden)
router.post('/', requireAuth, requireRole('organizer'), (req, res) => {
  const {
    id,
    title,
    tagLine,
    description,
    startDate,
    endDate,
    registrationDeadline,
    submissionDeadline,
    evaluationDeadline,
    minTeamSize,
    maxTeamSize,
    hasScreeningRound,
    screeningRoundsCount,
    hasMentorship,
    evaluationWorkflow,
    criteria,
    status,
  } = req.body || {};

  if (!title || !registrationDeadline || !submissionDeadline) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Title, registrationDeadline, and submissionDeadline are required.',
    });
  }

  // Deadlines chronological sanity check (FR-7)
  if (new Date(registrationDeadline) > new Date(submissionDeadline)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Registration deadline cannot be after submission deadline (FR-7).',
    });
  }

  try {
    const created = store.createHackathon({
      id: id || undefined,
      title,
      tagLine,
      description,
      status: status || 'published',
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      registrationDeadline,
      submissionDeadline,
      evaluationDeadline,
      minTeamSize: minTeamSize ? Number(minTeamSize) : 1,
      maxTeamSize: maxTeamSize ? Number(maxTeamSize) : 4, // FR-8
      hasScreeningRound: !!hasScreeningRound, // FR-23, BR-5
      screeningRoundsCount: screeningRoundsCount ? Number(screeningRoundsCount) : 1, // BR-6
      hasMentorship: !!hasMentorship, // FR-23, BR-5
      evaluationWorkflow: evaluationWorkflow || 'direct_judging',
      criteria: criteria || undefined, // FR-9
      createdBy: req.user.id,
    });

    return res.status(201).json({
      status: 201,
      message: 'Hackathon created successfully (FR-6).',
      hackathon: enrichHackathonStatus(created),
    });
  } catch (err) {
    return res.status(500).json({
      status: 500,
      error: 'Internal Server Error',
      message: err.message,
    });
  }
});

// PUT /api/v1/hackathons/:id: Organizer updates hackathon configuration (FR-6, FR-7, FR-8, FR-23)
router.put('/:id', requireAuth, requireRole('organizer'), (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Hackathon not found.' });
  }
  if (!checkOrganizerAccess(req.user, hackathon)) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Organizers can only modify hackathons they created or manage.',
    });
  }

  try {
    const updated = store.updateHackathon(req.params.id, req.body);
    return res.json({
      status: 200,
      message: 'Hackathon configuration updated successfully.',
      hackathon: enrichHackathonStatus(updated),
    });
  } catch (err) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: err.message,
    });
  }
});

// DELETE /api/v1/hackathons/:id: Organizer deletes a hackathon (FR-6)
router.delete('/:id', requireAuth, requireRole('organizer'), (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Hackathon not found.' });
  }
  if (!checkOrganizerAccess(req.user, hackathon)) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Organizers can only delete hackathons they created or manage.',
    });
  }

  try {
    const deleted = store.deleteHackathon(req.params.id);
    return res.json({
      status: 200,
      message: 'Hackathon deleted successfully (FR-6).',
      hackathon: deleted,
    });
  } catch (err) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: err.message,
    });
  }
});

// POST /api/v1/hackathons/:id/publish: Organizer publishes hackathon for participant registration (FR-10)
router.post('/:id/publish', requireAuth, requireRole('organizer'), (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Hackathon not found.' });
  }
  if (!checkOrganizerAccess(req.user, hackathon)) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Organizers can only publish hackathons they created or manage.',
    });
  }

  try {
    const updated = store.updateHackathon(req.params.id, { status: 'published' });
    return res.json({
      status: 200,
      message: 'Hackathon published successfully. Student registration is now active (FR-10).',
      hackathon: enrichHackathonStatus(updated),
    });
  } catch (err) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: err.message,
    });
  }
});

// POST /api/v1/hackathons/:id/criteria: Organizer configures rubric criteria (FR-9)
router.post('/:id/criteria', requireAuth, requireRole('organizer'), (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Hackathon not found.' });
  }
  if (!checkOrganizerAccess(req.user, hackathon)) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Organizers can only configure criteria for hackathons they created or manage.',
    });
  }

  const { criteria } = req.body || {};
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Criteria must be a non-empty array of evaluation criteria items (FR-9).',
    });
  }

  try {
    const updated = store.updateHackathon(req.params.id, { criteria });
    return res.json({
      status: 200,
      message: 'Evaluation criteria updated successfully (FR-9).',
      criteria: updated.criteria,
    });
  } catch (err) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: err.message,
    });
  }
});

// POST /api/v1/hackathons/:id/codes: Organizer generates a judge or screening access code
router.post('/:id/codes', requireAuth, requireRole('organizer'), (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Hackathon not found.' });
  }
  if (!checkOrganizerAccess(req.user, hackathon)) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Organizers can only generate codes for hackathons they created or manage.',
    });
  }

  const { role } = req.body || {};
  if (!['judge', 'screening'].includes(role)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: "Role must be 'judge' or 'screening'.",
    });
  }

  try {
    const codeRecord = store.generateHackathonCode(req.params.id, role, req.user.id);
    return res.status(201).json({
      status: 201,
      message: `Access code generated for ${role} role.`,
      codeRecord,
    });
  } catch (err) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: err.message,
    });
  }
});

// GET /api/v1/hackathons/:id/codes: Get all access codes and redeemers for a hackathon
router.get('/:id/codes', requireAuth, requireRole('organizer'), (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Hackathon not found.' });
  }
  if (!checkOrganizerAccess(req.user, hackathon)) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Organizers can only view codes for hackathons they created or manage.',
    });
  }

  const codes = store.getCodesForHackathon(req.params.id);
  const judges = store.getHackathonAssignedUsers(req.params.id, 'judge');
  const screeners = store.getHackathonAssignedUsers(req.params.id, 'screening');
  return res.json({
    status: 200,
    hackathonId: req.params.id,
    codes,
    assignedJudges: judges,
    assignedScreeners: screeners,
  });
});

// GET /api/v1/hackathons/:id/assigned-users: Organizer view of assigned judges+screeners
router.get('/:id/assigned-users', requireAuth, requireRole('organizer'), (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Hackathon not found.' });
  }
  if (!checkOrganizerAccess(req.user, hackathon)) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Organizers can only view assigned users for hackathons they created or manage.',
    });
  }

  const { role } = req.query;
  const users = store.getHackathonAssignedUsers(req.params.id, role || null);
  return res.json({ status: 200, users });
});

// POST /api/v1/hackathons/:id/register: Student or Team Leader registers for a published hackathon
router.post('/:id/register', requireAuth, (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Hackathon with specified ID does not exist.',
    });
  }

  if (hackathon.status === 'draft') {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Hackathon is not published for registration.',
    });
  }

  if (new Date() > new Date(hackathon.registrationDeadline)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Registration deadline has passed for this hackathon.',
    });
  }

  try {
    const registration = store.registerUserForHackathon({
      hackathonId: hackathon.id,
      userId: req.user.id,
      userEmail: req.user.email,
      status: 'Registration Verified',
    });

    return res.status(201).json({
      status: 201,
      message: `Successfully registered for ${hackathon.title}.`,
      registration,
    });
  } catch (err) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: err.message,
    });
  }
});

// GET /api/v1/hackathons/:id/registrations: Get registered participants for a hackathon
router.get('/:id/registrations', requireAuth, (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Hackathon with specified ID does not exist.',
    });
  }

  // Organizers can only view registrations for their own hackathons
  if (req.user.role === 'organizer' && !checkOrganizerAccess(req.user, hackathon)) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Organizers can only view registrations for hackathons they manage.',
    });
  }

  // Only organizers and admins can access participant lists
  if (!['admin', 'organizer'].includes(req.user.role)) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Only organizers and admins can view hackathon registrations.',
    });
  }

  const registrations = store.getRegistrationsForHackathon(hackathon.id);
  return res.json({
    status: 200,
    hackathonId: hackathon.id,
    hackathonTitle: hackathon.title,
    count: registrations.length,
    registrations,
  });
});

export default router;
