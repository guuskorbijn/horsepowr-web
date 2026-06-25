'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ChevronRight, CloudOff, CheckCheck, MapPin } from 'lucide-react';
import { useOrg } from '@/components/shell/OrgContext';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/states';
import { TRAINING_TYPE_LABELS } from '@/services/labels';
import { formatDateTime, formatDurationShort, formatRelativeDay } from '@/services/format';
import { usePersistentState } from '@/hooks/usePersistentState';
import type { TrainingType } from '@/types/db';
import type { SessionWithHorse } from '@/types/view';

function durationMs(s: SessionWithHorse['session']): number | null {
  if (!s.ended_at) return null;
  return new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
}

interface SessionFilters {
  horseId: string;
  from: string;
  to: string;
  trainingType: TrainingType | '';
}

const NO_FILTERS: SessionFilters = { horseId: '', from: '', to: '', trainingType: '' };

export function SessionsList({
  sessions,
  showFilters = false,
}: {
  sessions: SessionWithHorse[];
  showFilters?: boolean;
}) {
  const { selectedLocationId, locations } = useOrg();
  const [filters, setFilters] = usePersistentState<SessionFilters>('hp.sessions.filters', NO_FILTERS);
  const f = showFilters ? filters : NO_FILTERS;

  const horseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) map.set(s.horse.id, s.horse.name);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const filtered = useMemo(() => {
    const fromMs = f.from ? new Date(f.from).getTime() : null;
    const toMs = f.to ? new Date(`${f.to}T23:59:59`).getTime() : null;
    return sessions.filter((s) => {
      if (selectedLocationId && s.horse.location_id !== selectedLocationId) return false;
      if (f.horseId && s.horse.id !== f.horseId) return false;
      if (f.trainingType && s.session.training_type !== f.trainingType) return false;
      const t = new Date(s.session.started_at).getTime();
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs) return false;
      return true;
    });
  }, [sessions, selectedLocationId, f]);

  const locationName = (id: string | null) =>
    locations.find((l) => l.id === id)?.name ?? null;

  const filterBar = showFilters ? (
    <div className="no-print mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[12px] text-text-tertiary">
        Horse
        <Select
          value={filters.horseId}
          onChange={(e) => setFilters({ ...filters, horseId: e.target.value })}
          className="h-9 w-44 text-[13px]"
        >
          <option value="">All horses</option>
          {horseOptions.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-text-tertiary">
        From
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-text-primary"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-text-tertiary">
        To
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-text-primary"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-text-tertiary">
        Training type
        <Select
          value={filters.trainingType}
          onChange={(e) => setFilters({ ...filters, trainingType: e.target.value as TrainingType | '' })}
          className="h-9 w-44 text-[13px]"
        >
          <option value="">All types</option>
          {(Object.keys(TRAINING_TYPE_LABELS) as TrainingType[]).map((tt) => (
            <option key={tt} value={tt}>
              {TRAINING_TYPE_LABELS[tt]}
            </option>
          ))}
        </Select>
      </label>
      <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
        Clear
      </Button>
    </div>
  ) : null;

  if (filtered.length === 0) {
    return (
      <>
        {filterBar}
        <EmptyState
          title={showFilters ? 'No sessions match' : 'No sessions in this location'}
          description={
            showFilters
              ? 'Adjust the filters above, or clear them to see every session.'
              : 'Switch to all locations from the top bar, or pick another.'
          }
        />
      </>
    );
  }

  return (
    <>
      {filterBar}
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
    </>
  );
}
