import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Eye, Globe2, Info, MousePointerClick, RefreshCw, TrendingDown, TrendingUp, Users } from 'lucide-react';
import api from '../../utils/api';
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Skeleton, StatCard, cn } from '../ui';
import TrendChart from './TrendChart';
import { formatUtcDate } from './formatUtcDate';

/*
 * "Platform Reach & Traffic" — real first-party analytics from
 * GET /api/v1/analytics/platform and /analytics/events. Every number here
 * comes from the server; nothing is estimated or filled in on the client.
 */

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

const nf = new Intl.NumberFormat();
const fmt = (n) => (n === null || n === undefined ? '—' : nf.format(n));

const DEFINITIONS = [
  ['Estimated unique visitors', 'Distinct browsers that allowed anonymous analytics. One person on two devices counts twice, and visitors who decline are not included, so this is an estimate — not verified people.'],
  ['Visits (sessions)', 'Browsing sessions from those browsers; a session ends after 30 minutes of inactivity.'],
  ['Page views', 'Every page viewed by anyone, including visitors who declined analytics. One visitor can create many page views.'],
];

function RangePicker({ value, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          disabled={disabled}
          onClick={() => onChange(r.value)}
          className={cn(
            'min-h-9 rounded-md px-3 text-sm font-medium transition-colors touch:min-h-11',
            value === r.value ? 'bg-accent text-white shadow-sm' : 'text-fg-muted hover:text-fg'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function Growth({ growth }) {
  if (!growth) return null;
  if (!growth.available) {
    return <p className="text-xs text-fg-subtle">Month-over-month growth: {growth.reason}</p>;
  }
  const pct = growth.uniqueVisitorsChangePct;
  if (pct === null) {
    return <p className="text-xs text-fg-subtle">Month-over-month growth: no visitors in the previous 30 days to compare against.</p>;
  }
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
      <Icon className={cn('h-4 w-4', pct >= 0 ? 'text-success' : 'text-danger')} aria-hidden="true" />
      <span className="font-semibold text-fg">{pct > 0 ? '+' : ''}{pct}%</span>
      estimated unique visitors, last 30 days vs the 30 days before ({fmt(growth.current.uniqueVisitors)} vs {fmt(growth.previous.uniqueVisitors)})
    </p>
  );
}

function EventPerformance({ events }) {
  if (!events.length) {
    return (
      <EmptyState
        illustration="calendar"
        title="No hackathons yet"
        description="Create a hackathon to see how many people view its page and register."
        className="py-8"
      />
    );
  }
  const max = Math.max(1, ...events.map((e) => e.detailPageViews));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Performance of your hackathons in the selected period</caption>
        <thead className="text-left text-xs text-fg-muted">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-3 font-medium">Hackathon</th>
            <th scope="col" className="py-2 pr-3 font-medium">Event page views</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Est. unique visitors</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Registrations</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Teams</th>
            <th scope="col" className="py-2 text-right font-medium">Conversion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {events.map((e) => (
            <tr key={e.hackathonId}>
              <th scope="row" className="py-3 pr-3 text-left font-medium text-fg">
                <span className="line-clamp-2">{e.title}</span>
                {e.status === 'draft' && <Badge tone="neutral" className="mt-1">Draft · not public</Badge>}
              </th>
              <td className="py-3 pr-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-sunken sm:w-40" aria-hidden="true">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(e.detailPageViews / max) * 100}%` }} />
                  </div>
                  <span className="tabular-nums text-fg">{fmt(e.detailPageViews)}</span>
                </div>
              </td>
              <td className="py-3 pr-3 text-right tabular-nums text-fg">{fmt(e.uniqueVisitors)}</td>
              <td className="py-3 pr-3 text-right tabular-nums text-fg">
                {fmt(e.registrations.inPeriod)}
                <span className="block text-xs text-fg-subtle">{fmt(e.registrations.total)} total</span>
              </td>
              <td className="py-3 pr-3 text-right tabular-nums text-fg">{fmt(e.teams)}</td>
              <td className="py-3 text-right tabular-nums text-fg" title={e.conversionNote || undefined}>
                {e.conversionRatePct === null ? <span className="text-xs text-fg-subtle">Not enough data</span> : `${e.conversionRatePct}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-fg-subtle">
        Conversion = registrations in the period ÷ estimated unique visitors to the event page. It appears once a page has at least 10 estimated visitors.
        Registrations from visitors who declined analytics are included, so treat it as indicative.
      </p>
    </div>
  );
}

export default function PlatformReach() {
  const [range, setRange] = useState('30d');
  const [state, setState] = useState(() =>
    api.getToken() ? { loading: true, error: null, offline: false, platform: null, events: [] } : { loading: false, error: null, offline: true, platform: null, events: [] }
  );
  const [showDefs, setShowDefs] = useState(false);

  const fetchAll = useCallback(async (r) => {
    try {
      const [platform, events] = await Promise.all([api.getPlatformAnalytics({ range: r }), api.getEventAnalytics({ range: r })]);
      return { loading: false, error: null, offline: false, platform, events: events.events || [] };
    } catch (err) {
      return { loading: false, error: err.isNetworkError ? null : err.message, offline: Boolean(err.isNetworkError || err.status === 401), platform: null, events: [] };
    }
  }, []);

  useEffect(() => {
    if (!api.getToken()) return undefined;
    let cancelled = false;
    fetchAll(range).then((next) => { if (!cancelled) setState(next); });
    return () => { cancelled = true; };
  }, [fetchAll, range]);

  const changeRange = (r) => {
    if (r === range) return;
    setState((s) => ({ ...s, loading: true }));
    setRange(r);
  };

  const refresh = async () => {
    setState((s) => ({ ...s, loading: true }));
    setState(await fetchAll(range));
  };

  const p = state.platform;
  const hasHistory = Boolean(p?.trackingSince);

  return (
    <section className="space-y-4" aria-labelledby="platform-reach-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="platform-reach-heading" className="flex items-center gap-2 text-lg font-semibold text-fg">
            <Globe2 className="h-5 w-5 text-accent-text" aria-hidden="true" />
            Platform Reach &amp; Traffic
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            The audience your hackathons are listed in front of, measured with HackTrack’s own privacy-friendly analytics,
            and how your own events perform.
          </p>
        </div>
        {!state.offline && (
          <div className="flex flex-wrap items-center gap-2">
            <RangePicker value={range} onChange={changeRange} disabled={state.loading && !p} />
            <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh analytics" disabled={state.loading}>
              <RefreshCw className={cn(state.loading && 'animate-spin')} aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {state.offline && (
        <Alert tone="info" title="Traffic analytics need the HackTrack server">
          Visitor numbers are recorded and calculated on the server. Sign in while the HackTrack server is running to see
          platform reach and your events’ performance. This session is using offline demo data.
        </Alert>
      )}

      {!state.offline && state.error && (
        <Alert tone="danger" title="Couldn’t load analytics" action={<Button size="sm" variant="secondary" onClick={refresh}>Try again</Button>}>
          {state.error}
        </Alert>
      )}

      {!state.offline && !state.error && state.loading && !p && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Loading analytics">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      )}

      {p && (
        <div className={cn('space-y-4 transition-opacity', state.loading && 'opacity-60')} aria-busy={state.loading}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard tone="accent" icon={Users} label="Est. unique visitors" value={fmt(p.totals.uniqueVisitors)} hint={`Selected period · ${fmt(p.allTime.uniqueVisitors)} all time`} />
            <StatCard tone="info" icon={MousePointerClick} label="Visits (sessions)" value={fmt(p.totals.sessions)} hint={`Selected period · ${fmt(p.allTime.sessions)} all time`} />
            <StatCard tone="cyan" icon={Eye} label="Page views" value={fmt(p.totals.pageViews)} hint={`Selected period · ${fmt(p.allTime.pageViews)} all time`} />
            <StatCard
              tone="success"
              icon={Activity}
              label="Visitors, last 7 / 30 days"
              value={`${fmt(p.last7Days.uniqueVisitors)} / ${fmt(p.last30Days.uniqueVisitors)}`}
              hint="Estimated unique visitors"
            />
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <Growth growth={p.growth} />
            <button
              type="button"
              onClick={() => setShowDefs((s) => !s)}
              aria-expanded={showDefs}
              className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-accent-text hover:underline"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              How these numbers are measured
            </button>
          </div>

          {showDefs && (
            <Card>
              <CardContent className="space-y-2 pt-5 text-sm">
                <dl className="space-y-2">
                  {DEFINITIONS.map(([term, def]) => (
                    <div key={term}>
                      <dt className="font-medium text-fg">{term}</dt>
                      <dd className="text-fg-muted">{def}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-fg-subtle">
                  Bots, automated browsers and signed-in staff (organizers, judges, screening, mentors, admins) are excluded. Reloads of the same page within
                  30 seconds count once. No IP addresses or personal data are stored. Dates are in UTC.
                  {p.trackingSince && ` Tracking since ${formatUtcDate(p.trackingSince.slice(0, 10), { year: 'numeric', month: 'short', day: 'numeric' })}.`}
                  {p.totals.pageViews > 0 && ` ${Math.round((p.totals.identifiedPageViews / p.totals.pageViews) * 100)}% of page views in this period came from visitors who allowed analytics.`}
                </p>
              </CardContent>
            </Card>
          )}

          {!hasHistory ? (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  illustration="search"
                  title="No traffic recorded yet"
                  description="Visitor trends appear here once people start browsing HackTrack. Nothing is estimated in advance — every number shown is a real recorded visit."
                  className="py-8"
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="pt-5">
                  <TrendChart data={p.trend} valueKey="uniqueVisitors" label={p.bucket === 'week' ? 'Estimated unique visitors per week' : 'Estimated unique visitors per day'} bucket={p.bucket} kind="line" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <TrendChart data={p.trend} valueKey="pageViews" label={p.bucket === 'week' ? 'Page views per week' : 'Page views per day'} bucket={p.bucket} kind="bar" />
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Your hackathons</CardTitle>
              <CardDescription>Views of each event page, registrations and conversion in the selected period. Only you and platform admins can see these.</CardDescription>
            </CardHeader>
            <CardContent>
              <EventPerformance events={state.events} />
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
