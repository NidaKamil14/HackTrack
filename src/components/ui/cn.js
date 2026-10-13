import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge about our custom font size so `text-display` is not
// mistaken for a text colour (and dropped when combined with `text-fg`).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display'] }],
      'max-w': [{ 'max-w': ['page', 'prose'] }],
    },
  },
});

// Merge conditional class names; later Tailwind classes win over earlier ones.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
