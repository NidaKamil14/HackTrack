import React, { useId, useState } from 'react';
import { cn } from '../ui';

/*
 * Generated cover art for a hackathon. The motif comes from the event's real
 * category (Full-Stack / AI & ML / IoT / other) and is varied deterministically
 * by its id, so every event gets a distinct but stable banner without any
 * invented content. If the data ever carries a cover image URL it is shown
 * instead, falling back to the artwork if it fails to load.
 * Decorative only: the event title/category are always rendered as text nearby.
 */

function hash(text = '') {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const tokens = {
  accent: 'rgb(var(--accent))',
  accentText: 'rgb(var(--accent-text))',
  cyan: 'rgb(var(--accent-2))',
  deep: 'rgb(var(--accent-deep))',
  line: 'rgb(var(--line-strong))',
  surface: 'rgb(var(--surface))',
  hi: 'rgb(var(--surface-hi))',
};

function motifFor(category = '') {
  const c = category.toLowerCase();
  if (c.includes('ai') || c.includes('ml')) return 'neural';
  if (c.includes('iot') || c.includes('hardware')) return 'circuit';
  if (c.includes('stack') || c.includes('web')) return 'stack';
  return 'constellation';
}

/* ---- motifs (drawn in a 400×160 box) ---------------------------------- */

function StackMotif({ seed, ids }) {
  const x = 230 + (seed % 40);
  return (
    <g>
      {/* code window */}
      <g transform={`translate(${36 + (seed % 18)} 30)`}>
        <rect width="150" height="96" rx="10" fill={tokens.hi} stroke={tokens.line} />
        <circle cx="14" cy="13" r="3" fill={tokens.accentText} opacity="0.8" />
        <circle cx="25" cy="13" r="3" fill={tokens.cyan} opacity="0.6" />
        <circle cx="36" cy="13" r="3" fill={tokens.line} />
        <line x1="0" y1="26" x2="150" y2="26" stroke={tokens.line} />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={14 + (i % 2) * 12}
            y={36 + i * 11}
            width={40 + ((seed >> i) % 70)}
            height="5"
            rx="2.5"
            fill={i % 3 === 0 ? `url(#${ids.grad})` : tokens.line}
            opacity={i % 3 === 0 ? 0.95 : 0.8}
          />
        ))}
      </g>
      {/* isometric layered stack */}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${x} ${92 - i * 20} l46 -18 l46 18 l-46 18 z`}
          fill={i === 2 ? `url(#${ids.grad})` : tokens.hi}
          stroke={i === 2 ? 'none' : tokens.line}
          opacity={i === 2 ? 0.9 : 1}
        />
      ))}
      <path d={`M${x + 46} ${110} v16`} stroke={tokens.line} strokeDasharray="2 3" />
    </g>
  );
}

