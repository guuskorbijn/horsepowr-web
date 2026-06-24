import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Empty states invite action — they don't sit empty (design-system voice). */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-3 text-text-tertiary">{icon}</div> : null}
      <h3 className="font-display text-[18px] font-medium text-text-primary">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-[14px] text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-text-secondary">
      <Loader2 size={18} className="animate-spin" aria-hidden />
      <span className="text-[14px]">{label}</span>
    </div>
  );
}

/** Calm under failure: explain what happened and the next step, no apology. */
export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-surface px-6 py-14 text-center">
      <AlertTriangle size={24} className="mb-3 text-danger" aria-hidden />
      <h3 className="font-display text-[18px] font-medium text-text-primary">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-[14px] text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-muted', className)}
      aria-hidden
    />
  );
}
