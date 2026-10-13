import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from './cn';

/**
 * PageHeader — the top of every page: optional eyebrow, title, description,
 * and right-aligned actions. Exactly one per page.
 */
export function PageHeader({ eyebrow, title, description, actions, meta, className }) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="max-w-prose text-sm text-fg-muted sm:text-base">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-sm text-fg-subtle">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** SectionHeader — heading for a section inside a page or card. */
export function SectionHeader({ title, description, actions, as: Heading = 'h2', className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0 space-y-0.5">
        <Heading className="text-base font-semibold text-fg">{title}</Heading>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** EmptyState — explains why something is empty and what to do next. */
// titleAs: use 'h1' when the empty state is the whole page (e.g. not found).
export function EmptyState({ icon: Icon, title, description, action, titleAs: Title = 'p', className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-raised text-fg-muted">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <Title className={Title === 'p' ? 'text-sm font-semibold text-fg' : 'text-xl font-semibold tracking-tight text-fg'}>{title}</Title>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const alertTones = {
  info: { cls: 'border-info/25 bg-info/10 text-info', Icon: Info },
  success: { cls: 'border-success/25 bg-success/10 text-success', Icon: CheckCircle2 },
  warning: { cls: 'border-warning/25 bg-warning/10 text-warning', Icon: AlertTriangle },
  danger: { cls: 'border-danger/25 bg-danger/10 text-danger', Icon: AlertCircle },
};

/** Alert — inline feedback. Errors use role="alert", others role="status". */
export function Alert({ tone = 'info', title, children, action, className }) {
  const { cls, Icon } = alertTones[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-3 text-sm', cls, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-fg-muted">{children}</div>}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}

/** StatCard — a single real metric. Never use for invented numbers. */
export function StatCard({ label, value, hint, icon: Icon, className }) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

/** DescriptionList — label/value rows for metadata. items: [{ label, value }] */
export function DescriptionList({ items, className }) {
  return (
    <dl className={cn('divide-y divide-line', className)}>
      {items.map(({ label, value }) => (
        <div key={label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <dt className="text-fg-muted">{label}</dt>
          <dd className="text-right font-medium text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* Table styling helpers — use on native <table> markup. Wrap in TableContainer. */
export function TableContainer({ className, children }) {
  return (
    <div className={cn('relative overflow-x-auto rounded-xl border border-line bg-surface', className)}>
      {children}
    </div>
  );
}
