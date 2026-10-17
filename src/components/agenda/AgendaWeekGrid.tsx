'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/ui/states';
import { useTranslation } from '@/i18n/LocaleProvider';
import { shiftWeek } from '@/services/calendar/agendaWeekService';
import { formatZonedTime, zoneShortLabel } from '@/services/time/timezone';
import { cn } from '@/lib/cn';
import { FadeIn } from '@/components/motion/FadeIn';
import type { AgendaWeek } from '@/services/calendar/agendaWeekService';
import type { CalendarEventType, EventOccurrence } from '@/types/calendar';

/**
 * Seven days side by side.
 *
 * The visual language matches the phone deliberately — the same type accents,
 * the same "form not verdict" treatment of state — so a trainer who plans on a
 * laptop and executes on a phone is looking at one product. Nothing here grades
 * anything: a cancelled item is struck through, a done one recedes, and that is
 * the whole vocabulary.
 */

/** Type accent. Coral is absent on purpose: it is reserved for the one CTA. */
const TYPE_ACCENT: Record<CalendarEventType, string> = {
  training: 'border-l-primary',
  vet: 'border-l-info',
  physio: 'border-l-success',
  farrier: 'border-l-warning',
  competition: 'border-l-[#7C5CC4]',
  other: 'border-l-line',
};

function DayColumn({
  dayKey,
  occurrences,
  readerTimeZone,
  horseNames,
  isToday,
}: {
  dayKey: string;
  occurrences: readonly EventOccurrence[];
  readerTimeZone: string;
  horseNames: Record<string, string>;
  isToday: boolean;
}) {
  const { t } = useTranslation();
  const weekday = new Date(`${dayKey}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    timeZone: 'UTC',
  });
  const dayNumber = Number(dayKey.slice(8, 10));

  return (
    <div className="flex min-w-0 flex-col">
      <div
        className={cn(
          'mb-2 flex items-baseline gap-2 border-b border-line pb-2',
          isToday && 'border-b-primary',
        )}
      >
        <span className="text-[13px] font-medium uppercase tracking-wide text-text-tertiary">
          {weekday}
        </span>
        <span
          className={cn(
            'font-display text-[18px] font-semibold',
            isToday ? 'text-primary' : 'text-text-primary',
          )}
        >
          {dayNumber}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {occurrences.length === 0 ? (
          <p className="py-2 text-[13px] text-text-tertiary">{t('agenda.dayEmpty')}</p>
        ) : (
          occurrences.map((occurrence) => {
            const cancelled = occurrence.status === 'cancelled';
            const done = occurrence.status === 'done';
            const zoneLabel = zoneShortLabel(occurrence.timezone, readerTimeZone);
            const horse =
              occurrence.horse_id === null
                ? t('agenda.wholeStable')
                : (horseNames[occurrence.horse_id] ?? t('agenda.wholeStable'));

            return (
              <div
                key={occurrence.key}
                className={cn(
                  'rounded-lg border border-l-4 border-line p-2.5',
                  TYPE_ACCENT[occurrence.type],
                  done ? 'bg-surface-muted' : 'bg-surface',
                  cancelled && 'opacity-60',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[12px] tabular-nums text-text-primary">
                    {occurrence.all_day
                      ? t('agenda.allDay')
                      : formatZonedTime(occurrence.starts_at, readerTimeZone)}
                  </span>
                  {zoneLabel ? (
                    <span className="text-[11px] text-text-tertiary">{zoneLabel}</span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    'mt-0.5 text-[14px] text-text-primary',
                    cancelled && 'line-through',
                  )}
                >
                  {occurrence.title}
                </p>
                <p className="text-[12px] text-text-secondary">{horse}</p>
                {cancelled ? (
                  <p className="mt-1 text-[11px] text-danger">{t('agenda.cancelled')}</p>
                ) : done ? (
                  <p className="mt-1 text-[11px] text-text-secondary">{t('agenda.done')}</p>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AgendaWeekGrid({
  week,
  horseNames,
  empty,
}: {
  week: AgendaWeek;
  horseNames: Record<string, string>;
  empty: boolean;
}) {
  const { t } = useTranslation();
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/agenda?week=${shiftWeek(week.startDayKey, -1)}`}
          aria-label={t('agenda.previousWeek')}
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-muted"
        >
          <ChevronLeft size={18} />
        </Link>
        <p className="text-[14px] font-medium text-text-primary">
          {week.startDayKey} &ndash; {week.endDayKey}
        </p>
        <Link
          href={`/agenda?week=${shiftWeek(week.startDayKey, 1)}`}
          aria-label={t('agenda.nextWeek')}
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-muted"
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      {empty ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={t('agenda.weekEmptyTitle')}
          description={t('agenda.weekEmptyDescription')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
          {week.days.map((day, dayIndex) => (
            <FadeIn key={day.dayKey} index={dayIndex}>
            <DayColumn
              dayKey={day.dayKey}
              occurrences={day.occurrences}
              readerTimeZone={week.readerTimeZone}
              horseNames={horseNames}
              isToday={day.dayKey === todayKey}
            />
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
