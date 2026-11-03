import express from 'express';
import store from '../database/store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { checkOrganizerAccess } from './hackathons.js';
import analyticsStore, {
  hashIdentifier,
  isValidClientId,
  isBotUserAgent,
  deviceCategory,
  normalisePath,
  summarise,
  trend,
  breakdown,
  resolvePeriod,
  bucketFor,
  monthOverMonth,
} from '../analytics/analyticsStore.js';

const router = express.Router();
const DAY_MS = 24 * 60 * 60 * 1000;

// Signed-in staff browsing their own platform is internal traffic, not reach.
const STAFF_ROLES = new Set(['admin', 'organizer', 'judge', 'screening', 'mentor']);

// Conversion is only meaningful with enough identified visitors.
const MIN_VISITORS_FOR_CONVERSION = 10;

/*
 * POST /api/v1/analytics/collect — record one page view.
 * Public (visitors are anonymous). Accepts JSON or text/plain JSON so the
 * browser can send it without a CORS preflight. Always answers 202 for valid
 * input, whether or not the view was counted, so clients learn nothing about
 * filtering rules; invalid input gets 400, floods get 429.
 */
router.post('/collect', express.text({ type: 'text/plain', limit: '2kb' }), optionalAuth, (req, res) => {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Body must be JSON.' });
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Body must be a JSON object.' });
  }

  const { type = 'page_view', path, visitorId, sessionId, referrer } = body;
  if (type !== 'page_view') {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Unsupported event type.' });
  }
  const normalised = normalisePath(path);
  if (!normalised) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'path must be an absolute pathname.' });
  }
  if ((visitorId !== undefined && visitorId !== null && !isValidClientId(visitorId)) || (sessionId !== undefined && sessionId !== null && !isValidClientId(sessionId))) {
    return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Invalid visitor or session identifier.' });
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!analyticsStore.allowRequest(ip)) {
    return res.status(429).json({ status: 429, error: 'Too Many Requests', message: 'Analytics rate limit exceeded.' });
  }

  const ua = req.get('user-agent') || '';
  const accepted = () => res.status(202).json({ status: 202, accepted: true });

  if (process.env.ANALYTICS_ENABLED === 'false') return accepted();
  if (isBotUserAgent(ua)) return accepted();
  if (req.user && STAFF_ROLES.has(req.user.role)) return accepted();

  let hackathonId = null;
  if (normalised.hackathonRef) {
    const hackathon = store.getHackathonById(normalised.hackathonRef);
    if (!hackathon) return accepted(); // unknown event (typo/404 page): not attributed to anyone
    hackathonId = hackathon.id;
  }

  const visitorHash = isValidClientId(visitorId) ? hashIdentifier('v', visitorId) : null;
  const sessionHash = isValidClientId(sessionId) ? hashIdentifier('s', sessionId) : null;

  // Suppress repeats (reloads, double-fired effects) of the same page by the
  // same client within a short window. Without identifiers, fall back to a
  // transient fingerprint of address + agent that is never stored.
  const clientKey = sessionHash || hashIdentifier('t', `${ip}|${ua}`);
  if (analyticsStore.isDuplicate(`${clientKey}|${path.split(/[?#]/)[0]}`)) return accepted();

  analyticsStore.record({
    page: normalised.page,
    hackathonId,
    visitorHash,
    sessionHash,
    referrer: typeof referrer === 'string' ? referrer : 'other',
    device: deviceCategory(ua),
  });
  return accepted();
});

function periodOr400(req, res) {
  const period = resolvePeriod(req.query, analyticsStore);
  if (period.error) {
    res.status(400).json({ status: 400, error: 'Bad Request', message: period.error });
    return null;
  }
  return period;
}

const periodJson = (p) => ({ range: p.range, from: p.start.toISOString(), to: p.end.toISOString(), timezone: 'UTC' });

function rollingWindow(days, filter) {
  const end = new Date();
  return summarise(analyticsStore.between(new Date(end.getTime() - days * DAY_MS), new Date(end.getTime() + 1), filter));
}

/*
 * GET /api/v1/analytics/platform — platform-wide aggregate reach.
 * Organizers (to see the audience HackTrack offers) and admins.
 */
