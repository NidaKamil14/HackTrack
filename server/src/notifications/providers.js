import { emailConfig, maskEmail } from './config.js';

/*
 * Transactional email providers behind one interface:
 *   send({ to, subject, html, text, headers }) → { id }
 * Errors carry `transient: true` when a retry may succeed (network failures,
 * 429 and 5xx responses); anything else is treated as permanent.
 * Uses Node's built-in fetch, so no SDK dependency is required.
 */

export class EmailDeliveryError extends Error {
  constructor(message, { transient = false, status = null } = {}) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.transient = transient;
    this.status = status;
  }
}

async function postJson(url, apiKey, body, providerName) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new EmailDeliveryError(`${providerName} request failed: ${err.name || err.message}`, { transient: true });
  }
  if (!response.ok) {
    // Extract provider error detail safely without exposing request body or secrets
    let detail = '';
    try {
      const errorJson = await response.json();
      if (errorJson) {
        if (typeof errorJson.message === 'string') {
          detail = `: ${errorJson.message}`;
        } else if (Array.isArray(errorJson.errors) && errorJson.errors[0]?.message) {
          detail = `: ${errorJson.errors[0].message}`;
        } else if (typeof errorJson.error === 'string') {
          detail = `: ${errorJson.error}`;
        }
      }
    } catch {
      // body wasn't JSON
    }
    const transient = response.status === 429 || response.status >= 500;
    throw new EmailDeliveryError(`${providerName} error (HTTP ${response.status})${detail}`, { transient, status: response.status });
  }
  return response;
}

const resendProvider = {
  name: 'resend',
  async send({ to, subject, html, text, headers }) {
    const { apiKey, from, replyTo } = emailConfig();
    if (!apiKey) throw new EmailDeliveryError('EMAIL_API_KEY is not configured', { transient: false });
    const res = await postJson('https://api.resend.com/emails', apiKey, {
      from, to: [to], subject, html, text, headers,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }, 'Resend');
    const data = await res.json().catch(() => ({}));
    return { id: data.id || null };
  },
};

const sendgridProvider = {
  name: 'sendgrid',
  async send({ to, subject, html, text, headers }) {
    const { apiKey, from, replyTo } = emailConfig();
    if (!apiKey) throw new EmailDeliveryError('EMAIL_API_KEY is not configured', { transient: false });
    const match = /^(.*)<(.+)>$/.exec(from.trim());
    const sender = match ? { name: match[1].trim(), email: match[2].trim() } : { email: from.trim() };
    const res = await postJson('https://api.sendgrid.com/v3/mail/send', apiKey, {
      personalizations: [{ to: [{ email: to }] }],
      from: sender,
      ...(replyTo ? { reply_to: { email: replyTo } } : {}),
      subject,
      headers,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }, 'SendGrid');
    return { id: res.headers.get('x-message-id') };
  },
};

// Development: logs that an email *would* be sent (recipient masked, no body).
const consoleProvider = {
  name: 'console',
  async send({ to, subject }) {
    console.log(`[Email:console] to=${maskEmail(to)} subject="${subject}" (set EMAIL_PROVIDER + EMAIL_API_KEY to deliver)`);
    // Nothing was delivered — report it so the status isn't shown as "sent".
    return { id: null, simulated: true };
  },
};

// Explicitly disabled: nothing is sent; notifications record status "skipped".
const disabledProvider = { name: 'disabled', disabled: true, async send() { return { id: null }; } };

// Tests: records messages in memory; can be told to fail.
export const memoryProvider = {
  name: 'memory',
  sent: [],
  failures: [], // queue of { transient, message } consumed one per send
  async send(message) {
    const failure = this.failures.shift();
    if (failure) throw new EmailDeliveryError(failure.message || 'Simulated provider failure', { transient: Boolean(failure.transient) });
    this.sent.push(message);
    return { id: `mem-${this.sent.length}` };
  },
  reset() {
    this.sent = [];
    this.failures = [];
  },
};

const PROVIDERS = { resend: resendProvider, sendgrid: sendgridProvider, console: consoleProvider, disabled: disabledProvider, memory: memoryProvider };

export function getProvider() {
  const { provider } = emailConfig();
  const selected = PROVIDERS[provider];
  if (!selected) {
    console.warn(`[Email] Unknown EMAIL_PROVIDER "${provider}" — emails will not be sent.`);
    return disabledProvider;
  }
  return selected;
}
