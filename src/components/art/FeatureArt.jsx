import React, { useId } from 'react';

/*
 * Illustrations for the landing-page feature showcase (360×240, original SVG).
 * variants: teams | screening | judging. Abstract by design — no numbers,
 * names or codes, so nothing reads as real application data.
 */
const c = {
  accent: 'rgb(var(--accent))',
  accentText: 'rgb(var(--accent-text))',
  cyan: 'rgb(var(--accent-2))',
  line: 'rgb(var(--line-strong))',
  hi: 'rgb(var(--surface-hi))',
  surface: 'rgb(var(--surface))',
  success: 'rgb(var(--success))',
  danger: 'rgb(var(--danger))',
};

function Panel({ x, y, w, h, children }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="14" fill={c.hi} stroke={c.line} />
      {children}
    </g>
  );
}

function Teams({ g }) {
  return (
    <>
      {/* invite code chip */}
      <Panel x={110} y={30} w={140} h={54}>
        <rect x="14" y="14" width="26" height="26" rx="7" fill={`url(#${g})`} />
        <path d="M22 27a5 5 0 1 1 8 4l6 6" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={52 + i * 20} y="22" width="14" height="10" rx="3" fill={i === 1 ? c.cyan : c.line} opacity={i === 1 ? 0.8 : 0.9} />
        ))}
      </Panel>
      {/* members joining */}
      {[[50, 160], [140, 176], [230, 176], [310, 160]].map(([x, y], i) => (
        <g key={i}>
          <path d={`M180 84 C 180 120, ${x} 120, ${x} ${y - 24}`} stroke={i === 1 ? `url(#${g})` : c.line} strokeWidth="1.5" fill="none" strokeDasharray="3 5" />
          <circle cx={x} cy={y} r="22" fill={i === 1 ? `url(#${g})` : c.hi} stroke={c.line} />
          <circle cx={x} cy={y - 5} r="7" fill={i === 1 ? 'white' : c.line} />
          <path d={`M${x - 12} ${y + 13}a12 10 0 0 1 24 0`} fill={i === 1 ? 'white' : c.line} />
        </g>
      ))}
    </>
  );
}

function Screening({ g }) {
  return (
    <>
      <Panel x={60} y={30} w={170} h={180}>
        <rect x="18" y="18" width="80" height="8" rx="4" fill={`url(#${g})`} />
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(18 ${46 + i * 32})`}>
            <rect width="20" height="20" rx="6" fill={i < 3 ? c.success : c.hi} fillOpacity={i < 3 ? 0.18 : 1} stroke={i < 3 ? c.success : c.danger} strokeOpacity="0.6" />
            {i < 3 ? (
              <path d="M5 10l4 4 7-8" stroke={c.success} strokeWidth="2.2" fill="none" strokeLinecap="round" />
            ) : (
              <path d="M6 6l8 8M14 6l-8 8" stroke={c.danger} strokeWidth="2.2" strokeLinecap="round" />
            )}
            <rect x="32" y="6" width={90 - i * 12} height="8" rx="4" fill={c.line} />
          </g>
        ))}
      </Panel>
      {/* shield */}
      <g transform="translate(232 70)">
        <circle cx="38" cy="50" r="58" fill={c.accent} opacity="0.12" />
        <path d="M38 0 L76 14 V48 C76 74 58 92 38 100 C18 92 0 74 0 48 V14 Z" fill={`url(#${g})`} />
        <path d="M22 50l11 11 22-24" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  );
}

function Judging({ g }) {
  return (
    <>
      <Panel x={40} y={34} w={190} h={172}>
        {[0.82, 0.64, 0.9, 0.5].map((v, i) => (
          <g key={i} transform={`translate(18 ${24 + i * 36})`}>
            <rect width="70" height="7" rx="3.5" fill={c.line} />
            <rect y="14" width="154" height="8" rx="4" fill={c.line} opacity="0.5" />
            <rect y="14" width={154 * v} height="8" rx="4" fill={`url(#${g})`} />
          </g>
        ))}
      </Panel>
      {/* score ring */}
      <g transform="translate(262 120)">
        <circle r="52" fill={c.hi} stroke={c.line} />
        <circle r="40" fill="none" stroke={c.line} strokeWidth="9" opacity="0.6" />
        <circle r="40" fill="none" stroke={`url(#${g})`} strokeWidth="9" strokeLinecap="round" strokeDasharray="190 252" transform="rotate(-90)" />
        <path d="M-12 2l8 8 16-18" stroke={c.accentText} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  );
}

const VARIANTS = { teams: Teams, screening: Screening, judging: Judging };

export default function FeatureArt({ variant = 'teams', className }) {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const g = `fa-g-${raw}`;
  const glow = `fa-r-${raw}`;
  const grid = `fa-p-${raw}`;
  const Scene = VARIANTS[variant] || Teams;
  return (
    <svg viewBox="0 0 360 240" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: c.accent }} />
          <stop offset="1" style={{ stopColor: c.cyan }} />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" style={{ stopColor: c.accent, stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: c.accent, stopOpacity: 0 }} />
        </radialGradient>
        <pattern id={grid} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke={c.line} strokeOpacity="0.35" />
        </pattern>
      </defs>
      <rect width="360" height="240" fill={`url(#${grid})`} />
      <rect width="360" height="240" fill={`url(#${glow})`} />
      <Scene g={g} />
    </svg>
  );
}
