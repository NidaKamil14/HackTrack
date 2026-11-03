import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clapperboard, KeyRound, RotateCcw, Users } from 'lucide-react';
import api from '../../utils/api';
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, Skeleton, cn } from '../ui';

/*
 * Admin control for the shared demonstration scenario (one event, one team).
 * Everything shown comes from GET /api/v1/demo; "Jump to stage" rebuilds the
 * scenario on the server through the normal business operations.
 */
export default function DemoScenarioPanel() {
  const [state, setState] = useState(() => (api.getToken() ? { loading: true, error: null, demo: null } : { loading: false, error: 'Sign in to the HackTrack server to manage the demo scenario.', demo: null }));
  const [confirm, setConfirm] = useState(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState(null);

  const fetchDemo = useCallback(async () => {
    try {
      const res = await api.getDemo();
      return { loading: false, error: null, demo: res.demo };
    } catch (err) {
      return { loading: false, error: err.status === 404 ? 'Demo mode is disabled on this server (DEMO_MODE=false or production).' : err.message, demo: null };
    }
  }, []);

  useEffect(() => {
    if (!api.getToken()) return undefined;
    let cancelled = false;
    fetchDemo().then((next) => { if (!cancelled) setState(next); });
    return () => { cancelled = true; };
  }, [fetchDemo]);

  const jump = async () => {
    if (!confirm) return;
    setWorking(true);
    try {
      const res = await api.resetDemo(confirm.key);
      setState({ loading: false, error: null, demo: res.demo });
      setNotice({ tone: 'success', text: `Demo reset to “${confirm.label}”. Every panel now shows this stage.` });
      window.dispatchEvent(new CustomEvent('hacktrack_data_sync', { detail: { eventType: 'demo_reset' } }));
    } catch (err) {
      setNotice({ tone: 'danger', text: `Reset failed: ${err.message}` });
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  if (state.loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (state.error) return <Alert tone="info" title="Demo scenario unavailable">{state.error}</Alert>;

  const { demo } = state;
  const currentIndex = demo.stages.findIndex((s) => s.key === demo.stage);
  const p = demo.progress;

  return (
    <div className="space-y-4">
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-accent-text" aria-hidden="true" />
            Shared demo scenario
          </CardTitle>
          <CardDescription>
            One event (HackTrack Innovation Challenge) and one team (Team Apex Innovators) that every dashboard reads from the server.
            Progress it live from each role, or jump to any stage below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ol className="space-y-2" aria-label="Lifecycle stages">
            {demo.stages.map((s, i) => {
              const done = i < currentIndex;
              const current = i === currentIndex;
              return (
                <li key={s.key} className={cn('flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between', current ? 'border-accent/50 bg-accent/10' : 'border-line')}>
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold', done || current ? 'bg-accent text-white' : 'bg-raised text-fg-muted')} aria-hidden="true">
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">
                        {s.label} {current && <Badge tone="accent" className="ml-1">Current</Badge>}
                      </p>
                      <p className="text-xs text-fg-subtle">{s.description}</p>
                    </div>
                  </div>
                  <Button size="sm" variant={current ? 'ghost' : 'secondary'} className="shrink-0" onClick={() => setConfirm(s)}>
                    <RotateCcw aria-hidden="true" />
                    {current ? 'Restart here' : 'Jump here'}
                  </Button>
                </li>
              );
            })}
          </ol>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section aria-labelledby="demo-accounts" className="space-y-2">
              <h3 id="demo-accounts" className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Users className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> Demo accounts
              </h3>
              <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                {demo.accounts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-medium text-fg">{a.fullName}</span>
                      <span className="block truncate font-mono text-xs text-fg-subtle">{a.email}</span>
                    </span>
                    <Badge>{a.role}</Badge>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-fg-subtle">All demo accounts use the documented demo password. Emails are never sent to the demo domain.</p>
            </section>

            <section aria-labelledby="demo-ids" className="space-y-2">
              <h3 id="demo-ids" className="flex items-center gap-2 text-sm font-semibold text-fg">
                <KeyRound className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> Shared records
              </h3>
              <dl className="divide-y divide-line rounded-lg border border-line text-sm">
                {[
                  ['Event id', demo.ids.hackathonId],
                  ['Team id', demo.ids.teamId || '— (not created yet)'],
                  ['Team invite code', demo.ids.teamCode || '—'],
                  ['Submission id', demo.ids.submissionId || '—'],
                  ['Screening code', demo.accessCodes.screening || '—'],
                  ['Judge code', demo.accessCodes.judge || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                    <dt className="text-fg-muted">{k}</dt>
                    <dd className="truncate font-mono text-xs text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
              {p && (
                <p className="text-xs text-fg-subtle">
                  {p.registrations} registrations · {p.teams} team · {p.submissions} submission · {p.screening.shortlisted} shortlisted ·{' '}
                  {p.judging.complete} judged · results {p.resultsPublished ? 'published' : 'not published'}
                </p>
              )}
            </section>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(confirm)}
        onClose={() => !working && setConfirm(null)}
        title={confirm ? `Reset the demo to “${confirm.label}”?` : ''}
        description="This rebuilds only the demonstration event's records (registrations, team, submission, reviews, scores, certificates and the demo accounts' notifications). Nothing else on the platform changes."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirm(null)} disabled={working}>Cancel</Button>
          <Button onClick={jump} loading={working}>Reset demo</Button>
        </div>
      </Dialog>
    </div>
  );
}
