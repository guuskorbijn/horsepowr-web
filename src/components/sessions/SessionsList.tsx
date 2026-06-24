'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ChevronRight, CloudOff, CheckCheck, MapPin } from 'lucide-react';
import { useOrg } from '@/components/shell/OrgContext';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/states';
import { TRAINING_TYPE_LABELS } from '@/services/labels';
import { formatDateTime, formatDurationShort, formatRelativeDay } from '@/services/format';
import type { SessionWithHorse } from '@/types/view';

function durationMs(s: SessionWithHorse['session']): number | null {
  if (!s.ended_at) return null;
  return new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
}

export function SessionsList({ sessions }: { sessions: SessionWithHorse[] }) {
  const { selectedLocationId, locations } = useOrg();

  const filtered = useMemo(() => {
    if (!selectedLocationId) return sessions;
    return sessions.filter((s) => s.horse.location_id === selectedLocationId);
  }, [sessions, selectedLocationId]);

  const locationName = (id: string | null) =>
    locations.find((l) => l.id === id)?.name ?? null;

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="No sessions in this location"
        description="Switch to all locations from the top bar, or pick another."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {filtered.map(({ session, horse }) => {
          const d = durationMs(session);
          const loc = locationName(horse.location_id);
          return (
            <li key={session.id}>
              <Link
                href={`/sessions/${session.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-text-primary">{horse.name}</span>
                    {session.training_type ? (
                      <StatusPill tone="info">
                        {TRAINING_TYPE_LABELS[session.training_type]}
                      </StatusPill>
                    ) : null}
                    {session.injury_concern ? (
                      <StatusPill tone="warning">Injury noted</StatusPill>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[13px] text-text-secondary">
                    <span title={formatDateTime(session.started_at)}>
                      {formatRelativeDay(session.started_at)}
                    </span>
                    {loc ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} /> {loc}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="tabular hidden w-24 text-right text-[14px] text-text-secondary sm:block">
                  {d === null ? '—' : formatDurationShort(d)}
                </div>
                <div className="w-28 text-right">
                  {session.synced ? (
                    <StatusPill tone="success" icon={<CheckCheck size={13} />}>
                      Synced
                    </StatusPill>
                  ) : (
                    <StatusPill tone="muted" icon={<CloudOff size={13} />}>
                      Pending
                    </StatusPill>
                  )}
                </div>
                <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