function NeuralMotif({ seed, ids }) {
  const layers = [3, 5, 4, 2];
  const nodes = layers.map((count, li) =>
    Array.from({ length: count }, (_, ni) => ({
      x: 70 + li * 90 + ((seed >> li) % 10),
      y: 80 + (ni - (count - 1) / 2) * 26,
    }))
  );
  return (
    <g>
      {nodes.slice(0, -1).map((layer, li) =>
        layer.map((a) =>
          nodes[li + 1].map((b, bi) => (
            <line
              key={`${li}-${a.y}-${bi}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={(bi + li + seed) % 4 === 0 ? tokens.cyan : tokens.line}
              strokeOpacity={(bi + li + seed) % 4 === 0 ? 0.7 : 0.6}
            />
          ))
        )
      )}
      {nodes.flat().map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="9" fill={tokens.accent} opacity={(i + seed) % 3 === 0 ? 0.25 : 0} />
          <circle cx={n.x} cy={n.y} r="5" fill={(i + seed) % 3 === 0 ? `url(#${ids.grad})` : tokens.hi} stroke={tokens.line} />
        </g>
      ))}
    </g>
  );
}

function CircuitMotif({ seed, ids }) {
  const cx = 200 + ((seed % 60) - 30);
  return (
    <g>
      {[38, 58, 78].map((r, i) => (
        <circle key={r} cx={cx} cy="80" r={r} fill="none" stroke={i === 1 ? tokens.cyan : tokens.line} strokeOpacity={i === 1 ? 0.5 : 0.7} strokeDasharray={i === 2 ? '3 5' : undefined} />
      ))}
      {[-1, 1].map((dir) =>
        [0, 1, 2].map((i) => (
          <path
            key={`${dir}-${i}`}
            d={`M${cx + dir * 24} ${68 + i * 12} h${dir * (50 + i * 22)} l${dir * 14} ${i % 2 ? 14 : -14} h${dir * 40}`}
            fill="none"
            stroke={i === 1 ? `url(#${ids.grad})` : tokens.line}
            strokeWidth="1.5"
          />
        ))
      )}
      <rect x={cx - 24} y="56" width="48" height="48" rx="8" fill={tokens.hi} stroke={tokens.line} />
      <rect x={cx - 13} y="67" width="26" height="26" rx="4" fill={`url(#${ids.grad})`} />
      {[-1, 1].map((dir) =>
        [0, 1, 2].map((i) => (
          <circle key={`d${dir}${i}`} cx={cx + dir * (24 + 50 + i * 22 + 14 + 40)} cy={68 + i * 12 + (i % 2 ? 14 : -14)} r="3" fill={i === 1 ? tokens.cyan : tokens.accentText} />
        ))
      )}
    </g>
  );
}

function ConstellationMotif({ seed, ids }) {
  const pts = Array.from({ length: 9 }, (_, i) => ({
    x: 40 + ((seed >> (i * 2)) % 320),
    y: 24 + ((seed >> (i + 3)) % 112),
  }));
  return (
    <g>
      {pts.slice(1).map((p, i) => (
        <line key={i} x1={pts[i].x} y1={pts[i].y} x2={p.x} y2={p.y} stroke={tokens.line} strokeOpacity="0.8" />
      ))}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i % 3 === 0 ? 5 : 3} fill={i % 3 === 0 ? `url(#${ids.grad})` : tokens.accentText} opacity={i % 3 === 0 ? 1 : 0.7} />
      ))}
    </g>
  );
}

const MOTIFS = { stack: StackMotif, neural: NeuralMotif, circuit: CircuitMotif, constellation: ConstellationMotif };

// wide: for full-width banners (e.g. the event page) — keeps the motif at its
// natural scale in the centre and lets the grid/glow span the full width.
export default function EventCover({ hackathon, className, muted = false, wide = false }) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const ids = { grad: `ec-g-${uid}`, glow: `ec-r-${uid}`, grid: `ec-p-${uid}` };
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl = hackathon?.coverImage || hackathon?.bannerUrl;
  const seed = hash(hackathon?.id || hackathon?.title);
  const Motif = MOTIFS[motifFor(hackathon?.category)];
  const glowX = 60 + (seed % 280);
  const W = wide ? 1000 : 400;
  const H = wide ? 200 : 160;

  return (
    <div className={cn('relative overflow-hidden bg-sunken', className)} aria-hidden="true">
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={cn('h-full w-full', muted && 'opacity-60 grayscale')}>
          <defs>
            <linearGradient id={ids.grad} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: tokens.accentText }} />
              <stop offset="1" style={{ stopColor: tokens.cyan }} />
            </linearGradient>
            <radialGradient id={ids.glow} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" style={{ stopColor: seed % 2 ? tokens.accent : tokens.cyan, stopOpacity: 0.45 }} />
              <stop offset="1" style={{ stopColor: tokens.accent, stopOpacity: 0 }} />
            </radialGradient>
            <pattern id={ids.grid} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke={tokens.line} strokeOpacity="0.5" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill={tokens.surface} />
          <rect width={W} height={H} fill={`url(#${ids.grid})`} />
          <ellipse cx={wide ? 300 + glowX : glowX} cy="40" rx={wide ? 420 : 190} ry="140" fill={`url(#${ids.glow})`} />
          {wide && <ellipse cx={W - glowX} cy={H} rx="300" ry="120" fill={`url(#${ids.glow})`} opacity="0.6" />}
          <g transform={wide ? `translate(${(W - 400) / 2} 20)` : undefined}>
            <Motif seed={seed} ids={ids} />
          </g>
          {/* fade into the content below */}
          <rect y={H - 50} width={W} height="50" fill={tokens.surface} opacity="0.35" />
        </svg>
      )}
    </div>
  );
}
