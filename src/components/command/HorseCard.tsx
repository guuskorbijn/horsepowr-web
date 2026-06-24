import Link from 'next/link';
import { CheckCheck, CloudOff, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { HorseIcon } from '@/components/icons/HorseIcon';
import { formatDurationShort, formatRelativeDay } from '@/services/format';
import type { HorseLastSession } from '@/types/view';

function durationMs(startedAt: string, endedAt: string | null): number | null {
  if (!endedAt) return null;
  return new Date(endedAt).getTime() - new Date(startedAt).getTime();
}

export function HorseCard({ entry }: { entry: HorseLastSession }) {
  const { horse, lastSession } = entry;
  const d = lastSession ? durationMs(lastSession.started_at, lastSession.ended_at) : null;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/horses/${horse.id}`}
          className="flex min-w-0 items-center gap-2 hover:underline"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <HorseIcon size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[16px] font-medium text-text-primary">
              {horse.name}
            </span>
            {horse.discipline ? (
              <span className="block truncate text-[12px] text-text-secondary">
                {horse.discipline}
              </span>
            ) : null}
          </span>
        </Link>
        {!horse.active ? <StatusPill tone="muted">Inactive</StatusPill> : null}
      </div>

      {lastSession ? (
        <Link
          href={`/sessions/${lastSession.id}`}
          className="rounded-md border border-line bg-surface-sunken px-3 py-2.5 transition-colors hover:bg-surface-muted"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary">
              <Clock size={14} /> {formatRelativeDay(lastSession.started_at)}
            </span>
            {lastSession.synced ? (
              <StatusPill tone="success" icon={<CheckCheck size={13} />}>
                Synced
              </StatusPill>
            ) : (
              <StatusPill tone="muted" icon={<CloudOff size={13} />}>
                Pending
              </StatusPill>
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="tabular font-display text-[20px] font-semibold text-text-primary">
              {d === null ? '—' : formatDurationShort(d)}
            </span>
            <span className="text-[12px] text-text-tertiary">last session</span>
          </div>
        </Link>
      ) : (
        <div className="rounded-md border border-dashed border-line px-3 py-2.5 text-[13px] text-text-secondary">
          No sessions yet
        </div>
      )}
    </Card>
  );
}
