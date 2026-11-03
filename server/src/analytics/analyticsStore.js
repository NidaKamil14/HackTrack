import crypto from 'crypto';
import { pool, testConnection } from '../config/db.js';

/*
 * First-party, privacy-conscious traffic analytics.
 *
 * What is stored per page view (and nothing else):
 *   page            normalised route template ("/hackathons/:id", never a raw URL or query string)
 *   hackathonId     canonical hackathon id for event detail pages
 *   visitorHash     HMAC of the browser's random first-party visitor id (only with consent)
 *   sessionHash     HMAC of the browser's random session id (only with consent)
 *   referrer        coarse category: direct | internal | search | social | other
 *   device          coarse category: mobile | tablet | desktop
 *   occurredAt      UTC timestamp
 *
 * Not stored: IP addresses, user agents, user ids, emails, tokens, full URLs.
 * IP + user agent are used transiently (in memory, never persisted) for rate
 * limiting and short-window duplicate suppression only.
 *
 * Unique visitors and sessions are *estimates*: they are derived from random
 * browser identifiers, only exist for visitors who allowed analytics, and one
 * person on two devices counts twice.
 */

const isTestMode = () => Boolean(process.env.NODE_TEST_CONTEXT || process.env.NODE_ENV === 'test');
const DAY_MS = 24 * 60 * 60 * 1000;

export const PAGES = ['/', '/hackathons', '/hackathons/:id', '/login', '/register', '/reset-password', '/dashboard', 'other'];
const REFERRERS = new Set(['direct', 'internal', 'search', 'social', 'other']);
const DASHBOARD_ROLES = new Set(['student', 'leader', 'organizer', 'judge', 'screening', 'mentor', 'admin']);

// Automated clients we don't count as visitors.
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python-requests|axios|node-fetch|httpclient|phantomjs|puppeteer|playwright|selenium|facebookexternalhit|embedly|quora link|whatsapp|telegram/i;

function retentionDays() {
  const n = parseInt(process.env.ANALYTICS_RETENTION_DAYS, 10);
  return Number.isFinite(n) && n >= 30 ? n : 395; // ~13 months
}

function hashKey() {
  return process.env.ANALYTICS_SECRET || process.env.JWT_SECRET || 'hacktrack-analytics-dev-key';
}

export function hashIdentifier(kind, value) {
  if (!value) return null;
  return crypto.createHmac('sha256', hashKey()).update(`${kind}:${value}`).digest('hex').slice(0, 32);
}

const ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
export const isValidClientId = (v) => typeof v === 'string' && ID_PATTERN.test(v);

export function isBotUserAgent(ua) {
  return !ua || BOT_UA.test(ua);
}

export function deviceCategory(ua = '') {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Turns a raw pathname into a stored page template. Query strings and hashes
 * are dropped (they can contain reset tokens). Returns null for invalid input.
 */
export function normalisePath(rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.length > 300 || !rawPath.startsWith('/')) return null;
  const path = rawPath.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (path === '/') return { page: '/', hackathonRef: null };
  if (path === '/hackathons') return { page: '/hackathons', hackathonRef: null };
  const detail = /^\/hackathons\/([^/]{1,100})$/.exec(path);
  if (detail) return { page: '/hackathons/:id', hackathonRef: decodeURIComponent(detail[1]) };
  if (['/login', '/register', '/reset-password'].includes(path)) return { page: path, hackathonRef: null };
  const dash = /^\/dashboard\/([a-z]+)$/.exec(path);
  if (dash && DASHBOARD_ROLES.has(dash[1])) return { page: '/dashboard', hackathonRef: null };
  return { page: 'other', hackathonRef: null };
}

class AnalyticsStore {
  constructor() {
    this.events = [];
    this.recent = new Map(); // dedupe key -> last timestamp (memory only)
    this.rate = new Map(); // ip -> [timestamps] (memory only)
  }

  reset() {
    this.events = [];
    this.recent.clear();
    this.rate.clear();
  }

  /** Sliding-window rate limit per client address (not persisted). */
  allowRequest(ip, now = Date.now()) {
    const limit = parseInt(process.env.ANALYTICS_RATE_PER_MINUTE, 10) || 60;
    const key = ip || 'unknown';
    const list = (this.rate.get(key) || []).filter((t) => now - t < 60_000);
    if (list.length >= limit) {
      this.rate.set(key, list);
      return false;
    }
    list.push(now);
    this.rate.set(key, list);
    if (this.rate.size > 5000) {
      for (const [k, v] of this.rate) if (!v.some((t) => now - t < 60_000)) this.rate.delete(k);
    }
    return true;
  }

