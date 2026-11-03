import express from 'express';
import store from '../database/store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notifyCertificateIssued } from '../notifications/notifier.js';
import { checkOrganizerAccess } from './hackathons.js';

const router = express.Router();

// GET /api/v1/certificates/my-certificates: Participant views issued certificates (FR-32 to FR-34)
router.get('/my-certificates', requireAuth, (req, res) => {
  const certs = store.getUserCertificates(req.user.id).map((c) => {
    const team = c.teamId ? store.findTeamById(c.teamId) : null;
    return { ...c, teamName: team?.teamName || '', track: team?.track || '' };
  });
  return res.json({
    status: 200,
    count: certs.length,
    certificates: certs,
  });
});

// GET /api/v1/certificates/verify/:code: Public certificate verification & lookup (FR-33, Appendix C)
router.get('/verify/:code', (req, res) => {
  const cert = store.getCertificateByCode(req.params.code);
  if (!cert) {
    return res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: 'Certificate code is invalid or has not been issued.',
    });
  }

  return res.json({
    status: 200,
    valid: true,
    certificate: cert,
  });
});

// POST /api/v1/certificates/issue: Admin / Organizer issues a certificate and triggers notification
router.post('/issue', requireAuth, requireRole('admin', 'organizer'), (req, res) => {
  const { hackathonId, userId, teamId, certificateType } = req.body || {};
  if (!hackathonId || !userId || typeof hackathonId !== 'string' || typeof userId !== 'string') {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'hackathonId and userId are required.',
    });
  }
  const hackathon = store.getHackathonById(hackathonId);
  if (!hackathon) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Hackathon not found.' });
  }
  if (req.user.role === 'organizer' && !checkOrganizerAccess(req.user, hackathon)) {
    return res.status(403).json({ status: 403, error: 'Forbidden', message: 'Organizers can only issue certificates for hackathons they manage.' });
  }
  const recipient = store.findUserById(userId);
  const participates =
    recipient &&
    (store.registrations.some((r) => r.hackathonId === hackathon.id && r.userId === recipient.id) ||
      store.teamMembers.some((m) => m.hackathonId === hackathon.id && m.userId === recipient.id && m.status === 'accepted'));
  if (!participates) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Certificates can only be issued to participants of this hackathon.' });
  }
  const TYPES = ['participation', 'winner', 'runner_up', 'merit'];
  if (certificateType !== undefined && !TYPES.includes(certificateType)) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: `certificateType must be one of ${TYPES.join(', ')}.` });
  }
  const existingCert = store.certificates.find((c) => c.hackathonId === hackathon.id && c.userId === recipient.id);
  if (existingCert) {
    return res.status(409).json({ status: 409, error: 'Conflict', message: 'This participant already has a certificate for this hackathon.', certificate: existingCert });
  }

  try {
    // Names and titles come from the records, never from the request body.
    const cert = store.createCertificate({
      hackathonId: hackathon.id,
      userId: recipient.id,
      teamId: typeof teamId === 'string' ? teamId : null,
      certificateType: certificateType || 'participation',
      participantName: recipient.fullName,
      hackathonTitle: hackathon.title,
    });
    notifyCertificateIssued(cert);
    return res.status(201).json({
      status: 201,
      message: 'Certificate successfully issued and recipient notified.',
      certificate: cert,
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
