import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Button } from '../ui';
import { getConsent, setConsent, subscribeToConsent, browserOptedOut, ANALYTICS_PREFERENCES_EVENT as OPEN_EVENT } from '../../utils/analytics';

/*
 * Privacy notice + choice for anonymous usage analytics. Shown until the
 * visitor decides; never shown when the browser sends Global Privacy
 * Control / Do Not Track (treated as declined).
 */
export default function AnalyticsConsent() {
  const [open, setOpen] = useState(() => getConsent() === null);
  const [details, setDetails] = useState(false);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    const unsubscribe = subscribeToConsent(() => setOpen(false));
    return () => {
      window.removeEventListener(OPEN_EVENT, reopen);
      unsubscribe();
    };
  }, []);

  if (!open) return null;
  const optedOut = browserOptedOut();
  const current = getConsent();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4" role="region" aria-label="Analytics privacy choice">
      <div className="surface-card mx-auto max-w-3xl rounded-2xl border border-line-strong p-4 shadow-lg sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-text ring-1 ring-inset ring-accent/30 sm:flex">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-fg">Help us measure HackTrack’s reach</p>
            <p className="text-sm text-fg-muted">
              We count page views anonymously so hackathon organizers can see how many people the platform reaches.
              With your permission we also keep a random ID in this browser to estimate unique visitors.
            </p>
            {details && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-fg-subtle">
                <li>We record which page was viewed, when, a coarse device type and whether you came from search, social or another site.</li>
                <li>We never record your IP address, browser fingerprint, the full URL, your account or anything you type.</li>
                <li>If you allow it, a random ID is stored in this browser (replaced every 12 months) and a session ID until you are inactive for 30 minutes. The server keeps only a scrambled version of them.</li>
                <li>Organizers only ever see totals — never individual visits.</li>
                <li>Declining still counts the page view anonymously, without any stored ID. You can change this any time from the footer.</li>
              </ul>
            )}
            {optedOut && (
              <p className="text-xs text-fg-subtle">Your browser asks sites not to track you, so visitor IDs are off.</p>
            )}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
              <Button variant="ghost" size="sm" onClick={() => setDetails((d) => !d)} aria-expanded={details}>
                {details ? 'Hide details' : 'What we collect'}
              </Button>
              {!optedOut && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setConsent('denied')} aria-pressed={current === 'denied'}>
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => setConsent('granted')} aria-pressed={current === 'granted'}>
                    Allow analytics
                  </Button>
                </>
              )}
              {optedOut && (
                <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
