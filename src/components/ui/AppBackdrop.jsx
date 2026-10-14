import React from 'react';

/**
 * The decorative layer behind every page. One component, four page-type
 * variants that share a visual language but differ in intensity:
 *   landing   — bold: three drifting light orbs, line grid, rotating orbit art
 *   discover  — atmospheric: dot-matrix texture, two orbs, isometric line art
 *   auth      — centred spotlight with concentric rings + constellation
 *   dashboard — restrained: corner glows, one slow orb, faint top grid
 * Purely presentational: fixed, pointer-events none, behind all content.
 * Motion is transform-only and is frozen by prefers-reduced-motion (index.css).
 * Styles live in index.css under "App backdrop".
 */

function OrbitArt({ className }) {
  return (
    <svg viewBox="0 0 600 600" className={className} fill="none" aria-hidden="true" focusable="false">
      <g className="bd-spin-slow" style={{ transformOrigin: '300px 300px' }}>
        <circle cx="300" cy="300" r="290" stroke="rgb(var(--line-strong))" strokeOpacity="0.55" strokeDasharray="2 10" />
        <circle cx="300" cy="300" r="230" stroke="rgb(var(--accent-text))" strokeOpacity="0.28" />
        <circle cx="530" cy="300" r="6" fill="rgb(var(--accent-2))" fillOpacity="0.8" />
        <circle cx="300" cy="70" r="4" fill="rgb(var(--accent-text))" fillOpacity="0.8" />
      </g>
      <g className="bd-spin-reverse" style={{ transformOrigin: '300px 300px' }}>
        <circle cx="300" cy="300" r="170" stroke="rgb(var(--line-strong))" strokeOpacity="0.6" strokeDasharray="1 6" />
        <circle cx="300" cy="300" r="110" stroke="rgb(var(--accent-2))" strokeOpacity="0.25" />
        <circle cx="190" cy="300" r="4" fill="rgb(var(--accent-2))" fillOpacity="0.8" />
        <circle cx="300" cy="410" r="3" fill="rgb(var(--accent-text))" fillOpacity="0.7" />
      </g>
    </svg>
  );
}

function IsometricArt({ className }) {
  // A faint isometric lattice — evokes stacked platforms / projects.
  const rows = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 600 400" className={className} fill="none" aria-hidden="true" focusable="false">
      <g stroke="rgb(var(--line-strong))" strokeOpacity="0.5">
        {rows.map((i) => (
          <path key={`a${i}`} d={`M${-100 + i * 120} 400 L${200 + i * 120} 0`} />
        ))}
        {rows.map((i) => (
          <path key={`b${i}`} d={`M${700 - i * 120} 400 L${400 - i * 120} 0`} />
        ))}
      </g>
      <g className="bd-float-y">
        <path d="M300 120 l70 40 -70 40 -70 -40z" fill="rgb(var(--accent) / 0.18)" stroke="rgb(var(--accent-text))" strokeOpacity="0.45" />
        <path d="M300 150 l70 40 -70 40 -70 -40z" fill="rgb(var(--accent-2) / 0.08)" stroke="rgb(var(--accent-2))" strokeOpacity="0.3" />
      </g>
    </svg>
  );
}

function ConstellationArt({ className }) {
  const pts = [[60, 120], [180, 60], [300, 140], [420, 80], [540, 160], [470, 300], [330, 360], [200, 300], [90, 380]];
  return (
    <svg viewBox="0 0 600 440" className={className} fill="none" aria-hidden="true" focusable="false">
      <g stroke="rgb(var(--line-strong))" strokeOpacity="0.7">
        {pts.slice(1).map(([x, y], i) => (
          <line key={i} x1={pts[i][0]} y1={pts[i][1]} x2={x} y2={y} />
        ))}
        <line x1="300" y1="140" x2="330" y2="360" />
      </g>
      {pts.map(([x, y], i) => (
        <g key={i} className={i % 3 === 0 ? 'bd-twinkle' : undefined} style={{ animationDelay: `${i * 0.7}s` }}>
          <circle cx={x} cy={y} r={i % 3 === 0 ? 10 : 6} fill="rgb(var(--accent) / 0.15)" />
          <circle cx={x} cy={y} r={i % 3 === 0 ? 3.5 : 2.5} fill={i % 2 ? 'rgb(var(--accent-2))' : 'rgb(var(--accent-text))'} />
        </g>
      ))}
    </svg>
  );
}

export function AppBackdrop({ variant = 'discover' }) {
  return (
    <div className={`app-backdrop app-backdrop--${variant}`} aria-hidden="true">
      <span className="bd-orb bd-orb--1" />
      <span className="bd-orb bd-orb--2" />
      {variant !== 'dashboard' && <span className="bd-orb bd-orb--3" />}

      {variant === 'landing' && <OrbitArt className="bd-art bd-art--orbit" />}
      {variant === 'discover' && <IsometricArt className="bd-art bd-art--iso" />}
      {variant === 'auth' && (
        <>
          <OrbitArt className="bd-art bd-art--auth-orbit" />
          <ConstellationArt className="bd-art bd-art--constellation" />
        </>
      )}
      {variant === 'dashboard' && <OrbitArt className="bd-art bd-art--corner" />}
    </div>
  );
}
