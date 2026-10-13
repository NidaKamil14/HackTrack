import { cn } from './cn';

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
  '[&_svg]:shrink-0';

const variants = {
  primary: 'bg-accent text-accent-fg shadow-sm hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-fg shadow-sm hover:border-line-strong hover:bg-raised',
  ghost: 'text-fg-muted hover:bg-raised hover:text-fg',
  danger: 'bg-danger-solid text-white shadow-sm hover:bg-danger-solid/90',
  'danger-ghost': 'text-danger hover:bg-danger/10',
  link: 'h-auto px-0 text-accent-text underline-offset-4 hover:underline max-sm:min-h-10 touch:min-h-10',
};

const sizes = {
  sm: 'h-8 px-3 text-xs max-sm:h-10 max-sm:px-3.5 max-sm:text-sm touch:h-10 [&_svg]:h-3.5 [&_svg]:w-3.5',
  md: 'h-9 px-4 text-sm max-sm:h-10 touch:h-10 [&_svg]:h-4 [&_svg]:w-4',
  lg: 'h-11 px-5 text-sm [&_svg]:h-4 [&_svg]:w-4',
  icon: 'h-9 w-9 shrink-0 max-sm:h-10 max-sm:w-10 touch:h-10 touch:w-10 [&_svg]:h-4 [&_svg]:w-4',
  'icon-sm': 'h-8 w-8 shrink-0 max-sm:h-10 max-sm:w-10 touch:h-10 touch:w-10 [&_svg]:h-4 [&_svg]:w-4',
};

export function buttonClasses({ variant = 'primary', size = 'md', className } = {}) {
  return cn(base, variants[variant], variant !== 'link' && sizes[size], className);
}
