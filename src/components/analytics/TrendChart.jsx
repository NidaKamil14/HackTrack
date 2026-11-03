import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../ui';
import { formatUtcDate } from './formatUtcDate';

/*
 * Single-series time chart (line or bars) in plain SVG.
 * - Hover / keyboard focus shows a tooltip for the nearest date.
 * - A table view is always available (no value is hover-only).
 * - Dates are UTC calendar dates and are formatted in UTC so buckets never shift.
 */


const nf = new Intl.NumberFormat();

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export default function TrendChart({ data, valueKey, label, kind = 'line', bucket = 'day', height = 200, className }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();

  const values = data.map((d) => d[valueKey] || 0);
  const max = niceMax(Math.max(0, ...values));
  const pad = { top: 12, right: 8, bottom: 26, left: 36 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const n = data.length;
  const band = n > 0 ? w / n : 0;
  const x = (i) => pad.left + band * i + band / 2;
  const y = (v) => pad.top + h - (v / max) * h;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 64))));
  const dateLabel = (d) => (bucket === 'week' ? `Week of ${formatUtcDate(d.date)}` : formatUtcDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' }));

  const pointerToIndex = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const px = evt.clientX - rect.left - pad.left;
    return Math.min(n - 1, Math.max(0, Math.floor(px / band)));
  };

  const onKeyDown = (evt) => {
    if (!n) return;
    if (evt.key === 'ArrowRight' || evt.key === 'ArrowLeft') {
      evt.preventDefault();
      const cur = active ?? (evt.key === 'ArrowRight' ? -1 : n);
      setActive(Math.min(n - 1, Math.max(0, cur + (evt.key === 'ArrowRight' ? 1 : -1))));
    } else if (evt.key === 'Home') setActive(0);
    else if (evt.key === 'End') setActive(n - 1);
    else if (evt.key === 'Escape') setActive(null);
  };

  const linePath = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPath = n ? `${linePath} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';
  const barW = Math.max(2, Math.min(28, band - 2));
  const activeDatum = active !== null ? data[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(x(active), 70), Math.max(70, width - 70)) : 0;

  return (
    <figure className={cn('space-y-2', className)} aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-3">
        <figcaption id={titleId} className="text-sm font-medium text-fg">{label}</figcaption>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="rounded-sm text-xs font-medium text-accent-text hover:underline"
          aria-expanded={showTable}
        >
          {showTable ? 'Show chart' : 'View as table'}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-hi text-left text-xs text-fg-muted">
              <tr><th className="px-3 py-2 font-medium">{bucket === 'week' ? 'Week starting (UTC)' : 'Date (UTC)'}</th><th className="px-3 py-2 text-right font-medium">{label}</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((d) => (
                <tr key={d.date}><td className="px-3 py-1.5 text-fg-muted">{formatUtcDate(d.date, { year: 'numeric', month: 'short', day: 'numeric' })}</td><td className="px-3 py-1.5 text-right tabular-nums text-fg">{nf.format(d[valueKey] || 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative" style={{ height }}>
          {width > 0 && (
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={`${label} over time. Use arrow keys to read values.`}
              tabIndex={0}
              className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onPointerMove={(e) => n && setActive(pointerToIndex(e))}
              onPointerLeave={() => setActive(null)}
              onKeyDown={onKeyDown}
              onBlur={() => setActive(null)}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeDasharray={t === 0 ? undefined : '2 4'} />
                  <text x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-[10px] tabular-nums">{nf.format(t)}</text>
                </g>
              ))}
              {data.map((d, i) => (i % labelEvery === 0 ? (
                <text key={d.date} x={x(i)} y={height - 8} textAnchor="middle" className="fill-fg-subtle text-[10px]">{formatUtcDate(d.date)}</text>
              ) : null))}

              {kind === 'bar' ? (
                values.map((v, i) => {
                  const top = y(v);
                  const hgt = Math.max(0, y(0) - top);
                  const r = Math.min(4, barW / 2, hgt);
                  return (
                    <path
                      key={data[i].date}
                      d={`M${x(i) - barW / 2},${y(0)} V${top + r} Q${x(i) - barW / 2},${top} ${x(i) - barW / 2 + r},${top} H${x(i) + barW / 2 - r} Q${x(i) + barW / 2},${top} ${x(i) + barW / 2},${top + r} V${y(0)} Z`}
                      fill="rgb(var(--accent))"
                      opacity={active === null || active === i ? 1 : 0.55}
                    />
                  );
                })
              ) : (
                <>
                  <path d={areaPath} fill="rgb(var(--accent) / 0.14)" />
                  <path d={linePath} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {n <= 31 && values.map((v, i) => (
                    <circle key={data[i].date} cx={x(i)} cy={y(v)} r={active === i ? 4.5 : 0} fill="rgb(var(--accent))" stroke="rgb(var(--surface))" strokeWidth="2" />
                  ))}
                </>
              )}

              {active !== null && (
                <line x1={x(active)} x2={x(active)} y1={pad.top} y2={y(0)} stroke="rgb(var(--fg-subtle))" strokeWidth="1" pointerEvents="none" />
              )}
              {kind !== 'bar' && active !== null && n > 31 && (
                <circle cx={x(active)} cy={y(values[active])} r="4.5" fill="rgb(var(--accent))" stroke="rgb(var(--surface))" strokeWidth="2" />
              )}
            </svg>
          )}
          {activeDatum && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line-strong bg-raised px-3 py-2 shadow-lg"
              style={{ left: tipLeft }}
              role="status"
            >
              <p className="text-sm font-semibold tabular-nums text-fg">{nf.format(activeDatum[valueKey] || 0)}</p>
              <p className="whitespace-nowrap text-xs text-fg-muted">{label} · {dateLabel(activeDatum)}</p>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
