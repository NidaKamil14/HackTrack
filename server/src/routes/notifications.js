import express from 'express';
import store from '../database/store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { CATEGORIES, CATEGORY_KEYS, verifyUnsubscribe } from '../notifications/notifier.js';
import { outboxSummary, retryFailedEmails } from '../notifications/emailQueue.js';
import { emailConfig } from '../notifications/config.js';
import { escapeHtml } from '../notifications/templates.js';

const router = express.Router();

// Shape returned to clients. Email status is reported exactly as recorded by
// the delivery worker; the recipient address is never included.
const toClient = (n) => ({
  id: n.id,
  type: n.type,
  category: n.category,
  title: n.title,
  message: n.message,
  link: n.link,
  isRead: n.isRead,
  createdAt: n.createdAt,
  email: {
    status: n.emailStatus, // pending | queued | sent | failed | skipped
    reason: n.emailStatusReason,
    attempts: n.emailAttempts,
    sentAt: n.emailSentAt,
  },
});

// GET /api/v1/notifications — the signed-in user's notifications
router.get('/', requireAuth, (req, res) => {
  const items = store.getUserNotifications(req.user.id).map(toClient);
  res.json({ status: 200, count: items.length, unread: items.filter((n) => !n.isRead).length, notifications: items });
});

// POST /api/v1/notifications/read-all
router.post('/read-all', requireAuth, (req, res) => {
  const updated = store.markAllNotificationsRead(req.user.id);
  res.json({ status: 200, updated });
});

// GET /api/v1/notifications/preferences
router.get('/preferences', requireAuth, (req, res) => {
  res.json({
    status: 200,
    preferences: store.getEmailPreferences(req.user.id, CATEGORY_KEYS),
    categories: CATEGORIES,
    delivery: { provider: emailConfig().provider },
  });
});

// PUT /api/v1/notifications/preferences — { team: false, announcements: true, ... }
router.put('/preferences', requireAuth, (req, res) => {
  const body = req.body || {};
  const invalid = Object.entries(body).filter(([k, v]) => !CATEGORIES[k] || typeof v !== 'boolean');
  if (invalid.length) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: `Unknown category or non-boolean value: ${invalid.map(([k]) => k).join(', ')}. Valid categories: ${CATEGORY_KEYS.join(', ')}.`,
    });
  }
  const preferences = store.updateEmailPreferences(req.user.id, body, CATEGORY_KEYS);
  return res.json({ status: 200, message: 'Email preferences updated.', preferences });
});

// GET/POST /api/v1/notifications/unsubscribe?u=&c=&s= — signed one-click
// unsubscribe from a single category (GET from email links, POST for
// RFC 8058 List-Unsubscribe-Post). The signature authorises nothing else.
function handleUnsubscribe(req, res) {
  const { u, c, s } = { ...req.query, ...(req.body || {}) };
  const ok = verifyUnsubscribe(u, c, s) && store.findUserById(u);
  if (ok) store.updateEmailPreferences(u, { [c]: false }, CATEGORY_KEYS);
  const { frontendUrl } = emailConfig();
  const label = CATEGORIES[c]?.label || 'these';
  res.status(ok ? 200 : 400).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HackTrack email preferences</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#F6F7FC;color:#0E1022;">
<main style="max-width:480px;margin:64px auto;padding:32px;background:#fff;border:1px solid #E2E4F0;border-radius:14px;">
<h1 style="font-size:20px;margin:0 0 12px;">${ok ? 'You’re unsubscribed' : 'This link is not valid'}</h1>
<p style="color:#484E68;line-height:1.6;margin:0 0 20px;">${ok
    ? `You won’t receive ${escapeHtml(label.toLowerCase())} emails anymore. In-app notifications are unaffected, and you can turn emails back on from your dashboard at any time.`
    : 'The unsubscribe link is incomplete or has been altered. You can manage email preferences from your HackTrack dashboard.'}</p>
<a href="${escapeHtml(frontendUrl)}/login" style="display:inline-block;padding:10px 18px;background:#6A55F5;color:#fff;border-radius:10px;text-decoration:none;">Open HackTrack</a>
</main></body></html>`);
}
router.get('/unsubscribe', handleUnsubscribe);
router.post('/unsubscribe', handleUnsubscribe);

// Admin: outbox health and retry of permanently failed emails.
router.get('/email/outbox', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ status: 200, provider: emailConfig().provider, outbox: outboxSummary() });
});
router.post('/email/retry-failed', requireAuth, requireRole('admin'), (req, res) => {
  const requeued = retryFailedEmails();
  res.json({ status: 200, message: `${requeued} failed email(s) re-queued for delivery.`, requeued });
});

// PATCH /api/v1/notifications/:id/read (registered last so it doesn't shadow the routes above)
router.patch('/:id/read', requireAuth, (req, res) => {
  const updated = store.markNotificationRead(req.params.id, req.user.id);
  if (!updated) return res.status(404).json({ status: 404, error: 'Not Found', message: 'Notification not found.' });
  return res.json({ status: 200, notification: toClient(updated) });
});

export default router;
