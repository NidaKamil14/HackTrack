import React, { useCallback, useEffect, useState } from 'react';
import { MailCheck, MailWarning, MailX, Clock, MailMinus, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import { Alert, Badge, Button, EmptyState, Skeleton } from '../ui';

/*
 * Server-side notifications with their email delivery status.
 * Statuses are shown exactly as the backend's delivery worker recorded them:
 * an email is only described as "sent" when the provider accepted it.
 */
const STATUS = {
  sent: { tone: 'success', icon: MailCheck, label: 'Email sent' },
  queued: { tone: 'info', icon: Clock, label: 'Email queued' },
  pending: { tone: 'info', icon: Clock, label: 'Email pending' },
  failed: { tone: 'danger', icon: MailX, label: 'Email failed' },
  skipped: { tone: 'neutral', icon: MailMinus, label: 'Not emailed' },
};

export function EmailStatusBadge({ email }) {
  const s = STATUS[email?.status] || STATUS.pending;
  const Icon = s.icon;
  return (
    <Badge tone={s.tone} title={email?.reason || undefined}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {s.label}
    </Badge>
  );
}

const formatWhen = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function EmailActivity({ limit, compact = false }) {
  // Initial state is computed up front; the effect only applies the server's
  // answer (no synchronous setState inside the effect).
  const [state, setState] = useState(() =>
    api.getToken() ? { loading: true, error: null, offline: false, items: [] } : { loading: false, error: null, offline: true, items: [] }
  );

  const fetchState = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      return { loading: false, error: null, offline: false, items: data.notifications || [] };
    } catch (err) {
      return { loading: false, error: err.isNetworkError ? null : err.message, offline: Boolean(err.isNetworkError || err.status === 401), items: [] };
    }
  }, []);

  useEffect(() => {
    if (!api.getToken()) return undefined;
    let cancelled = false;
    fetchState().then((next) => { if (!cancelled) setState(next); });
    return () => { cancelled = true; };
  }, [fetchState]);

  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setState(await fetchState());
  };

  if (state.loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading email activity">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
      </div>
    );
  }

  if (state.offline) {
    return (
      <Alert tone="info" title="Email activity needs the HackTrack server">
        Emails are sent by the HackTrack server. Sign in while it’s running to see delivery status here —
        this session is using offline demo data, so no emails are sent for its actions.
      </Alert>
    );
  }

  if (state.error) {
    return (
      <Alert tone="danger" title="Couldn’t load email activity" action={<Button size="sm" variant="secondary" onClick={load}>Try again</Button>}>
        {state.error}
      </Alert>
    );
  }

  const items = limit ? state.items.slice(0, limit) : state.items;
  if (items.length === 0) {
    return (
      <EmptyState
        illustration="inbox"
        title="No email activity yet"
        description="When something happens on your team or hackathon, you’ll see the notification and whether it was emailed here."
        className={compact ? 'py-6' : undefined}
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {items.map((n) => (
          <li key={n.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{n.title}</p>
              {n.message && !compact && <p className="mt-0.5 text-sm text-fg-muted">{n.message}</p>}
              <p className="mt-1 text-xs text-fg-subtle">{formatWhen(n.createdAt)}</p>
              {n.email?.status === 'failed' && n.email.reason && (
                <p className="mt-1 flex items-center gap-1 text-xs text-danger">
                  <MailWarning className="h-3.5 w-3.5" aria-hidden="true" /> {n.email.reason}
                </p>
              )}
              {n.email?.status === 'skipped' && n.email.reason && (
                <p className="mt-1 text-xs text-fg-subtle">{n.email.reason}</p>
              )}
            </div>
            <div className="shrink-0"><EmailStatusBadge email={n.email} /></div>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" onClick={load}>
        <RefreshCw aria-hidden="true" />
        Refresh
      </Button>
    </div>
  );
}
