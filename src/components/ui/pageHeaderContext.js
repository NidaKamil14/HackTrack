import { createContext } from 'react';

// DashboardLayout provides "hero" so every dashboard's PageHeader renders as a
// hero panel without each dashboard opting in. Public pages default to "plain".
export const PageHeaderVariantContext = createContext('plain');

// Static class maps (Tailwind needs full class names at build time).
export const toneStyles = {
  accent: { tile: 'bg-accent/15 text-accent-text ring-accent/25', rgb: '--accent' },
  cyan: { tile: 'bg-accent-2/10 text-accent-2 ring-accent-2/25', rgb: '--accent-2' },
  info: { tile: 'bg-info/10 text-info ring-info/25', rgb: '--info' },
  success: { tile: 'bg-success/10 text-success ring-success/25', rgb: '--success' },
  warning: { tile: 'bg-warning/10 text-warning ring-warning/25', rgb: '--warning' },
  danger: { tile: 'bg-danger/10 text-danger ring-danger/25', rgb: '--danger' },
};