  /** True when the same client viewed the same page within the window. */
  isDuplicate(dedupeKey, now = Date.now()) {
    const windowMs = 30_000;
    const last = this.recent.get(dedupeKey);
    this.recent.set(dedupeKey, now);
    if (this.recent.size > 20000) {
      for (const [k, t] of this.recent) if (now - t > windowMs) this.recent.delete(k);
    }
    return last !== undefined && now - last < windowMs;
  }

  record({ page, hackathonId = null, visitorHash = null, sessionHash = null, referrer = 'direct', device = 'desktop', occurredAt = new Date() }) {
    const event = {
      id: `pv-${crypto.randomBytes(8).toString('hex')}`,
      type: 'page_view',
      page,
      hackathonId,
      visitorHash,
      sessionHash,
      referrer: REFERRERS.has(referrer) ? referrer : 'other',
      device,
      occurredAt: new Date(occurredAt).toISOString(),
    };
    this.events.push(event);
    this.prune();
    if (!isTestMode()) {
      pool
        .query(
          `INSERT INTO analytics_events (id, event_type, page, hackathon_id, visitor_hash, session_hash, referrer_category, device_category, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [event.id, event.type, event.page, event.hackathonId, event.visitorHash, event.sessionHash, event.referrer, event.device, event.occurredAt.slice(0, 23).replace('T', ' ')]
        )
        .catch(() => {}); // MySQL is optional; the in-memory copy stays authoritative for this process
    }
    return event;
  }

  prune(now = Date.now()) {
    const cutoff = now - retentionDays() * DAY_MS;
    if (this.events.length && Date.parse(this.events[0].occurredAt) < cutoff) {
      this.events = this.events.filter((e) => Date.parse(e.occurredAt) >= cutoff);
    }
  }

  /** Loads retained events from MySQL at startup (no-op when MySQL is unavailable). */
  async loadFromDatabase() {
    if (isTestMode()) return false;
    const status = await testConnection();
    if (!status.connected) return false;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id VARCHAR(40) NOT NULL,
          event_type VARCHAR(32) NOT NULL,
          page VARCHAR(64) NOT NULL,
          hackathon_id VARCHAR(50) NULL,
          visitor_hash CHAR(32) NULL,
          session_hash CHAR(32) NULL,
          referrer_category VARCHAR(16) NOT NULL DEFAULT 'direct',
          device_category VARCHAR(16) NOT NULL DEFAULT 'desktop',
          occurred_at DATETIME(3) NOT NULL,
          PRIMARY KEY (id),
          INDEX idx_analytics_time (occurred_at),
          INDEX idx_analytics_hackathon_time (hackathon_id, occurred_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.query('DELETE FROM analytics_events WHERE occurred_at < UTC_TIMESTAMP() - INTERVAL ? DAY', [retentionDays()]);
      const [rows] = await pool.query('SELECT * FROM analytics_events ORDER BY occurred_at ASC');
      this.events = rows.map((r) => ({
        id: r.id,
        type: r.event_type,
        page: r.page,
        hackathonId: r.hackathon_id,
        visitorHash: r.visitor_hash,
        sessionHash: r.session_hash,
        referrer: r.referrer_category,
        device: r.device_category,
        occurredAt: new Date(`${String(r.occurred_at instanceof Date ? r.occurred_at.toISOString() : r.occurred_at).replace(' ', 'T').replace(/Z?$/, 'Z')}`).toISOString(),
      }));
      return true;
    } catch (err) {
      console.warn('analytics_events sync warning:', err.message);
      return false;
    }
  }

  // ---- Aggregation (only aggregates ever leave this module) ----

  between(start, end, filter = () => true) {
    const s = start.getTime();
    const e = end.getTime();
    return this.events.filter((ev) => {
      const t = Date.parse(ev.occurredAt);
      return t >= s && t < e && filter(ev);
    });
  }

  earliest(filter = () => true) {
    const first = this.events.find(filter);
    return first ? new Date(first.occurredAt) : null;
  }
}

export function summarise(events) {
  const visitors = new Set();
  const sessions = new Set();
  let identified = 0;
  for (const e of events) {
    if (e.visitorHash) {
      visitors.add(e.visitorHash);
      identified += 1;
    }
    if (e.sessionHash) sessions.add(e.sessionHash);
  }
  return {
    pageViews: events.length,
    sessions: sessions.size,
    uniqueVisitors: visitors.size,
    // Page views from visitors who allowed analytics identifiers; visitor and
    // session estimates are based on this share of traffic only.
    identifiedPageViews: identified,
  };
}

const utcDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const utcWeek = (d) => {
  const day = utcDay(d);
  const offset = (day.getUTCDay() + 6) % 7; // Monday-based weeks
  return new Date(day.getTime() - offset * DAY_MS);
};

/** Zero-filled day or week buckets between start and end (UTC). */
export function trend(events, start, end, bucket) {
  const floor = bucket === 'week' ? utcWeek : utcDay;
  const step = bucket === 'week' ? 7 * DAY_MS : DAY_MS;
  const buckets = new Map();
  for (let t = floor(start).getTime(); t < end.getTime(); t += step) {
    buckets.set(t, { pageViews: 0, visitors: new Set(), sessions: new Set() });
  }
  for (const e of events) {
    const key = floor(new Date(e.occurredAt)).getTime();
    const b = buckets.get(key);
    if (!b) continue;
    b.pageViews += 1;
    if (e.visitorHash) b.visitors.add(e.visitorHash);
    if (e.sessionHash) b.sessions.add(e.sessionHash);
  }
  return [...buckets.entries()].map(([t, b]) => ({
    date: new Date(t).toISOString().slice(0, 10),
    pageViews: b.pageViews,
    uniqueVisitors: b.visitors.size,
    sessions: b.sessions.size,
  }));
}

export function breakdown(events, key) {
  const counts = {};
  for (const e of events) counts[e[key]] = (counts[e[key]] || 0) + 1;
  return counts;
}

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolves the requested period to UTC bounds. Accepts range=7d|30d|90d|all
 * or from/to (YYYY-MM-DD, inclusive, UTC). Returns { error } when invalid.
 */
export function resolvePeriod({ range, from, to } = {}, store, now = new Date()) {
  const endOfToday = new Date(utcDay(now).getTime() + DAY_MS);
  if (from || to) {
    if (!DATE_ONLY.test(from || '') || !DATE_ONLY.test(to || '')) return { error: 'from and to must both be dates in YYYY-MM-DD format.' };
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(new Date(`${to}T00:00:00Z`).getTime() + DAY_MS);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return { error: 'from must be on or before to.' };
    if ((end - start) / DAY_MS > 731) return { error: 'The date range cannot exceed two years.' };
    return { start, end: end > endOfToday ? endOfToday : end, range: 'custom' };
  }
  const key = range || '30d';
  if (key === 'all') {
    const first = store.earliest();
    const start = first ? utcDay(first) : utcDay(now);
    return { start, end: endOfToday, range: 'all' };
  }
  if (!RANGE_DAYS[key]) return { error: 'range must be one of 7d, 30d, 90d or all.' };
  return { start: new Date(endOfToday.getTime() - RANGE_DAYS[key] * DAY_MS), end: endOfToday, range: key };
}

export const bucketFor = (start, end) => ((end - start) / DAY_MS > 92 ? 'week' : 'day');

/**
 * Last 30 days vs the 30 days before. Only reported when tracking already
 * covered the whole earlier window, so partial history never looks like growth.
 */
export function monthOverMonth(store, now = new Date(), filter = () => true) {
  const end = new Date(utcDay(now).getTime() + DAY_MS);
  const mid = new Date(end.getTime() - 30 * DAY_MS);
  const start = new Date(mid.getTime() - 30 * DAY_MS);
  const first = store.earliest();
  if (!first || first > start) {
    return { available: false, reason: 'Growth needs at least 60 days of recorded traffic.' };
  }
  const current = summarise(store.between(mid, end, filter));
  const previous = summarise(store.between(start, mid, filter));
  const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);
  return {
    available: true,
    current: { uniqueVisitors: current.uniqueVisitors, pageViews: current.pageViews },
    previous: { uniqueVisitors: previous.uniqueVisitors, pageViews: previous.pageViews },
    uniqueVisitorsChangePct: pct(current.uniqueVisitors, previous.uniqueVisitors),
    pageViewsChangePct: pct(current.pageViews, previous.pageViews),
  };
}

const analyticsStore = new AnalyticsStore();
export default analyticsStore;
