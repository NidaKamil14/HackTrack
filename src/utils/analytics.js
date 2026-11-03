/*
 * First-party page-view analytics (browser side).
 *
 * - Every page view is reported as an anonymous count (route only; no query
 *   string, no personal data, nothing stored on the device).
 * - Only if the visitor allows analytics, a random visitor id (localStorage,
 *   rotated yearly) and session id (sessionStorage, 30-minute idle timeout)
 *   are added, so the server can *estimate* unique visitors and sessions. The
 *   server stores keyed hashes of these, never the ids themselves.
 * - Global Privacy Control / Do Not Track are honoured as "declined".
 * - Signed-in staff (organizers, judges, screening, mentors, admins) are not
 *   counted, so internal use doesn't inflate reach figures.
 * - Development builds send nothing unless VITE_ANALYTICS_DEV=true.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api/v1';
const ENABLED = import.meta.env.PROD || import.meta.env.VITE_ANALYTICS_DEV === 'true';

const CONSENT_KEY = 'hacktrack_analytics_consent';
const VISITOR_KEY = 'hacktrack_analytics_visitor';
const SESSION_KEY = 'hacktrack_analytics_session';
const SESSION_IDLE_MS = 30 * 60 * 1000;
const VISITOR_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const STAFF_ROLES = new Set(['admin', 'organizer', 'judge', 'screening', 'mentor']);

const listeners = new Set();

export const ANALYTICS_PREFERENCES_EVENT = 'hacktrack:analytics-preferences';

/** Re-opens the consent banner (e.g. from the footer) so visitors can change their choice. */
export function openAnalyticsPreferences() {
  window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT));
}

const read = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};
const write = (storage, key, value) => {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, blocked) — analytics stays anonymous */
  }
};

export function browserOptedOut() {
  if (typeof navigator === 'undefined') return false;
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
}

/** 'granted' | 'denied' | null (not decided yet) */
export function getConsent() {
  if (browserOptedOut()) return 'denied';
  const v = read(localStorage, CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

export function setConsent(value) {
  write(localStorage, CONSENT_KEY, value);
  if (value !== 'granted') {
    // Withdrawing consent deletes the identifiers immediately.
    write(localStorage, VISITOR_KEY, null);
    write(sessionStorage, SESSION_KEY, null);
  }
  listeners.forEach((fn) => fn(value));
}

export function subscribeToConsent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const randomId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

function visitorId() {
  const now = Date.now();
  try {
    const stored = JSON.parse(read(localStorage, VISITOR_KEY) || 'null');
    if (stored?.id && now - stored.createdAt < VISITOR_MAX_AGE_MS) return stored.id;
  } catch {
    /* corrupt value: replace it */
  }
  const id = randomId();
  write(localStorage, VISITOR_KEY, JSON.stringify({ id, createdAt: now }));
  return id;
}

function sessionInfo() {
  const now = Date.now();
  let isNew = false;
  let stored = null;
  try {
    stored = JSON.parse(read(sessionStorage, SESSION_KEY) || 'null');
  } catch {
    stored = null;
  }
  if (!stored?.id || now - stored.lastSeen > SESSION_IDLE_MS) {
    stored = { id: randomId() };
    isNew = true;
  }
  stored.lastSeen = now;
  write(sessionStorage, SESSION_KEY, JSON.stringify(stored));
  return { id: stored.id, isNew };
}

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|search\.brave)\./i;
const SOCIAL = /(^|\.)(linkedin|lnkd|twitter|x|t|facebook|fb|instagram|reddit|youtube|whatsapp|telegram|discord|threads)\.(com|co|in|me|gg|net|org)$/i;

/** Coarse referrer category; the referring URL itself is never sent. */
function referrerCategory(firstPageOfVisit) {
  if (!firstPageOfVisit) return 'internal';
  const ref = typeof document !== 'undefined' ? document.referrer : '';
  if (!ref) return 'direct';
  try {
    const host = new URL(ref).hostname;
    if (host === window.location.hostname) return 'internal';
    if (SEARCH.test(host)) return 'search';
    if (SOCIAL.test(host)) return 'social';
    return 'other';
  } catch {
    return 'other';
  }
}

function signedInRole() {
  try {
    return JSON.parse(read(localStorage, 'hacktrack_current_user') || 'null')?.role || null;
  } catch {
    return null;
  }
}

let lastTracked = { path: null, at: 0 };
let firstPage = true;

/** Reports one page view for a pathname (query strings are stripped). */
export function trackPageView(pathname) {
  if (!ENABLED || typeof window === 'undefined') return;
  if (navigator.webdriver) return; // automated browsers
  if (STAFF_ROLES.has(signedInRole())) return;

  const path = String(pathname || '/').split(/[?#]/)[0];
  const now = Date.now();
  // React StrictMode and quick re-renders can fire twice for one navigation.
  if (lastTracked.path === path && now - lastTracked.at < 2000) return;
  lastTracked = { path, at: now };

  const payload = { type: 'page_view', path };
  let isFirst = firstPage;
  if (getConsent() === 'granted') {
    const session = sessionInfo();
    payload.visitorId = visitorId();
    payload.sessionId = session.id;
    isFirst = firstPage || session.isNew;
  }
  payload.referrer = referrerCategory(isFirst);
  firstPage = false;

  try {
    // text/plain keeps this a "simple" request (no CORS preflight).
    fetch(`${API_BASE_URL}/analytics/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});
  } catch {
    /* analytics must never break navigation */
  }
}
