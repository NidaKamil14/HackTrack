import React, { useId } from 'react';

/*
 * Landing-page hero illustration (original SVG): a perspective orbit with
 * glowing nodes, a floating code editor, a team cluster wired into a central
 * submission core, an AI chip and a trophy. Theme-aware via colour tokens and
 * purely decorative (aria-hidden). Sits behind the lifecycle panel.
 */
const c = {
  accent: 'rgb(var(--accent))',
  accentText: 'rgb(var(--accent-text))',
  cyan: 'rgb(var(--accent-2))',
  deep: 'rgb(var(--accent-deep))',
  line: 'rgb(var(--line-strong))',
  hi: 'rgb(var(--surface-hi))',
  surface: 'rgb(var(--surface))',
  fg: 'rgb(var(--fg))',
};

export default function HeroArtwork({ className }) {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name) => `ha-${name}-${raw}`;

  return (
    <svg viewBox="0 0 640 560" className={className} style={{ overflow: 'visible' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id('brand')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: c.accent }} />
          <stop offset="1" style={{ stopColor: c.cyan }} />
        </linearGradient>
        <linearGradient id={id('beam')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: c.accentText, stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: c.accentText, stopOpacity: 0 }} />
        </linearGradient>
        <radialGradient id={id('core')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: c.accent, stopOpacity: 0.55 }} />
          <stop offset="0.6" style={{ stopColor: c.accent, stopOpacity: 0.12 }} />
          <stop offset="1" style={{ stopColor: c.accent, stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={id('cyanGlow')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: c.cyan, stopOpacity: 0.35 }} />
          <stop offset="1" style={{ stopColor: c.cyan, stopOpacity: 0 }} />
        </radialGradient>
        <pattern id={id('floor')} width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="skewX(-35) scale(1 0.5)">
          <path d="M32 0H0V32" fill="none" stroke={c.line} strokeOpacity="0.5" />
        </pattern>
        <linearGradient id={id('floorFade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={id('floorMask')}>
          <rect x="0" y="330" width="640" height="230" fill={`url(#${id('floorFade')})`} />
        </mask>
      </defs>

      {/* atmosphere */}
      <ellipse cx="330" cy="290" rx="300" ry="250" fill={`url(#${id('core')})`} />
      <ellipse cx="520" cy="120" rx="160" ry="140" fill={`url(#${id('cyanGlow')})`} />

      {/* perspective floor grid */}
      <rect x="0" y="330" width="640" height="230" fill={`url(#${id('floor')})`} mask={`url(#${id('floorMask')})`} />

      {/* orbits */}
      <g fill="none">
        <ellipse cx="320" cy="300" rx="270" ry="92" stroke={c.line} strokeOpacity="0.8" />
        <ellipse cx="320" cy="300" rx="200" ry="66" stroke={`url(#${id('brand')})`} strokeOpacity="0.7" strokeDasharray="4 8" />
        <ellipse cx="320" cy="300" rx="130" ry="42" stroke={c.line} strokeOpacity="0.9" />
      </g>
      {[[588, 300, c.accentText, 4], [190, 357, c.accentText, 4], [470, 236, c.cyan, 4], [320, 208, c.accentText, 3]].map(([x, y, fill, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r * 3} fill={fill} opacity="0.15" />
          <circle cx={x} cy={y} r={r} fill={fill} />
        </g>
      ))}

      {/* central submission core with light beam */}
      <g transform="translate(320 300)">
        <path d="M0 -46 L40 -23 L40 23 L0 46 L-40 23 L-40 -23 Z" fill={c.hi} stroke={c.line} />
        <path d="M0 -30 L26 -15 L26 15 L0 30 L-26 15 L-26 -15 Z" fill={`url(#${id('brand')})`} opacity="0.95" />
        <path d="M-9 -2l7 7 13-14" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* floating code editor */}
      <g transform="translate(40 70) rotate(-4)">
        <rect width="210" height="132" rx="14" fill={c.hi} stroke={c.line} />
        <rect width="210" height="30" rx="14" fill={c.surface} />
        <rect y="16" width="210" height="14" fill={c.surface} />
        {[c.accentText, c.cyan, c.line].map((fill, i) => (
          <circle key={i} cx={18 + i * 14} cy="15" r="4" fill={fill} opacity={i === 2 ? 1 : 0.85} />
        ))}
        {[[56, 1], [120, 0], [90, 0], [140, 1], [70, 0], [104, 0]].map(([w, brand], i) => (
          <rect key={i} x={18 + (i % 3 === 1 ? 14 : 0)} y={44 + i * 13} width={w} height="6" rx="3" fill={brand ? `url(#${id('brand')})` : c.line} opacity={brand ? 1 : 0.85} />
        ))}
      </g>
      <path d="M210 205 C 250 260, 270 280, 280 290" stroke={`url(#${id('brand')})`} strokeWidth="2" fill="none" strokeDasharray="3 5" />

      {/* team cluster */}
      <g transform="translate(70 380)">
        {[[0, 30], [46, 0], [92, 30]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle cx="22" cy="22" r="22" fill={i === 1 ? `url(#${id('brand')})` : c.hi} stroke={c.line} />
            <circle cx="22" cy="17" r="7" fill={i === 1 ? 'white' : c.line} opacity={i === 1 ? 0.9 : 1} />
            <path d="M10 36a12 10 0 0 1 24 0" fill={i === 1 ? 'white' : c.line} opacity={i === 1 ? 0.9 : 1} />
          </g>
        ))}
      </g>
      <path d="M180 395 C 230 370, 260 340, 285 322" stroke={c.line} strokeWidth="1.5" fill="none" strokeDasharray="3 5" />

      {/* AI chip */}
      <g transform="translate(470 360)">
        {[0, 1, 2, 3].map((i) => (
          <g key={i} stroke={c.line} strokeWidth="2">
            <line x1={14 + i * 14} y1="-8" x2={14 + i * 14} y2="0" />
            <line x1={14 + i * 14} y1="64" x2={14 + i * 14} y2="72" />
            <line x1="-8" y1={14 + i * 14} x2="0" y2={14 + i * 14} />
            <line x1="64" y1={14 + i * 14} x2="72" y2={14 + i * 14} />
          </g>
        ))}
        <rect width="64" height="64" rx="12" fill={c.hi} stroke={c.line} />
        <rect x="14" y="14" width="36" height="36" rx="7" fill={`url(#${id('brand')})`} />
        <text x="32" y="38" textAnchor="middle" fontSize="15" fontWeight="700" fill="white" fontFamily="Geist, sans-serif">AI</text>
      </g>
      <path d="M468 380 C 420 360, 390 340, 362 320" stroke={c.line} strokeWidth="1.5" fill="none" strokeDasharray="3 5" />

      {/* trophy */}
      <g transform="translate(470 70)">
        <circle cx="50" cy="50" r="50" fill={c.hi} stroke={c.line} />
        <path d="M32 30h36v12a18 18 0 0 1-36 0z" fill={`url(#${id('brand')})`} />
        <path d="M32 34h-8a8 8 0 0 0 8 12M68 34h8a8 8 0 0 1-8 12" stroke={c.line} strokeWidth="3" fill="none" />
        <rect x="45" y="58" width="10" height="10" fill={c.line} />
        <rect x="36" y="68" width="28" height="7" rx="2" fill={c.line} />
      </g>
      <path d="M500 168 C 470 220, 400 260, 362 282" stroke={`url(#${id('brand')})`} strokeWidth="2" fill="none" strokeDasharray="3 5" />
    </svg>
  );
}