router.get('/platform', requireAuth, requireRole('organizer', 'admin'), (req, res) => {
  const period = periodOr400(req, res);
  if (!period) return;
  const events = analyticsStore.between(period.start, period.end);
  const allTime = summarise(analyticsStore.events);
  const firstRecorded = analyticsStore.earliest();

  return res.json({
    status: 200,
    period: periodJson(period),
    trackingSince: firstRecorded ? firstRecorded.toISOString() : null,
    totals: summarise(events),
    allTime,
    last7Days: rollingWindow(7),
    last30Days: rollingWindow(30),
    growth: monthOverMonth(analyticsStore),
    bucket: bucketFor(period.start, period.end),
    trend: trend(events, period.start, period.end, bucketFor(period.start, period.end)),
    referrers: breakdown(events, 'referrer'),
    devices: breakdown(events, 'device'),
  });
});

function eventPerformance(hackathon, period, { withTrend = false } = {}) {
  const isEvent = (e) => e.hackathonId === hackathon.id;
  const events = analyticsStore.between(period.start, period.end, isEvent);
  const traffic = summarise(events);
  const registrations = store.getRegistrationsForHackathon(hackathon.id);
  const inPeriod = registrations.filter((r) => {
    const t = Date.parse(r.registeredAt);
    return t >= period.start.getTime() && t < period.end.getTime();
  }).length;
  const teams = store.getTeamsByHackathon(hackathon.id).length;

  const conversion =
    traffic.uniqueVisitors >= MIN_VISITORS_FOR_CONVERSION
      ? Math.round((inPeriod / traffic.uniqueVisitors) * 1000) / 10
      : null;

  const result = {
    hackathonId: hackathon.id,
    title: hackathon.title,
    status: hackathon.status,
    detailPageViews: traffic.pageViews,
    uniqueVisitors: traffic.uniqueVisitors,
    sessions: traffic.sessions,
    registrations: { total: registrations.length, inPeriod },
    teams,
    // Registrations in the period per estimated unique visitor of the event page.
    conversionRatePct: conversion,
    conversionNote:
      conversion === null
        ? `Shown once the event page has at least ${MIN_VISITORS_FOR_CONVERSION} estimated unique visitors in the period.`
        : null,
  };
  if (withTrend) {
    result.bucket = bucketFor(period.start, period.end);
    result.trend = trend(events, period.start, period.end, result.bucket);
  }
  return result;
}

// Hackathons whose analytics this user may see: organizers only their own.
function visibleHackathons(user, organizerId) {
  const all = store.getAllHackathons();
  if (user.role === 'admin') {
    if (!organizerId) return all;
    return all.filter((h) => h.createdBy === organizerId || (Array.isArray(h.assignedOrganizers) && h.assignedOrganizers.includes(organizerId)));
  }
  return all.filter((h) => checkOrganizerAccess(user, h));
}

/*
 * GET /api/v1/analytics/events — performance of the caller's own events.
 * Organizers: only hackathons they created or are assigned to (any
 * organizerId query parameter is ignored). Admins: all, or ?organizerId=.
 */
router.get('/events', requireAuth, requireRole('organizer', 'admin'), (req, res) => {
  const period = periodOr400(req, res);
  if (!period) return;
  const organizerId = req.user.role === 'admin' && typeof req.query.organizerId === 'string' ? req.query.organizerId : null;
  const events = visibleHackathons(req.user, organizerId).map((h) => eventPerformance(h, period));
  events.sort((a, b) => b.detailPageViews - a.detailPageViews);
  return res.json({ status: 200, period: periodJson(period), count: events.length, events });
});

/*
 * GET /api/v1/analytics/events/:hackathonId — one event with its trend.
 * Another organizer's event answers 404 (not 403) so ids can't be probed.
 */
router.get('/events/:hackathonId', requireAuth, requireRole('organizer', 'admin'), (req, res) => {
  const period = periodOr400(req, res);
  if (!period) return;
  const hackathon = store.getAllHackathons().find((h) => h.id === req.params.hackathonId);
  const allowed = hackathon && (req.user.role === 'admin' || checkOrganizerAccess(req.user, hackathon));
  if (!allowed) {
    return res.status(404).json({ status: 404, error: 'Not Found', message: 'No analytics found for this hackathon.' });
  }
  return res.json({ status: 200, period: periodJson(period), event: eventPerformance(hackathon, period, { withTrend: true }) });
});

export default router;
