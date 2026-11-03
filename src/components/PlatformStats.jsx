import React, { useState, useEffect } from 'react';
import { CalendarDays, Trophy, UserRoundCheck, UsersRound } from 'lucide-react';
import api from '../utils/api';
import { subscribeToDataSync } from '../utils/syncService';
import { Skeleton } from './ui/Skeleton';

export default function PlatformStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let inFlight = false;
    let timerId = null;

    const fetchLiveStats = async () => {
      // Prevent overlapping in-flight requests
      if (inFlight) return;
      inFlight = true;

      try {
        const response = await api.getPublicStats();
        if (!isMounted) return;

        if (response && response.stats) {
          setStats(response.stats);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[PlatformStats] Live statistics fetch notice:', err?.message || err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
        inFlight = false;
      }
    };

    // 1. Initial fetch on mount
    fetchLiveStats();

    // 2. Poll every 10 seconds
    timerId = setInterval(() => {
      fetchLiveStats();
    }, 10000);

    // 3. Refresh when the visitor returns to the active tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLiveStats();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Instant synchronization when any dashboard modifies data
    const unsubscribe = subscribeToDataSync(() => {
      fetchLiveStats();
    });

    // 5. Clean up interval and listeners on unmount
    return () => {
      isMounted = false;
      if (timerId) clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
    };
  }, []);

  return (
    <div className="surface-card relative rounded-2xl border border-line-strong p-5 !shadow-lg sm:p-6">
      <span className="hairline-gradient pointer-events-none absolute inset-x-10 -top-px h-px" aria-hidden="true" />

      {/* Header bar */}
      <div className="border-b border-line/70 pb-4">
        <h2 className="text-sm font-semibold tracking-tight text-fg">Platform Statistics</h2>
        <p className="text-xs text-fg-subtle">Verified competition metrics</p>
      </div>

      {/* Statistics grid */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        {/* Hackathons hosted */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-violet-200 dark:border-slate-800 dark:bg-surface dark:hover:border-violet-800/60">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Hackathons hosted
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-400">
              <Trophy className="h-4 w-4" />
            </div>
          </div>

          <div className="text-4xl font-bold leading-tight tracking-tight text-violet-600 dark:text-violet-400 tabular-nums">
            {loading && !stats ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              stats?.hackathonsHosted ?? "—"
            )}
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Active &amp; completed events
          </p>
        </div>

        {/* Teams participated */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-teal-200 dark:border-slate-800 dark:bg-surface dark:hover:border-teal-800/60">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Teams participated
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-600 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-400">
              <UsersRound className="h-4 w-4" />
            </div>
          </div>

          <div className="text-4xl font-bold leading-tight tracking-tight text-teal-600 dark:text-teal-400 tabular-nums">
            {loading && !stats ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              stats?.teamsParticipated ?? "—"
            )}
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Formed competitor squads
          </p>
        </div>

        {/* Participants */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-200 dark:border-slate-800 dark:bg-surface dark:hover:border-blue-800/60">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Participants
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400">
              <UserRoundCheck className="h-4 w-4" />
            </div>
          </div>

          <div className="text-4xl font-bold leading-tight tracking-tight text-blue-600 dark:text-blue-400 tabular-nums">
            {loading && !stats ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              stats?.participants ?? "—"
            )}
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Registered competitors
          </p>
        </div>

        {/* Upcoming events */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-amber-200 dark:border-slate-800 dark:bg-surface dark:hover:border-amber-800/60">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Upcoming events
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>

          <div className="text-4xl font-bold leading-tight tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
            {loading && !stats ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              stats?.upcomingEvents ?? "—"
            )}
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Open upcoming competitions
          </p>
        </div>
      </div>
    </div>
  );
}
