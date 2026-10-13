import express from 'express';
import store from '../database/store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

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

// GET /api/v1/hackathons: Browse all published hackathons (public / student)
router.get('/', (req, res) => {
  const { status } = req.query;
  let all = store.getAllHackathons();

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

// POST /api/v1/hackathons: Admin or Organizer creates a new hackathon (FR-6, BR-4)
router.post('/', requireAuth, requireRole('admin', 'organizer'), (req, res) => {
  const {
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
      title,
      tagLine,
      description,
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

// PUT /api/v1/hackathons/:id: Admin or Organizer updates hackathon configuration (FR-6, FR-7, FR-8, FR-23)
router.put('/:id', requireAuth, requireRole('admin', 'organizer'), (req, res) => {
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

// DELETE /api/v1/hackathons/:id: Admin deletes a hackathon (FR-6)
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
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

// POST /api/v1/hackathons/:id/publish: Admin or Organizer publishes hackathon for participant registration (FR-10)
router.post('/:id/publish', requireAuth, requireRole('admin', 'organizer'), (req, res) => {
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

// POST /api/v1/hackathons/:id/criteria: Admin or Organizer configures rubric criteria (FR-9)
router.post('/:id/criteria', requireAuth, requireRole('admin', 'organizer'), (req, res) => {
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

export default router;
