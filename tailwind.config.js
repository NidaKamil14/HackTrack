import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */

// Design tokens live as CSS variables in src/index.css (dark + light).
// This file only maps them to Tailwind class names.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // Type scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 (Tailwind defaults)
      // plus a tightened display size. Nothing below 12px.
      fontSize: {
        display: ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.035em', fontWeight: '600' }],
      },
      colors: {
        canvas: token('canvas'),
        surface: {
          DEFAULT: token('surface'),
          hi: token('surface-hi'),
        },
        raised: token('raised'),
        sunken: token('sunken'),
        overlay: token('overlay'),
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
        },
        fg: {
          DEFAULT: token('fg'),
          muted: token('fg-muted'),
          subtle: token('fg-subtle'),
        },
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          fg: token('accent-fg'),
          text: token('accent-text'),
          deep: token('accent-deep'),
          2: token('accent-2'),
        },
        success: token('success'),
        warning: token('warning'),
        danger: {
          DEFAULT: token('danger'),
          solid: token('danger-solid'),
        },
        info: token('info'),
        ring: token('ring'),
      },
      maxWidth: {
        page: '76rem',   // 1216px — standard page container
        prose: '42rem',  // long-form text
      },
      borderRadius: {
        // sm 2px · md 6px · lg 8px (controls) · xl 12px (cards) · 2xl 16px (dialogs)
        DEFAULT: '0.375rem',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: 'var(--shadow-glow)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'dialog-in': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'dialog-in': 'dialog-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        rise: 'rise 420ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
      },
    },
  },
  plugins: [
    // `touch:` targets touchscreens (phones, tablets) regardless of width,
    // used to enlarge hit areas without bloating the desktop UI.
    plugin(({ addVariant }) => {
      addVariant('touch', '@media (pointer: coarse)');
    }),
  ],
}
