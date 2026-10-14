import React from 'react';
import { Skeleton } from './ui';

// Shown while a lazily loaded route chunk downloads. A page-shaped skeleton
// (header + card grid) instead of a lone spinner, so the swap to real content
// barely shifts the layout.
export default function RouteFallback() {
  return (
    <div className="container-page min-h-[60vh] space-y-8 py-8" role="status" aria-label="Loading page">
      <div className="space-y-3 rounded-2xl border border-line p-6 sm:p-8">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
