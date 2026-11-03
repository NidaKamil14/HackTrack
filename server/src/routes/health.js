import { Router } from 'express';
import { testConnection } from '../config/db.js';

const router = Router();

/**
 * GET /api/v1/health
 * Reports whether the API is serving and how data is stored.
 *
 * The API serves the same data and rules with or without MySQL (it falls
 * back to its in-memory store), so it answers 200 whenever it is up and the
 * frontend uses the live API as the source of truth. `database.persistent`
 * tells operators whether data survives a restart. Connection details and
 * versions are not disclosed on this public endpoint.
 */
router.get('/', async (req, res) => {
  const dbHealth = await testConnection();
  const uptimeSeconds = Math.round(process.uptime() * 100) / 100;

  return res.status(200).json({
    status: dbHealth.connected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    services: {
      api: { status: 'online' },
      database: dbHealth.connected
        ? { status: 'connected', dialect: 'mysql', persistent: true }
        : { status: 'in-memory', persistent: false, note: 'MySQL is unreachable; data is kept in memory and lost on restart.' },
    },
  });
});

export default router;
