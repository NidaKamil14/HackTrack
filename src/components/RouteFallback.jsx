import React from 'react';
import { Spinner } from './ui';

// Shown while a lazily loaded route chunk downloads. Reserves height so the
// footer doesn't jump up and back down.
export default function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-fg-subtle">
      <Spinner className="h-5 w-5" label="Loading page" />
    </div>
  );
}
