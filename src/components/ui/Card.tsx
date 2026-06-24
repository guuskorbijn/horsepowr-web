import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Resting surface: white (light) / ink-800 (dark), radius lg, soft elevation. */
export function Card({
  children,
  className,
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <As
      className={cn(
        'rounded-lg border border-line bg-surface shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {children}
    </As>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-6 pt-5', className)}>
      <div>
        <h2 className="font-display text-[18px] font-medium leading-6 text-text-primary">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[13px] text-text-secondary">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('px-6 py-5', className)}>{children}</div>;
}
