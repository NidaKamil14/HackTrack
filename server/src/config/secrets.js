import crypto from 'crypto';

/*
 * JWT signing secret.
 * - Production refuses to start without a strong JWT_SECRET (>= 32 chars).
 * - Elsewhere, a missing secret falls back to a random per-process key, so a
 *   publicly known default can never be used to forge tokens. Sessions then
 *   end when the server restarts; set JWT_SECRET in .env to keep them.
 */
let cached = null;

export function getJwtSecret() {
  if (cached) return cached;
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length >= 32) {
    cached = configured;
    return cached;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
  }
  if (configured) {
    console.warn('⚠️ JWT_SECRET is shorter than 32 characters; using it only outside production.');
    cached = configured;
    return cached;
  }
  if (!process.env.NODE_TEST_CONTEXT && process.env.NODE_ENV !== 'test') {
    console.warn('⚠️ JWT_SECRET is not set: using a random key for this process (sessions reset on restart).');
  }
  cached = crypto.randomBytes(48).toString('hex');
  return cached;
}
