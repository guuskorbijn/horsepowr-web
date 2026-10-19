'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useTranslation } from '@/i18n/LocaleProvider';
import { shiftWeek } from '@/services/calendar/agendaWeekService';
import { cn } from '@/lib/cn';
import type { StableWeek } from '@/services/stable/stableWeekService';

/**
 * A stable's week, horse by horse.
 *
 * The hard part of this screen is not the numbers, it is resisting the pull
 * to rank them. An "attention" column, a red row, a sort by least-worked —
 * each would be this product telling a trainer their job, which it does not
 * do. So: alphabetical, plain counts, and the one piece of emphasis is a
 * neutral dash for "nothing here", because a zero and an absence read
 * differently at a glance.
 */

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-[12px] text-text-tertiary">{label}</div>
      <div className="tabular mt-0.5 font-display text-[24px] font-semibold leading-8 text-text-primary">
        {value}
      </div>
      {hint ? <div className="text-[12px] text-text-secondary">{hint}</div> : null}
    </div>
  );
}

function Cell({
  children,
  muted,
  className,
}: {
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        'tabular border-b border-line px-3 py-2.5 text-right text-[14px]',
        muted ? 'text-text-tertiary' : 'text-text-primary',
        className,
      )}
    >
      {children}
    </td>
  );
}

/** A zero is written as a dash: an absence should not look like a measurement. */
function count(value: number): { text: string; muted: boolean } {
  return value === 0 ? { text: '—', muted: true } : { text: String(value), muted: false };
}

export function StableWeekView({
  week,
  startDayKey,
  endDayKey,
}: {
  week: StableWeek;
  startDayKey: string;
  endDayKey: string;
}) {
  const { t } = useTranslation();
  const { totals } = week;
  // The same one-way-paging problem the agenda had.
  const todayKey = new Date().toISOString().slice(0, 10);
  const showsToday = todayKey >= startDayKey && todayKey <= endDayKey;
  const hours = Math.floor(totals.recordedMinutes / 60);
  const minutes = totals.recordedMinutes % 60;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={`/stable?week=${shiftWeek(startDayKey, -1)}`}
          aria-label={t('agenda.previousWeek')}
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-muted"
        >
          <ChevronLeft size={18} />
        </Link>
        <div className="flex items-center gap-3">
          <p className="text-[14px] font-medium text-text-primary">
            {startDayKey} &ndash; {endDayKey}
          </p>
          {!showsToday ? (
            <Link
              href="/stable"
              className="rounded-md border border-line-strong px-2.5 py-1 text-[12px] font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            >
              {t('agenda.thisWeek')}
            </Link>
          ) : null}
        </div>
        <Link
          href={`/stable?week=${shiftWeek(startDayKey, 1)}`}
          aria-label={t('agenda.nextWeek')}
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-muted"
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label={t('stable.tiles.sessions')} value={String(totals.sessions)} />
        <Tile
          label={t('stable.tiles.recorded')}
          value={hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
        />
        <Tile
          label={t('stable.tiles.withoutSession')}
          value={String(totals.horsesWithoutSession)}
          hint={`${t('stable.tiles.ofHorses')} ${totals.horses}`}
        />
        <Tile
          label={t('stable.tiles.notRecorded')}
          value={String(totals.plannedNotRecorded)}
          hint={`${t('stable.tiles.ofPlanned')} ${totals.planned}`}
        />
        <Tile
          label={t('stable.tiles.unfinished')}
          value={String(totals.unfinishedSessions)}
        />
      </div>

      <Card>
        <CardHeader
          title={t('stable.table.title')}
          subtitle={t('stable.table.subtitle')}
        />
        <CardBody className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-line px-3 py-2 text-left text-[12px] font-medium text-text-tertiary">
                    {t('stable.table.horse')}
                  </th>
                  {[
                    'sessions',
                    'recorded',
                    'planned',
                    'done',
                    'notRecorded',
                    'upcoming',
                  ].map((key) => (
                    <th
                      key={key}
                      className="border-b border-line px-3 py-2 text-right text-[12px] font-medium text-text-tertiary"
                    >
                      {t(`stable.table.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {week.rows.map((row) => {
                  const sessions = count(row.sessionCount);
                  const planned = count(row.plannedCount);
                  const done = count(row.plannedDone);
                  const notRecorded = count(row.plannedNotRecorded);
                  const upcoming = count(row.plannedUpcoming);
                  return (
                    <tr key={row.horseId} className="hover:bg-surface-muted">
                      <td className="border-b border-line px-3 py-2.5 text-left text-[14px]">
                        <Link
                          href={`/horses/${row.horseId}`}
                          className="text-text-primary hover:text-primary hover:underline"
                        >
                          {row.horseName}
                        </Link>
                      </td>
                      <Cell muted={sessions.muted}>
                        {sessions.text}
                        {row.unfinishedSessions > 0 ? (
                          <span className="ml-1 text-[12px] text-warning">
                            +{row.unfinishedSessions}
                          </span>
                        ) : null}
                      </Cell>
                      <Cell muted={row.recordedMinutes === 0}>
                        {row.recordedMinutes === 0 ? '—' : `${row.recordedMinutes}m`}
                      </Cell>
                      <Cell muted={planned.muted}>{planned.text}</Cell>
                      <Cell muted={done.muted}>{done.text}</Cell>
                      <Cell muted={notRecorded.muted}>{notRecorded.text}</Cell>
                      <Cell muted={upcoming.muted}>{upcoming.text}</Cell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <p className="text-[12px] text-text-secondary">
        {t('stable.footnote')}
        {week.stableWideOccurrences > 0
          ? ` ${t('stable.stableWide').replace(
              '{count}',
              String(week.stableWideOccurrences),
            )}`
          : ''}
      </p>
    </div>
  );
}
