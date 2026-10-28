'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from '@/components/ui/FormControls';
import { useTranslation } from '@/i18n/LocaleProvider';
import { cn } from '@/lib/cn';
import { agendaHref, type AgendaQuery } from '@/services/calendar/agendaQuery';
import { AGENDA_VIEWS, shiftAgenda, type AgendaWindow } from '@/services/calendar/agendaService';

interface Option {
  id: string;
  label: string;
}

/**
 * Navigation and filters. Every control writes the URL and nothing else: the
 * page is a server component that re-reads from it, so a filtered day is a
 * link that can be shared and the back button undoes a filter.
 */
export function AgendaToolbar({
  basePath,
  query,
  span,
  showsToday,
  horses,
  people,
  lockedHorse,
}: {
  basePath: string;
  query: AgendaQuery;
  span: AgendaWindow;
  showsToday: boolean;
  horses: readonly Option[];
  people: readonly Option[];
  /** Set on a horse's own agenda: the horse filter is the page itself. */
  lockedHorse: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const go = (patch: Partial<AgendaQuery>): void => router.push(agendaHref(basePath, { ...query, ...patch }));

  const step = (delta: number): string =>
    agendaHref(basePath, { ...query, date: shiftAgenda(span.view, span.startDayKey, delta) });

  const rangeLabel =
    span.view === 'day' ? span.startDayKey : `${span.startDayKey} – ${span.endDayKey}`;

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={step(-1)}
            aria-label={span.view === 'day' ? t('agenda.previousDay') : t('agenda.previousWeek')}
            className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-muted"
          >
            <ChevronLeft size={18} />
          </Link>
          <p className="min-w-[11rem] text-center text-[14px] font-medium tabular-nums text-text-primary">
            {rangeLabel}
          </p>
          <Link
            href={step(1)}
            aria-label={span.view === 'day' ? t('agenda.nextDay') : t('agenda.nextWeek')}
            className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-muted"
          >
            <ChevronRight size={18} />
          </Link>
          {!showsToday ? (
            <Link
              href={agendaHref(basePath, { ...query, date: null })}
              className="ml-1 flex h-11 items-center rounded-md border border-line-strong px-3 text-[13px] font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            >
              {span.view === 'day' ? t('agenda.today') : t('agenda.thisWeek')}
            </Link>
          ) : null}
        </div>

        <div role="group" aria-label={t('agenda.viewLabel')} className="flex rounded-md border border-line p-0.5">
          {AGENDA_VIEWS.map((view) => (
            <Link
              key={view}
              href={agendaHref(basePath, { ...query, view })}
              aria-current={span.view === view ? 'page' : undefined}
              className={cn(
                'flex h-10 min-w-[4.5rem] items-center justify-center rounded px-3 text-[13px] font-medium',
                span.view === view
                  ? 'bg-primary-soft text-primary'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
              )}
            >
              {view === 'day' ? t('agenda.viewDay') : t('agenda.viewWeek')}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {!lockedHorse ? (
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:max-w-xs">
            <span className="text-[12px] font-medium text-text-secondary">{t('agenda.filter.horseLabel')}</span>
            <Select
              value={query.horseId ?? ''}
              onChange={(e) => go({ horseId: e.target.value === '' ? null : e.target.value })}
            >
              <option value="">{t('agenda.filter.allHorses')}</option>
              {horses.map((horse) => (
                <option key={horse.id} value={horse.id}>
                  {horse.label}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:max-w-xs">
          <span className="text-[12px] font-medium text-text-secondary">{t('agenda.filter.assigneeLabel')}</span>
          <Select
            value={query.assigneeId ?? ''}
            onChange={(e) => go({ assigneeId: e.target.value === '' ? null : e.target.value })}
          >
            <option value="">{t('agenda.filter.anyone')}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </div>
  );
}
