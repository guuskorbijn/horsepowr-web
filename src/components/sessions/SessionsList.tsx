'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Bookmark, ChevronRight, CloudOff, CheckCheck, MapPin, X } from 'lucide-react';
import { useOrg } from '@/components/shell/OrgContext';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/states';
import { TRAINING_TYPE_LABELS } from '@/services/labels';
import { formatDateTime, formatDurationShort, formatRelativeDay, formatTime } from '@/services/format';
import { useReaderTimeZone } from '@/lib/readerTimeZoneContext';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useTranslation } from '@/i18n/LocaleProvider';
import {
  filterSessions,
  NO_FILTERS,
  SESSION_SORTS,
  sortSessions,
  type SavedView,
  type SessionFilters,
  type SessionSort,
} from '@/services/sessionListView';
import type { TrainingType } from '@/types/db';
import type { SessionWithHorse } from '@/types/view';

/**
 * All sessions, filterable, sortable and savable as named views ("Eventing
 * this month"). Filters, sort and views are kept per browser — a personal
 * convenience, not shared state.
 */
export function SessionsList({
  sessions,
  showFilters = false,
}: {
  sessions: SessionWithHorse[];
  showFilters?: boolean;
}) {
  const { t } = useTranslation();
  const timeZone = useReaderTimeZone();
  const { selectedLocationId, locations } = useOrg();
  const [filters, setFilters] = usePersistentState<SessionFilters>('hp.sessions.filters', NO_FILTERS);
  const [sort, setSort] = usePersistentState<SessionSort>('hp.sessions.sort', 'newest');
  const [views, setViews] = usePersistentState<SavedView[]>('hp.sessions.views', []);
  const [naming, setNaming] = useState<string | null>(null);
  const f = showFilters ? filters : NO_FILTERS;

  const horseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) map.set(s.horse.id, s.horse.name);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const shown = useMemo(
    () => sortSessions(filterSessions(sessions, f, selectedLocationId), showFilters ? sort : 'newest'),
    [sessions, f, selectedLocationId, sort, showFilters],
  );

  const locationName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? null;
  const active = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const field = 'flex flex-col gap-1 text-[12px] text-text-tertiary';
  const filterBar = showFilters ? (
    <div className="no-print mb-4 space-y-3">
      {views.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-text-tertiary">{t('sessionsList.views')}</span>
          {views.map((v) => (
            <span key={v.name} className="inline-flex items-center rounded-full border border-line bg-surface text-[12px]">
              <button type="button" onClick={() => setFilters(v.filters)} className="px-3 py-1 font-medium text-text-primary hover:text-primary">
                {v.name}
              </button>
              <button
                type="button"
                aria-label={t('sessionsList.deleteView')}
                onClick={() => setViews(views.filter((x) => x.name !== v.name))}
                className="pr-2 text-text-tertiary hover:text-text-primary"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className={field}>
          {t('sessionsList.horse')}
          <Select value={filters.horseId} onChange={(e) => setFilters({ ...filters, horseId: e.target.value })} className="h-9 w-44 text-[13px]">
            <option value="">{t('sessionsList.allHorses')}</option>
            {horseOptions.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </Select>
        </label>
        <label className={field}>
          {t('sessionsList.from')}
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-text-primary" />
        </label>
        <label className={field}>
          {t('sessionsList.to')}
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-text-primary" />
        </label>
        <label className={field}>
          {t('sessionsList.trainingType')}
          <Select value={filters.trainingType} onChange={(e) => setFilters({ ...filters, trainingType: e.target.value as TrainingType | '' })} className="h-9 w-44 text-[13px]">
            <option value="">{t('sessionsList.allTypes')}</option>
            {(Object.keys(TRAINING_TYPE_LABELS) as TrainingType[]).map((tt) => (
              <option key={tt} value={tt}>{TRAINING_TYPE_LABELS[tt]}</option>
            ))}
          </Select>
        </label>
        <label className={field}>
          {t('sessionsList.sort')}
          <Select value={sort} onChange={(e) => setSort(e.target.value as SessionSort)} className="h-9 w-44 text-[13px]">
            {SESSION_SORTS.map((s) => (
              <option key={s} value={s}>{t(`sessionsList.sorts.${s}`)}</option>
            ))}
          </Select>
        </label>
        {active ? (
          <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
            {t('sessionsList.clear')}
          </Button>
        ) : null}
        {active ? (
          naming === null ? (
            <Button variant="secondary" size="sm" onClick={() => setNaming('')}>
              <Bookmark size={14} /> {t('sessionsList.saveView')}
            </Button>
          ) : (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = naming.trim();
                if (name === '') return;
                setViews([...views.filter((v) => v.name !== name), { name, filters }]);
                setNaming(null);
              }}
            >
              <input
                autoFocus
                value={naming}
                onChange={(e) => setNaming(e.target.value)}
                placeholder={t('sessionsList.viewName')}
                className="h-9 w-44 rounded-md border border-line bg-surface px-2 text-[13px] text-text-primary"
              />
              <Button type="submit" size="sm">{t('common.save')}</Button>
            </form>
          )
        ) : null}
        <span className="ml-auto text-[12px] tabular-nums text-text-tertiary">
          {t('sessionsList.count').replace('{n}', String(shown.length))}
        </span>
      </div>
    </div>
  ) : null;

  if (shown.length === 0) {
    return (
      <>
        {filterBar}
        <EmptyState
          title={showFilters ? t('sessionsList.noMatchTitle') : t('sessionsList.noLocationTitle')}
          description={showFilters ? t('sessionsList.noMatchBody') : t('sessionsList.noLocationBody')}
        />
      </>
    );
  }

  return (
    <>
      {filterBar}
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {shown.map(({ session, horse }) => {
            const start = Date.parse(session.started_at);
            const d = session.ended_at ? Date.parse(session.ended_at) - start : null;
            const loc = locationName(horse.location_id);
            return (
              <li key={session.id}>
                <Link href={`/sessions/${session.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-muted">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-text-primary">{horse.name}</span>
                      {session.training_type ? <StatusPill tone="info">{TRAINING_TYPE_LABELS[session.training_type]}</StatusPill> : null}
                      {session.planned_event_id ? <StatusPill tone="muted">{t('sessionsList.planned')}</StatusPill> : null}
                      {session.injury_concern ? <StatusPill tone="warning">{t('sessionsList.injury')}</StatusPill> : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[13px] text-text-secondary">
                      <span title={formatDateTime(session.started_at, timeZone)}>
                        {formatRelativeDay(session.started_at, new Date(), timeZone)} · {formatTime(session.started_at, timeZone)}
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
                      <StatusPill tone="success" icon={<CheckCheck size={13} />}>{t('sessionsList.synced')}</StatusPill>
                    ) : (
                      <StatusPill tone="muted" icon={<CloudOff size={13} />}>{t('sessionsList.pending')}</StatusPill>
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
