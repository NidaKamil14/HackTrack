import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { demoEnabled, demoStatus, resetDemo, DEMO_STAGES } from '../demo/demoScenario.js';

/*
 * Demonstration scenario controls (admin only). Disabled in production unless
 * DEMO_MODE=true; DEMO_MODE=false disables it everywhere.
 */
const router = express.Router();

router.use((req, res, next) => {
  if (!demoEnabled()) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'Demo mode is disabled on this server.' });
  }
  return next();
});

// GET /api/v1/demo: current stage, ids, accounts (no passwords) and progress
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  return res.json({ status: 200, demo: demoStatus() });
});

// POST /api/v1/demo/reset { stage }: rebuild the demo up to a lifecycle stage
router.post('/reset', requireAuth, requireRole('admin'), (req, res) => {
  const stage = (req.body && req.body.stage) || 'setup';
  if (!DEMO_STAGES.some((s) => s.key === stage)) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: `stage must be one of ${DEMO_STAGES.map((s) => s.key).join(', ')}.` });
  }
  try {
    const demo = resetDemo(stage);
    return res.json({ status: 200, message: `Demo scenario reset to "${stage}".`, demo });
  } catch (err) {
    return res.status(500).json({ status: 500, error: 'Internal Server Error', message: `Demo reset failed: ${err.message}` });
  }
});

export default router;
