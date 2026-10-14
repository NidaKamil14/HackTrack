import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Alert, Button, Dialog, Skeleton, cn } from '../ui';
import EmailActivity from './EmailActivity';

/*
 * Email notification preferences (per category), backed by
 * GET/PUT /api/v1/notifications/preferences. Feedback reflects the server's
 * response — nothing is shown as saved unless the server confirmed it.
 */
function Switch({ checked, onChange, label, description, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg" id={`pref-${label}`}>{label}</p>
        <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`pref-${label}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors touch:h-7 touch:w-12',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-raised'
        )}
      >
        <span
          aria-hidden="true"
          className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-6' : 'translate-x-1')}
        />
      </button>
    </div>
  );
}

export default function EmailPreferencesDialog({ open, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Email notifications"
      description="Choose which updates HackTrack emails you. In-app notifications are always kept."
    >
      {/* Mounted only while open, so every opening starts from fresh server data. */}
      <PreferencesPanel onClose={onClose} />
    </Dialog>
  );
}

function PreferencesPanel({ onClose }) {
  const [status, setStatus] = useState(() =>
    api.getToken() ? { loading: true, offline: false, error: null } : { loading: false, offline: true, error: null }
  );
  const [categories, setCategories] = useState({});
  const [prefs, setPrefs] = useState({});
  const [saved, setSaved] = useState({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!api.getToken()) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getEmailPreferences();
        if (cancelled) return;
        setCategories(data.categories || {});
        setPrefs(data.preferences || {});
        setSaved(data.preferences || {});
        setStatus({ loading: false, offline: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setStatus({ loading: false, offline: Boolean(err.isNetworkError || err.status === 401), error: err.isNetworkError ? null : err.message });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dirty = Object.keys(prefs).some((k) => prefs[k] !== saved[k]);

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const data = await api.updateEmailPreferences(prefs);
      setPrefs(data.preferences);
      setSaved(data.preferences);
      setFeedback({ tone: 'success', text: 'Email preferences saved.' });
    } catch (err) {
      setFeedback({ tone: 'danger', text: err.isNetworkError ? 'The server is unreachable, so your preferences were not saved.' : err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {status.loading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      )}

      {!status.loading && status.offline && (
        <Alert tone="info" title="Email settings need the HackTrack server">
          Preferences are stored on the server that sends your emails. Sign in while the HackTrack server is running to
          manage them. This session is using offline demo data.
        </Alert>
      )}

      {!status.loading && status.error && <Alert tone="danger" title="Couldn’t load your preferences">{status.error}</Alert>}

      {!status.loading && !status.offline && !status.error && (
        <div className="space-y-6">
          <div className="divide-y divide-line rounded-xl border border-line px-4">
            {Object.entries(categories).map(([key, meta]) => (
              <Switch
                key={key}
                label={meta.label}
                description={meta.description}
                checked={Boolean(prefs[key])}
                disabled={saving}
                onChange={(value) => setPrefs((p) => ({ ...p, [key]: value }))}
              />
            ))}
          </div>

          {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button onClick={save} loading={saving} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save preferences'}
            </Button>
          </div>

          <section aria-labelledby="email-activity-heading" className="space-y-3 border-t border-line pt-5">
            <h3 id="email-activity-heading" className="text-sm font-semibold text-fg">Recent email activity</h3>
            <EmailActivity limit={5} compact />
          </section>
        </div>
      )}
    </>
  );
}
