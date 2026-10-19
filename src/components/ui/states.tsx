import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BrandLoader } from '@/components/brand/BrandLoader';

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
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-text-secondary">
      <BrandLoader width={88} className="text-primary" label={label} />
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

/**
 * A horse card's shape, for the command center while it loads.
 *
 * Matching the real card's rhythm is the entire point: a skeleton that does not
 * match what follows makes the arrival worse, not better.
 */
export function SkeletonHorseCard() {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-md bg-surface-muted p-3">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  );
}

/** A grid of them, for a page that has not resolved yet. */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="progressbar"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonHorseCard key={i} />
      ))}
    </div>
  );
}

/** A week of empty day columns, for the agenda. */
export function SkeletonWeek() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7"
      role="progressbar"
      aria-label="Loading"
    >
      {Array.from({ length: 7 }, (_, day) => (
        <div key={day} className="space-y-2">
          <Skeleton className="h-6 w-16" />
          {Array.from({ length: 2 }, (_, row) => (
            <Skeleton key={row} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * A table's shape, for a page whose answer is rows.
 *
 * `cols` is honoured rather than guessed because the skeleton's column rhythm
 * is the part the eye locks onto; a four-column shimmer followed by a
 * seven-column table is a worse arrival than no skeleton at all.
 */
export function SkeletonTable({
  rows = 6,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-line bg-surface"
      role="progressbar"
      aria-label="Loading"
    >
      <div className="border-b border-line px-5 py-3.5">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-4 px-5 py-3">
            {Array.from({ length: cols }, (_, col) => (
              <Skeleton
                key={col}
                // The first column is a name and the rest are figures, so the
                // first is wide and the others are not.
                className={cn('h-4', col === 0 ? 'flex-[2]' : 'flex-1')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stacked card outlines, for a detail page assembled from panels. */
export function SkeletonPanels({
  count = 3,
  tiles = false,
}: {
  count?: number;
  /** Lead with a row of figure tiles, as the session and stable pages do. */
  tiles?: boolean;
}) {
  return (
    <div className="space-y-5" role="progressbar" aria-label="Loading">
      {tiles ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, tile) => (
            <div key={tile} className="rounded-lg border border-line bg-surface px-4 py-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-7 w-20" />
            </div>
          ))}
        </div>
      ) : null}
      {Array.from({ length: count }, (_, panel) => (
        <div key={panel} className="rounded-xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2 h-3 w-64" />
          <Skeleton className="mt-5 h-48 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
