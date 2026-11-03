import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// SQL aggregate query to fetch live counts directly from MySQL.
// 1. hackathonsHosted: non-draft hackathons according to the platform lifecycle.
// 2. teamsParticipated: genuine active teams (excludes pending join requests in team_members).
// 3. participants: distinct registered participants (student/leader roles, active accounts, strictly excluding staff/admin/judge/screening).
// 4. upcomingEvents: published hackathons with start_date later than the current UTC time.
export const LIVE_STATS_SQL = `
  SELECT
    (SELECT COUNT(*) FROM hackathons WHERE status != 'draft') AS hackathonsHosted,
    (SELECT COUNT(*) FROM teams WHERE status = 'active') AS teamsParticipated,
    (SELECT COUNT(DISTINCT id) FROM users WHERE role IN ('student', 'leader') AND is_active = 1) AS participants,
    (SELECT COUNT(*) FROM hackathons WHERE status = 'published' AND start_date > ?) AS upcomingEvents
`;

let activePool = pool;

/**
 * Configure active database pool (useful for dependency injection in tests).
 */
export function setDbPool(newPool) {
  activePool = newPool;
}

/**
 * Reset database pool to default MySQL pool.
 */
export function resetDbPool() {
  activePool = pool;
}

/**
 * Execute the aggregate SQL query against MySQL.
 */
export async function queryLiveStats(dbPool = activePool) {
  const nowUtc = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const [rows] = await dbPool.query(LIVE_STATS_SQL, [nowUtc]);

  if (!rows || rows.length === 0) {
    throw new Error('Database returned empty statistics result.');
  }

  const row = rows[0];
  return {
    hackathonsHosted: Number(row.hackathonsHosted) || 0,
    teamsParticipated: Number(row.teamsParticipated) || 0,
    participants: Number(row.participants) || 0,
    upcomingEvents: Number(row.upcomingEvents) || 0,
  };
}

/**
 * Handler for GET /api/v1/stats
 * Public read-only statistics endpoint for the homepage.
 */
export async function statsHandler(req, res) {
  try {
    const stats = await queryLiveStats(activePool);

    // Return consistent numeric fields with strictly no private user records.
    return res.json({
      status: 200,
      stats,
    });
  } catch (err) {
    // If MySQL connection is down, unconfigured, or query fails
    return res.status(503).json({
      status: 503,
      error: 'Database Unavailable',
      message: err.message || 'Live database connection is offline. Statistics are currently unavailable.',
    });
  }
}

// GET /api/v1/stats
router.get('/', statsHandler);

export default router;
