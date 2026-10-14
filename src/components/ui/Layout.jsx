import React, { useContext } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from './cn';
import { PageHeaderVariantContext, toneStyles } from './pageHeaderContext';
import EmptyIllustration from '../art/EmptyIllustration';

/** Decorative orbit mark used on hero headers (inline SVG, no assets). */
function HeroOrbit() {
  return (
    <svg
      className="pointer-events-none absolute -right-12 -top-24 hidden h-80 w-80 text-accent-text/40 md:block"
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="100" cy="100" r="96" stroke="currentColor" strokeDasharray="2 6" />
      <circle cx="100" cy="100" r="70" stroke="currentColor" />
      <circle cx="100" cy="100" r="44" stroke="currentColor" strokeDasharray="1 4" />
      <circle cx="170" cy="70" r="4" className="fill-accent-2/70" stroke="none" />
      <circle cx="62" cy="158" r="3" className="fill-accent-text/70" stroke="none" />
    </svg>
  );
}

/**
 * PageHeader — the top of every page: optional eyebrow, title, description,
 * meta row and right-aligned actions. Exactly one per page.
 * Inside DashboardLayout it renders as a hero panel (see PageHeaderVariantContext);
 * pass `variant` to override.
 */
export function PageHeader({ eyebrow, title, description, actions, meta, icon: Icon, variant, className }) {
  const contextVariant = useContext(PageHeaderVariantContext);
  const hero = (variant || contextVariant) === 'hero';

  const body = (
    <>
      <div className="relative min-w-0 space-y-2">
        {(eyebrow || Icon) && (
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent-text ring-1 ring-inset ring-accent/25">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          </div>
        )}
        <h1 className={cn('font-semibold tracking-tight text-fg', hero ? 'text-2xl sm:text-[2rem] sm:leading-tight' : 'text-2xl sm:text-3xl')}>
          {title}
        </h1>
        {description && <p className="max-w-prose text-sm text-fg-muted sm:text-base">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-sm text-fg-subtle">{meta}</div>}
      </div>
      {actions && <div className="relative flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </>
  );

  if (!hero) {
    return (
      <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
        {body}
      </header>
    );
  }

  return (
    <header
      className={cn(
        'surface-hero flex flex-col gap-5 rounded-2xl border border-line p-5 sm:flex-row sm:items-end sm:justify-between sm:p-8',
        className
      )}
    >
      <HeroOrbit />
      {body}
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
// illustration: search | calendar | upload | review | team | inbox | award —
// shows an original illustration instead of the icon tile.
export function EmptyState({ icon: Icon, illustration, title, description, action, titleAs: Title = 'p', className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {illustration && (
        <div className="relative isolate mb-5">
          {/* Soft background shapes so empty screens feel composed, not unfinished */}
          <span className="absolute left-1/2 top-1/2 -z-10 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line-strong/70" aria-hidden="true" />
          <span className="absolute left-1/2 top-1/2 -z-10 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 [background-image:radial-gradient(rgb(var(--line-strong)/0.9)_1px,transparent_1.5px)] [background-size:14px_14px] [mask-image:radial-gradient(closest-side,black,transparent)]" aria-hidden="true" />
          <EmptyIllustration variant={illustration} className="h-32 w-44" />
        </div>
      )}
      {!illustration && Icon && (
        <span className="relative mb-5 flex h-12 w-12 items-center justify-center">
          <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/30 to-accent-2/10 blur-md" aria-hidden="true" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-line-strong bg-surface-hi text-accent-text shadow-sm">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
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

/**
 * StatCard — a single real metric. Never use for invented numbers.
 * tone: accent | cyan | info | success | warning | danger (colours the icon
 * tile and a faint corner glow).
 */
export function StatCard({ label, value, hint, icon: Icon, tone = 'accent', className }) {
  const t = toneStyles[tone] || toneStyles.accent;
  return (
    <div
      className={cn('surface-card relative overflow-hidden rounded-xl border border-line p-4 sm:p-5', className)}
      style={{
        backgroundImage: `radial-gradient(16rem 7rem at 100% 0%, rgb(var(${t.rgb}) / calc(0.12 * var(--glow-strength))), transparent 70%), linear-gradient(180deg, rgb(var(--surface-hi)) 0%, rgb(var(--surface)) 70%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-fg-muted">{label}</p>
        {Icon && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', t.tile)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-fg sm:text-[1.75rem]">{value}</p>
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
    <div className={cn('surface-card relative overflow-x-auto rounded-xl border border-line', className)}>
      {children}
    </div>
  );
}
