import React, { useId } from 'react';

/*
 * Small original illustrations for empty states (160×120). Theme-aware via
 * colour tokens; decorative (aria-hidden) because the empty state's title and
 * description carry the meaning.
 * variants: search | calendar | upload | review | team | inbox | award
 */

const c = {
  accent: 'rgb(var(--accent))',
  accentText: 'rgb(var(--accent-text))',
  cyan: 'rgb(var(--accent-2))',
  line: 'rgb(var(--line-strong))',
  hi: 'rgb(var(--surface-hi))',
  raised: 'rgb(var(--raised))',
  success: 'rgb(var(--success))',
};

function Card({ x, y, w, h, r = 8, children }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={r} fill={c.hi} stroke={c.line} />
      {children}
    </g>
  );
}

const Lines = ({ x = 10, y = 12, widths, g }) =>
  widths.map((w, i) => (
    <rect key={i} x={x} y={y + i * 9} width={w} height="4" rx="2" fill={i === 0 ? `url(#${g})` : c.line} opacity={i === 0 ? 1 : 0.8} />
  ));

const SCENES = {
  search: (g) => (
    <>
      <Card x={30} y={34} w={70} h={52}><Lines widths={[38, 50, 30]} g={g} /></Card>
      <Card x={44} y={24} w={70} h={52}><Lines widths={[30, 46, 36]} g={g} /></Card>
      <circle cx="108" cy="74" r="20" fill={c.raised} stroke={`url(#${g})`} strokeWidth="4" />
      <path d="M122 88l14 14" stroke={`url(#${g})`} strokeWidth="6" strokeLinecap="round" />
      <path d="M100 70h16M100 78h10" stroke={c.line} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  calendar: (g) => (
    <>
      <Card x={42} y={26} w={76} h={70}>
        <rect width="76" height="18" rx="8" fill={`url(#${g})`} />
        <rect y="10" width="76" height="8" fill={`url(#${g})`} />
        {[0, 1, 2].map((r) =>
          [0, 1, 2, 3].map((col) => (
            <rect key={`${r}${col}`} x={9 + col * 16} y={26 + r * 13} width="10" height="8" rx="2" fill={r === 1 && col === 2 ? c.cyan : c.line} opacity={r === 1 && col === 2 ? 0.9 : 0.6} />
          ))
        )}
      </Card>
      <path d="M54 20v12M106 20v12" stroke={c.line} strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  upload: (g) => (
    <>
      <path d="M36 44h30l8 8h50v44a6 6 0 0 1-6 6H42a6 6 0 0 1-6-6z" fill={c.hi} stroke={c.line} />
      <path d="M36 58h88" stroke={c.line} />
      <circle cx="80" cy="78" r="14" fill={`url(#${g})`} />
      <path d="M80 85V71m-6 6l6-6 6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  review: (g) => (
    <>
      <Card x={46} y={22} w={68} h={82}>
        <rect x="22" y="-6" width="24" height="12" rx="4" fill={c.raised} stroke={c.line} />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(10 ${18 + i * 20})`}>
            <rect width="12" height="12" rx="3" fill={i < 2 ? `url(#${g})` : 'none'} stroke={i < 2 ? 'none' : c.line} />
            {i < 2 && <path d="M3 6l2 2 4-4" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />}
            <rect x="18" y="4" width={30 - i * 6} height="4" rx="2" fill={c.line} />
          </g>
        ))}
      </Card>
    </>
  ),
  team: (g) => (
    <>
      {[[54, 62, c.line], [106, 62, c.line], [80, 54, `url(#${g})`]].map(([x, y, fill], i) => (
        <g key={i}>
          <circle cx={x} cy={y - 14} r="11" fill={i === 2 ? fill : c.hi} stroke={c.line} />
          <path d={`M${x - 18} ${y + 22}a18 16 0 0 1 36 0z`} fill={i === 2 ? fill : c.hi} stroke={c.line} />
        </g>
      ))}
      <path d="M66 96h28" stroke={c.cyan} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    </>
  ),
  inbox: (g) => (
    <>
      <path d="M40 66l12-30h56l12 30v26a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6z" fill={c.hi} stroke={c.line} />
      <path d="M40 66h26l4 10h20l4-10h26" fill="none" stroke={c.line} />
      <circle cx="112" cy="40" r="9" fill={`url(#${g})`} />
      <path d="M62 50h36M66 58h28" stroke={c.line} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  award: (g) => (
    <>
      <path d="M68 70l-10 34 14-7 8 12 6-33M92 70l10 34-14-7-8 12-6-33" fill={c.raised} stroke={c.line} />
      <circle cx="80" cy="54" r="26" fill={`url(#${g})`} />
      <circle cx="80" cy="54" r="17" fill="none" stroke="white" strokeOpacity="0.6" strokeDasharray="3 3" />
      <path d="M73 54l5 5 9-10" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export default function EmptyIllustration({ variant = 'search', className }) {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const g = `ei-g-${raw}`;
  const glow = `ei-r-${raw}`;
  const scene = SCENES[variant] || SCENES.search;
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: c.accent }} />
          <stop offset="1" style={{ stopColor: c.cyan }} />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: c.accent, stopOpacity: 0.3 }} />
          <stop offset="1" style={{ stopColor: c.accent, stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <ellipse cx="80" cy="64" rx="76" ry="56" fill={`url(#${glow})`} />
      <ellipse cx="80" cy="110" rx="50" ry="5" fill={c.line} opacity="0.35" />
      {[[18, 30], [140, 26], [134, 92], [24, 96]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 ? 2 : 3} fill={i % 2 ? c.cyan : c.accentText} opacity="0.7" />
      ))}
      {scene(g)}
    </svg>
  );
}
