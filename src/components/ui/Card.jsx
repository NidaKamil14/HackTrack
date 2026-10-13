import React from 'react';
import { cn } from './cn';

/**
 * Card — the standard surface. `interactive` adds hover affordance for
 * clickable cards; pair it with a real <a>/<Link>/<button> inside or `as`.
 */
export function Card({ as: Component = 'div', interactive = false, className, ...props }) {
  return (
    <Component
      className={cn(
        'rounded-xl border border-line bg-surface shadow-sm',
        interactive && 'transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-md',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-0', className)} {...props} />;
}

export function CardTitle({ as: Component = 'h3', className, ...props }) {
  return <Component className={cn('text-base font-semibold leading-snug text-fg', className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-fg-muted', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('flex items-center gap-2 border-t border-line px-5 py-3', className)} {...props} />;
}
