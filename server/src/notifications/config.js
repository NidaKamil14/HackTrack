import crypto from 'crypto';

/*
 * Email configuration, read lazily from the environment so tests and
 * long-running processes always see the current values.
 *
 *   EMAIL_PROVIDER         resend | sendgrid | console | disabled | memory
 *                          (default: memory under `node --test`, otherwise
 *                          resend when EMAIL_API_KEY is set, else console)
 *   EMAIL_API_KEY          provider API key (never logged)
 *   EMAIL_FROM             "HackTrack <notifications@your-domain.com>"
 *   EMAIL_REPLY_TO         optional reply-to address
 *   FRONTEND_URL           base URL used for buttons and links in emails
 *   API_PUBLIC_URL         public base URL of this API (unsubscribe links)
 *   EMAIL_MAX_ATTEMPTS     delivery attempts before a message is marked failed (default 3)
 *   EMAIL_RATE_PER_SECOND  max emails sent per second, protects bulk sends (default 5)
 */

const isNodeTestRunner = () => Boolean(process.env.NODE_TEST_CONTEXT);

export function emailConfig() {
  const apiKey = process.env.EMAIL_API_KEY || '';
  let provider = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (!provider) provider = isNodeTestRunner() ? 'memory' : apiKey ? 'resend' : 'console';

  return {
    provider,
    apiKey,
    from: process.env.EMAIL_FROM || 'HackTrack <notifications@hacktrack.local>',
    replyTo: process.env.EMAIL_REPLY_TO || '',
    frontendUrl: (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5174').replace(/\/+$/, ''),
    apiPublicUrl: (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5050}`).replace(/\/+$/, ''),
    maxAttempts: Math.max(1, Number(process.env.EMAIL_MAX_ATTEMPTS) || 3),
    ratePerSecond: Math.max(1, Number(process.env.EMAIL_RATE_PER_SECOND) || 5),
    retryBaseDelayMs: isNodeTestRunner() ? 5 : 2000,
  };
}

// Key for signing unsubscribe links. Derived from JWT_SECRET so no new secret
// is required; a dedicated EMAIL_LINK_SECRET can override it.
export function linkSigningKey() {
  const secret = process.env.EMAIL_LINK_SECRET || process.env.JWT_SECRET || 'hacktrack-dev-link-secret';
  return crypto.createHash('sha256').update(`hacktrack-email-links:${secret}`).digest();
}

// Basic RFC-5322-lite validation; rejects obviously malformed addresses.
export function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i.test(email.trim());
}

// For logs: never print full recipient addresses.
export function maskEmail(email = '') {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}
