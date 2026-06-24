import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type PillTone = 'info' | 'muted' | 'success' | 'warning';

const TONES: Record<PillTone, string> = {
  info: 'bg-[var(--pill-info-bg)] text-[var(--pill-info-text)]',
  muted: 'bg-[var(--pill-muted-bg)] text-[var(--pill-muted-text)]',
  success: 'bg-[var(--pill-success-bg)] text-[var(--pill-success-text)]',
  warning: 'bg-[var(--pill-warning-bg)] text-[var(--pill-warning-text)]',
};

/** Muted brand/semantic background + same-family dark text. Colour is never the
 *  only signal — the label carries the meaning. */
export function StatusPill({
  tone = 'muted',
  children,
  icon,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[12px] font-medium',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
