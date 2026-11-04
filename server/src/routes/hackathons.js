import express from 'express';
import store from '../database/store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { notifyRegistrationConfirmed } from '../notifications/notifier.js';

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

export const HACKATHON_STATUSES = ['draft', 'published', 'registration_closed', 'judging', 'completed'];

// Drafts are private to their organizers (and admins).
export function canViewHackathon(user, hackathon) {
  if (!hackathon) return false;
  if (hackathon.status !== 'draft') return true;
  return Boolean(user && (user.role === 'admin' || checkOrganizerAccess(user, hackathon)));
}

const isDate = (v) => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const isText = (v, max) => typeof v === 'string' && v.length <= max;

/**
 * Validates and whitelists organizer-editable fields. Ownership, ids,
 * results and status are never taken from this input (status changes go
 * through /publish; results through publish-results).
 */
function validateHackathonInput(body, existing = null) {
  const b = body || {};
  const out = {};
  const errors = [];
  const text = { title: 200, tagLine: 300, description: 10000, evaluationWorkflow: 50 };
  for (const [k, max] of Object.entries(text)) {
    if (b[k] === undefined) continue;
    if (!isText(b[k], max)) errors.push(`${k} must be text of at most ${max} characters.`);
    else out[k] = k === 'title' ? b[k].trim() : b[k];
  }
  if (out.title === '') errors.push('title cannot be empty.');
  for (const k of ['startDate', 'endDate', 'registrationDeadline', 'submissionDeadline', 'evaluationDeadline']) {
    if (b[k] === undefined || b[k] === null || b[k] === '') continue;
    if (!isDate(b[k])) errors.push(`${k} must be a valid date.`);
    else out[k] = new Date(b[k]).toISOString();
  }
  for (const k of ['minTeamSize', 'maxTeamSize', 'screeningRoundsCount']) {
    if (b[k] === undefined || b[k] === null || b[k] === '') continue;
    const n = Number(b[k]);
    if (!Number.isInteger(n) || n < 1 || n > 20) errors.push(`${k} must be a whole number between 1 and 20.`);
    else out[k] = n;
  }
  for (const k of ['hasScreeningRound', 'hasMentorship']) {
    if (b[k] !== undefined) out[k] = Boolean(b[k]);
  }
  const merged = { ...(existing || {}), ...out };
  if ((merged.minTeamSize || 1) > (merged.maxTeamSize || 4)) errors.push('minTeamSize cannot exceed maxTeamSize (FR-8).');
  if (merged.registrationDeadline && merged.submissionDeadline && new Date(merged.registrationDeadline) > new Date(merged.submissionDeadline)) {
    errors.push('Registration deadline cannot be after submission deadline (FR-7).');
  }
  return { values: out, errors };
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

  // ?scope=public: the public catalogue for anyone (used by discovery pages,
  // even when an organizer or admin is signed in).
  if (req.query.scope === 'public') {
    all = all.filter((h) => h.status !== 'draft');
  } else if (req.user && req.user.role === 'organizer') {
    // Organizer data isolation: organizers see only hackathons they created or are assigned to manage
    all = all.filter((h) => checkOrganizerAccess(req.user, h));
  } else if (!req.user || req.user.role !== 'admin') {
    // Public discovery never lists drafts.
    all = all.filter((h) => h.status !== 'draft');
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
router.get('/:id', optionalAuth, (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon || !canViewHackathon(req.user, hackathon)) {
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

  // Deadline order (FR-7), types and ranges
  const { errors } = validateHackathonInput(req.body);
  if (errors.length) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: errors.join(' ') });
  }
  if (status !== undefined && !['draft', 'published'].includes(status)) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'A new hackathon starts as draft or published.' });
  }
  if (criteria !== undefined && (!Array.isArray(criteria) || criteria.length > 20)) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'criteria must be a list of at most 20 items.' });
  }
  // A client-chosen id may never collide with (and so take over) another event.
  if (id !== undefined) {
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,49}$/.test(id)) {
      return res.status(400).json({ status: 400, error: 'Bad Request', message: 'id must be 3-50 lowercase letters, digits or hyphens.' });
    }
    if (store.getAllHackathons().some((h) => h.id.toLowerCase() === id.toLowerCase())) {
      return res.status(409).json({ status: 409, error: 'Conflict', message: 'A hackathon with this id already exists.' });
    }
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

    // Platform Administration sync: notify all administrators of the newly published hackathon
    try {
      const admins = store.users.filter((u) => u.role === 'admin');
      admins.forEach((adminUser) => {
        store.addNotification({
          userId: adminUser.id,
          type: 'announcement',
          category: 'announcements',
          title: 'New Hackathon Published',
          message: `Organizer published new competition: "${created.title}".`,
          link: '/dashboard/admin',
          dedupeKey: `hack_published:${created.id}:${adminUser.id}`,
        });
      });
    } catch {
      // Non-critical notification dispatch failure
    }

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

  const { values, errors } = validateHackathonInput(req.body, hackathon);
  if (errors.length) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: errors.join(' ') });
  }

  try {
    const updated = store.updateHackathon(hackathon.id, values);
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

    // Notify administrators that competition was published
    try {
      const admins = store.users.filter((u) => u.role === 'admin');
      admins.forEach((adminUser) => {
        store.addNotification({
          userId: adminUser.id,
          type: 'announcement',
          category: 'announcements',
          title: 'Hackathon Published',
          message: `Competition "${updated.title}" has been published and opened for registrations.`,
          link: '/dashboard/admin',
          dedupeKey: `hack_published:${updated.id}:${adminUser.id}`,
        });
      });
    } catch {
      // Non-critical notification dispatch failure
    }

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
  if (!Array.isArray(criteria) || criteria.length === 0 || criteria.length > 20) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Criteria must be a non-empty array of evaluation criteria items (FR-9).',
    });
  }
  const cleanCriteria = [];
  for (const [i, c] of criteria.entries()) {
    const maxScore = Number(c?.maxScore ?? 25);
    const weightage = Number(c?.weightage ?? 1);
    if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 120) {
      return res.status(400).json({ status: 400, error: 'Bad Request', message: `Criterion ${i + 1} needs a name (at most 120 characters).` });
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 100 || !Number.isFinite(weightage) || weightage <= 0 || weightage > 10) {
      return res.status(400).json({ status: 400, error: 'Bad Request', message: `Criterion "${c.name}" needs a maxScore of 1-100 and a weightage of 0-10.` });
    }
    cleanCriteria.push({
      id: typeof c.id === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(c.id) ? c.id : `crit-${hackathon.id}-${i + 1}-${Date.now().toString(36)}`,
      name: c.name.trim(),
      maxScore,
      weightage,
      description: typeof c.description === 'string' ? c.description.slice(0, 1000) : '',
    });
  }

  try {
    const updated = store.updateHackathon(hackathon.id, { criteria: cleanCriteria });
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

// GET /api/v1/hackathons/:id/committee: who reviews the event (admin or its
// organizers). Access codes stay organizer-only (GET /:id/codes).
router.get('/:id/committee', requireAuth, (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon || !(req.user.role === 'admin' || checkOrganizerAccess(req.user, hackathon))) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Hackathon not found.' });
  }
  const pick = (u) => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role });
  return res.json({
    status: 200,
    judges: store.getHackathonAssignedUsers(hackathon.id, 'judge').map(pick),
    screeners: store.getHackathonAssignedUsers(hackathon.id, 'screening').map(pick),
  });
});

