import express from 'express';
import store from '../database/store.js';
import { requireAuth } from '../middleware/auth.js';

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

export default router;
