import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  // Blue fill, white text — the default action.
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover disabled:bg-surface-muted disabled:text-text-tertiary',
  // Transparent, bordered, ink text.
  secondary:
    'bg-transparent text-text-primary border border-line-strong hover:bg-surface-muted disabled:text-text-tertiary',
  // Coral fill — reserve for the single most important action on a screen.
  accent:
    'bg-accent text-on-accent hover:opacity-90 disabled:bg-surface-muted disabled:text-text-tertiary',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary',
  danger: 'bg-danger text-white hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] rounded-md gap-1.5',
  md: 'h-[44px] px-4 text-[15px] rounded-md gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
