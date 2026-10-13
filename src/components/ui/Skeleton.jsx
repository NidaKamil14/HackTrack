import React from 'react';
import { cn } from './cn';

export function Skeleton({ className, ...props }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-raised', className)} {...props} />;
}
