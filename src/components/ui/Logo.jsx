import React from 'react';
import { cn } from './cn';

/** HackTrack wordmark. Purely presentational — wrap it in a Link where needed. */
export function Logo({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-sm"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="5 16 10 11 5 6" />
          <line x1="12" y1="18" x2="19" y2="18" />
        </svg>
      </span>
      <span className="text-base font-semibold tracking-tight text-fg">HackTrack</span>
    </span>
  );
}
