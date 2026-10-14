import React, { useEffect, useRef } from 'react';
import { cn } from '../ui';

/*
 * A restrained particle field: a few dozen slow points joined by faint lines
 * when they're close. Canvas is used because per-frame line drawing between
 * moving points isn't practical in CSS.
 * Performance & accessibility:
 *  - pauses when off-screen (IntersectionObserver) or the tab is hidden
 *  - draws one static frame when prefers-reduced-motion is set
 *  - DPR-aware, resizes with its container, colours read from theme tokens
 *  - decorative: aria-hidden, pointer-events none
 */
export default function ParticleField({ className, density = 0.00006, maxPoints = 46 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let points = [];
    let frame = 0;
    let visible = true;
    let colors = { dot: '168 155 255', alt: '34 211 238', line: '168 155 255' };

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const accent = cs.getPropertyValue('--accent-text').trim() || colors.dot;
      const cyan = cs.getPropertyValue('--accent-2').trim() || colors.alt;
      colors = { dot: accent, alt: cyan, line: accent };
    };

    const seed = () => {
      const count = Math.min(maxPoints, Math.max(14, Math.round(width * height * density)));
      points = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.4 + 0.8,
        alt: i % 4 === 0,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readColors();
      seed();
      draw();
    };

    const linkDistance = 130;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        for (let j = i + 1; j < points.length; j += 1) {
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDistance) {
            ctx.strokeStyle = `rgb(${colors.line} / ${(1 - dist / linkDistance) * 0.22})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const p of points) {
        ctx.fillStyle = `rgb(${p.alt ? colors.alt : colors.dot} / 0.8)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      for (const p of points) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      }
      draw();
      frame = requestAnimationFrame(loop);
    };
    const loop = () => {
      if (!visible || document.hidden) {
        frame = 0;
        return;
      }
      step();
    };
    const start = () => {
      if (!reduceMotion && !frame && visible && !document.hidden) frame = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    });
    io.observe(canvas);
    const onVisibility = () => start();
    document.addEventListener('visibilitychange', onVisibility);
    // Re-read colours when the theme class on <html> changes.
    const mo = new MutationObserver(() => { readColors(); draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    start();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [density, maxPoints]);

  return <canvas ref={canvasRef} className={cn('pointer-events-none', className)} aria-hidden="true" />;
}
