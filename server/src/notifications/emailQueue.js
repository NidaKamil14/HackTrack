import crypto from 'crypto';
import store from '../database/store.js';
import { emailConfig, maskEmail } from './config.js';
import { getProvider } from './providers.js';

/*
 * In-process email outbox.
 * The backend has no job infrastructure (and its store is in-memory), so
 * emails are queued in the store and delivered asynchronously by this worker:
 *   - never on the request path: the HTTP response is not delayed or failed
 *   - rate-limited (EMAIL_RATE_PER_SECOND) to protect bulk announcements
 *   - transient failures (network, 429, 5xx) retried with exponential backoff
 *     up to EMAIL_MAX_ATTEMPTS; permanent failures are marked "failed"
 *   - every state change is mirrored onto the in-app notification
 *     (emailStatus / emailStatusReason / emailAttempts / emailSentAt)
 * `retryFailedEmails()` re-queues failed messages (exposed to admins).
 */

let draining = false;
let lastSentAt = 0;
let idleResolvers = [];
let wakeTimer = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function enqueueEmail({ notificationId, to, subject, html, text, headers }) {
  const job = {
    id: `eml-${crypto.randomBytes(5).toString('hex')}`,
    notificationId,
    to,
    subject,
    html,
    text,
    headers,
    status: 'queued',
    attempts: 0,
    nextAttemptAt: Date.now(),
    lastError: null,
    providerMessageId: null,
    createdAt: new Date().toISOString(),
  };
  store.emailOutbox.push(job);
  store.updateNotificationEmailStatus(notificationId, { emailStatus: 'queued', emailStatusReason: null });
  scheduleDrain();
  return job;
}

function scheduleDrain(delay = 0) {
  if (wakeTimer) return;
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    drain();
  }, delay);
  // Don't keep the process alive just for the email worker.
  wakeTimer.unref?.();
}

async function deliver(job) {
  const { maxAttempts, ratePerSecond, retryBaseDelayMs } = emailConfig();
  const provider = getProvider();

  // Rate limit: at most `ratePerSecond` sends per second.
  const gap = 1000 / ratePerSecond;
  const wait = lastSentAt + gap - Date.now();
  if (wait > 0) await sleep(wait);

  job.attempts += 1;
  job.status = 'sending';
  try {
    const result = await provider.send({
      to: job.to,
      subject: job.subject,
      html: job.html,
      text: job.text,
      headers: job.headers,
    });
    lastSentAt = Date.now();
    job.providerMessageId = result?.id || null;
    if (result?.simulated) {
      // Development "console" provider: logged, not delivered. Never report it as sent.
      job.status = 'simulated';
      store.updateNotificationEmailStatus(job.notificationId, {
        emailStatus: 'skipped',
        emailStatusReason: 'Not delivered: no email provider is configured on the server (development log only)',
        emailAttempts: job.attempts,
      });
      return;
    }
    job.status = 'sent';
    store.updateNotificationEmailStatus(job.notificationId, {
      emailStatus: 'sent',
      emailStatusReason: null,
      emailAttempts: job.attempts,
      emailSentAt: new Date().toISOString(),
    });
  } catch (err) {
    lastSentAt = Date.now();
    const safeReason = String(err?.message || 'Delivery failed').slice(0, 200);
    job.lastError = safeReason;
    const retryable = err?.transient && job.attempts < maxAttempts;
    if (retryable) {
      job.status = 'queued';
      job.nextAttemptAt = Date.now() + retryBaseDelayMs * 2 ** (job.attempts - 1);
    } else {
      job.status = 'failed';
    }
    store.updateNotificationEmailStatus(job.notificationId, {
      emailStatus: retryable ? 'queued' : 'failed',
      emailStatusReason: safeReason,
      emailAttempts: job.attempts,
    });
    if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
      console.warn(`[Email] ${retryable ? 'Retrying' : 'Failed'} ${job.id} to ${maskEmail(job.to)} (attempt ${job.attempts}): ${safeReason}`);
    }
  }
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      const now = Date.now();
      const due = store.emailOutbox.find((j) => j.status === 'queued' && j.nextAttemptAt <= now);
      if (!due) {
        const next = store.emailOutbox
          .filter((j) => j.status === 'queued')
          .reduce((min, j) => Math.min(min, j.nextAttemptAt), Infinity);
        if (Number.isFinite(next)) scheduleDrain(Math.max(0, next - Date.now()));
        break;
      }
      await deliver(due);
    }
  } finally {
    draining = false;
    if (!store.emailOutbox.some((j) => j.status === 'queued' || j.status === 'sending')) {
      const resolvers = idleResolvers;
      idleResolvers = [];
      resolvers.forEach((r) => r());
    }
  }
}

/** Re-queue every failed email (admin retry). Returns how many were re-queued. */
export function retryFailedEmails() {
  let count = 0;
  for (const job of store.emailOutbox) {
    if (job.status === 'failed') {
      job.status = 'queued';
      job.attempts = 0;
      job.nextAttemptAt = Date.now();
      store.updateNotificationEmailStatus(job.notificationId, { emailStatus: 'queued', emailStatusReason: null });
      count += 1;
    }
  }
  if (count) scheduleDrain();
  return count;
}

/** Outbox counts by status (admin observability; contains no addresses). */
export function outboxSummary() {
  const summary = { queued: 0, sending: 0, sent: 0, failed: 0, simulated: 0 };
  for (const job of store.emailOutbox) summary[job.status] = (summary[job.status] || 0) + 1;
  return summary;
}

/** Resolves when nothing is queued or in flight (used by tests and shutdown). */
export function waitForEmailIdle(timeoutMs = 5000) {
  if (!store.emailOutbox.some((j) => j.status === 'queued' || j.status === 'sending')) return Promise.resolve();
  scheduleDrain();
  return Promise.race([
    new Promise((resolve) => idleResolvers.push(resolve)),
    sleep(timeoutMs),
  ]);
}
