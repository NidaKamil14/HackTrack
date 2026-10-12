import { Router } from 'express';
import { testConnection, getSanitizedConfig } from '../config/db.js';

const router = Router();

/**
 * GET /api/v1/health
 * Verifies API server availability and MySQL connection status.
 */
router.get('/', async (req, res) => {
  const dbHealth = await testConnection();
  const dbConfig = getSanitizedConfig();
  const uptimeSeconds = Math.round(process.uptime() * 100) / 100;

  if (dbHealth.connected) {
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: `${uptimeSeconds}s`,
      services: {
        api: {
          status: 'online',
          nodeVersion: process.version,
        },
        database: {
          status: 'connected',
          dialect: 'mysql',
          version: dbHealth.dbVersion,
          serverTime: dbHealth.serverTime,
          config: dbConfig,
        },
      },
    });
  }

  // If database is disconnected or unreachable, respond with safe 503 Service Unavailable
  return res.status(503).json({
    status: 'degraded',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    services: {
      api: {
        status: 'online',
        nodeVersion: process.version,
      },
      database: {
        status: 'disconnected',
        dialect: 'mysql',
        code: dbHealth.code,
        error: dbHealth.error,
        config: dbConfig,
      },
    },
  });
});

export default router;
