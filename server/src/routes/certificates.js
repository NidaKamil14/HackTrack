import express from 'express';
import store from '../database/store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notifyCertificateIssued } from '../notifications/notifier.js';

const router = express.Router();

// GET /api/v1/certificates/my-certificates: Participant views issued certificates (FR-32 to FR-34)
router.get('/my-certificates', requireAuth, (req, res) => {
  const certs = store.getUserCertificates(req.user.id);
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
  const { hackathonId, userId, teamId, certificateType, participantName, hackathonTitle } = req.body || {};
  if (!hackathonId || !userId || !participantName) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'hackathonId, userId, and participantName are required.',
    });
  }

  try {
    const cert = store.createCertificate({
      hackathonId,
      userId,
      teamId,
      certificateType,
      participantName,
      hackathonTitle,
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