// GET /api/v1/hackathons/:id/progress: lifecycle counts (organizer of the event, or admin)
router.get('/:id/progress', requireAuth, (req, res) => {
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon || !(req.user.role === 'admin' || checkOrganizerAccess(req.user, hackathon))) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Hackathon not found.' });
  }
  return res.json({ status: 200, progress: store.getHackathonProgress(hackathon.id) });
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
  if (!['judge', 'screening', 'mentor'].includes(role)) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: "Role must be 'judge', 'screening' or 'mentor'.",
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
  if (!['student', 'leader'].includes(req.user.role)) {
    return res.status(403).json({ status: 403, error: 'Forbidden', message: 'Only participants (students and team leaders) can register for hackathons.' });
  }
  const hackathon = store.getHackathonById(req.params.id);
  if (!hackathon || !canViewHackathon(req.user, hackathon)) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Hackathon with specified ID does not exist.',
    });
  }

  // Registration is open only for a published event, before its registration
  // deadline, and never once judging has started or results are out.
  const closedReason =
    hackathon.status === 'draft'
      ? 'Registration has not opened for this hackathon yet.'
      : hackathon.resultsPublished || ['completed', 'judging', 'registration_closed'].includes(hackathon.status)
        ? 'Registration is closed: this hackathon has moved past registration.'
        : new Date() > new Date(hackathon.registrationDeadline)
          ? 'Registration deadline has passed for this hackathon.'
          : null;
  if (closedReason) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: closedReason });
  }

  // Optional registration form details (validated when provided).
  const body = req.body || {};
  const details = {};
  const textFields = { phone: 20, institution: 200, course: 120, yearOfStudy: 60, experience: 300 };
  for (const [k, max] of Object.entries(textFields)) {
    if (body[k] === undefined || body[k] === null || body[k] === '') continue;
    if (typeof body[k] !== 'string' || body[k].length > max) {
      return res.status(400).json({ status: 400, error: 'Bad Request', message: `${k} must be text of at most ${max} characters.` });
    }
    details[k] = body[k].trim();
  }
  if (details.phone && !/^[+0-9 ()-]{7,20}$/.test(details.phone)) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Please provide a valid phone number.' });
  }
  if (body.acceptTerms !== undefined && body.acceptTerms !== true) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'You must accept the hackathon rules to register.' });
  }
  if (body.acceptTerms === true) details.acceptedTermsAt = new Date().toISOString();

  // Reject duplicate registration attempts (FR-10, BR-2)
  const isAlreadyRegistered = store.registrations.some(
    (r) =>
      (r.hackathonId === hackathon.id || r.hackathonId === req.params.id) &&
      (r.userId === req.user.id || (r.userEmail && r.userEmail.toLowerCase() === req.user.email.toLowerCase()))
  );
  if (isAlreadyRegistered) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'You are already registered for this hackathon.',
    });
  }

  try {
    const registration = store.registerUserForHackathon({
      hackathonId: hackathon.id,
      userId: req.user.id,
      userEmail: req.user.email,
      status: 'Registration Verified',
      details: Object.keys(details).length ? details : null,
    });

    notifyRegistrationConfirmed(registration);
    // Notify the managing organizer in real-time
    try {
      if (hackathon.createdBy) {
        store.addNotification({
          userId: hackathon.createdBy,
          type: 'announcement',
          category: 'announcements',
          title: 'New Participant Registered',
          message: `${req.user.fullName || req.user.email} registered for "${hackathon.title}".`,
          link: '/dashboard/organizer',
          dedupeKey: `reg_notif:${hackathon.id}:${req.user.id}`,
        });
      }
    } catch {
      // Non-critical notification dispatch failure
    }

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
