import type { ReactNode } from 'react';

/** Standard page heading + optional action area. Sentence case everywhere. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-8 text-text-primary">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[15px] text-text-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
