// Redeems a committee access code (screening, judge or mentor).
//
// Signed in, the server is the source of truth: a code it accepts binds the
// account to the event. A code the server rejects is only accepted locally when
// it belongs to a browser-only demo event; a stale or wrong code for a server
// event is reported instead of silently "succeeding" in this browser only.

import api from './api';
import { getAllAccessCodes, redeemAccessCode } from './hackathonService';

const GENERIC_ERROR = 'Invalid or unavailable access code.';

export async function redeemReviewerCode(rawCode, user) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { success: false, error: 'Please enter an access code.' };

  if (!api.getToken()) return redeemAccessCode(code, user);

  try {
    const res = await api.redeemCode(code);
    const a = res?.assignment || {};
    return {
      success: true,
      server: true,
      hackathonId: a.hackathonId,
      hackathonTitle: a.hackathonTitle,
      role: a.role,
      message: res?.message || `You now have access to ${a.hackathonTitle}.`,
    };
  } catch (err) {
    if (err?.status === 429) return { success: false, error: err.message || 'Too many attempts. Try again in a few minutes.' };

    const local = getAllAccessCodes().find((c) => String(c.code).toUpperCase() === code);
    if (!local) return { success: false, error: err?.message || GENERIC_ERROR };

    // A local copy of a code for an event that lives on the server is stale.
    const isServerEvent = await api.getHackathon(local.hackathonId).then(() => true).catch(() => false);
    if (isServerEvent) {
      return { success: false, error: 'This code is no longer valid for this event. Ask the organizer for the current code.' };
    }
    return redeemAccessCode(code, user);
  }
}
