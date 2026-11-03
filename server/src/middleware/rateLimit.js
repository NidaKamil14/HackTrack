/*
 * Minimal in-memory sliding-window rate limiter (no dependency).
 * Suitable for a single server process; use a shared store (e.g. Redis)
 * when running several instances.
 *
 * Disabled under `node --test` unless RATE_LIMIT_IN_TESTS=1, so suites that
 * create many accounts from 127.0.0.1 aren't throttled.
 */
export function rateLimit({ name, windowMs, max, key = (req) => req.ip || 'unknown', message }) {
  const hits = new Map();
  return (req, res, next) => {
    const testing = Boolean(process.env.NODE_TEST_CONTEXT) || process.env.NODE_ENV === 'test';
    if (testing && process.env.RATE_LIMIT_IN_TESTS !== '1') return next();

    const now = Date.now();
    const k = `${name}:${key(req)}`;
    const list = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      hits.set(k, list);
      const retryAfter = Math.ceil((windowMs - (now - list[0])) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        status: 429,
        error: 'Too Many Requests',
        message: message || 'Too many attempts. Please wait a moment and try again.',
      });
    }
    list.push(now);
    hits.set(k, list);
    if (hits.size > 10000) {
      for (const [hk, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(hk);
    }
    return next();
  };
}

const bodyEmail = (req) => String(req.body?.email || '').trim().toLowerCase();

export const loginLimiter = rateLimit({ name: 'login', windowMs: 15 * 60_000, max: 10, key: (req) => `${req.ip}|${bodyEmail(req)}`, message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
export const registerLimiter = rateLimit({ name: 'register', windowMs: 60 * 60_000, max: 20 });
export const forgotIpLimiter = rateLimit({ name: 'forgot-ip', windowMs: 15 * 60_000, max: 10 });
export const forgotEmailLimiter = rateLimit({ name: 'forgot-email', windowMs: 15 * 60_000, max: 3, key: bodyEmail, message: 'A reset link was requested recently. Please check your inbox or try again later.' });
export const resetLimiter = rateLimit({ name: 'reset', windowMs: 15 * 60_000, max: 10 });
export const redeemLimiter = rateLimit({ name: 'redeem', windowMs: 10 * 60_000, max: 10, key: (req) => req.user?.id || req.ip, message: 'Too many access-code attempts. Please wait 10 minutes.' });
