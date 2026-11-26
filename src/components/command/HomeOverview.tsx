'use client';

import Link from 'next/link';
import { ArrowRight, CalendarCheck2, CheckCircle2, Circle, Sunrise } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { CountUp } from '@/components/motion/CountUp';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useLive } from '@/components/live/LiveProvider';
import { cn } from '@/lib/cn';
import { formatDayKey } from '@/services/format';
import { TYPE_ACCENT } from '@/services/calendar/eventTypeAccent';
import { formatHrRange } from '@/services/calendar/agendaService';
import type { AgendaItem } from '@/services/calendar/agendaService';
import type { HomeOverview as Overview } from '@/services/home/homeService';
import { CALENDAR_EVENT_TYPES } from '@/types/calendar';

/**
 * The dashboard's top half: one layout for every role, filled from the
 * signed-in person's point of view. KPIs count up, today's items show done
 * vs open, and the week grid shows horses x days at a glance. Live updates
 * from colleagues re-render it (and the numbers glide to their new value).
 */

function Kpi({ label, value, of }: { label: string; value: number; of?: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-[12px] text-text-secondary">{label}</p>
      <p className="mt-1 font-display text-[26px] font-semibold leading-none text-text-primary">
        <CountUp value={value} />
        {of !== undefined ? <span className="text-[15px] font-medium text-text-tertiary"> / {of}</span> : null}
      </p>
    </div>
  );
}

function ItemRow({
  item,
  horseName,
  personName,
}: {
  item: AgendaItem;
  horseName: string | null;
  personName: string | null;
}) {
  const { t } = useTranslation();
  const { recent } = useLive();
  const o = item.occurrence;
  return (
    <li>
      <Link
        href={`/agenda?view=day${o.horse_id ? `&horse=${o.horse_id}` : ''}`}
        className={cn(
          'flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-muted',
          recent.has(o.event_id) && 'hp-just-changed',
        )}
      >
        {item.done ? (
          <CheckCircle2 size={18} className="shrink-0 text-success" aria-label={t('agenda.done')} />
        ) : (
          <Circle size={18} className="shrink-0 text-text-tertiary" aria-hidden />
        )}
        <span className="w-12 shrink-0 font-mono text-[12px] tabular-nums text-text-secondary">
          {item.readerTime ?? t('agenda.allDay')}
        </span>
        <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: TYPE_ACCENT[o.type] }} />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[14px] text-text-primary',
              item.done && 'text-text-secondary line-through decoration-text-tertiary',
              item.cancelled && 'line-through opacity-60',
            )}
          >
            {o.title}
          </span>
          <span className="block truncate text-[12px] text-text-secondary">
            {[horseName ?? t('agenda.wholeStable'), personName].filter(Boolean).join(' · ')}
          </span>
        </span>
        {item.target !== null ? (
          <span className="hidden shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] tabular-nums text-text-secondary md:inline">
            {formatHrRange(item.target.hrMinBpm, item.target.hrMaxBpm) ??
              (item.target.durationMin !== null ? `${item.target.durationMin} min` : t('agenda.blockEditor.title'))}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export function HomeOverview({
  overview,
  horseNames,
  peopleNames,
}: {
  overview: Overview;
  horseNames: Record<string, string>;
  peopleNames: Record<string, string>;
}) {
  const { t, locale } = useTranslation();
  const o = overview;
  const name = (id: string | null, map: Record<string, string>): string | null =>
    id === null ? null : (map[id] ?? null);
  const weekday = (key: string): string =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', { weekday: 'short', timeZone: 'UTC' });

  return (
    <div className="mb-8 space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('home.kpiToday')} value={o.counts.today} />
        <Kpi label={t('home.kpiDone')} value={o.counts.doneToday} of={o.counts.today} />
        <Kpi label={t('home.kpiWeekTrainings')} value={o.counts.weekTrainings} />
        <Kpi label={t('home.kpiMine')} value={o.counts.openAssignedToMe} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('home.myDay')}
            subtitle={t('home.myDaySubtitle')}
            action={<Sunrise size={18} className="text-text-tertiary" />}
          />
          <CardBody>
            {o.myToday.length > 0 ? (
              <ul className="-mx-2">
                {o.myToday.map((item) => (
                  <ItemRow
                    key={item.occurrence.key}
                    item={item}
                    horseName={name(item.occurrence.horse_id, horseNames)}
                    personName={null}
                  />
                ))}
              </ul>
            ) : o.myNext !== null ? (
              <div className="space-y-2">
                <p className="text-[13px] text-text-secondary">
                  {t('home.nothingToday')} {t('home.nextUp')} {formatDayKey(o.myNext.dayKey)}:
                </p>
                <ul className="-mx-2">
                  <ItemRow
                    item={o.myNext.item}
                    horseName={name(o.myNext.item.occurrence.horse_id, horseNames)}
                    personName={null}
                  />
                </ul>
              </div>
            ) : (
              <p className="text-[14px] text-text-secondary">{t('home.nothingAssigned')}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('home.stableToday')}
            subtitle={t('home.stableTodaySubtitle')
              .replace('{done}', String(o.counts.doneToday))
              .replace('{total}', String(o.counts.today))}
            action={
              <Link href="/agenda?view=day" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                {t('home.openAgenda')} <ArrowRight size={14} />
              </Link>
            }
          />
          <CardBody>
            {o.stableToday.length === 0 ? (
              <p className="text-[14px] text-text-secondary">{t('home.stableEmpty')}</p>
            ) : (
              <>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-success transition-[width] duration-700 ease-out"
                    style={{ width: `${o.counts.today === 0 ? 0 : (o.counts.doneToday / o.counts.today) * 100}%` }}
                  />
                </div>
                <ul className="-mx-2 max-h-80 overflow-y-auto">
                  {o.stableToday.map((item) => (
                    <ItemRow
                      key={item.occurrence.key}
                      item={item}
                      horseName={name(item.occurrence.horse_id, horseNames)}
                      personName={name(item.occurrence.assignee_id, peopleNames)}
                    />
                  ))}
                </ul>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={t('home.thisWeek')}
          subtitle={t('home.thisWeekSubtitle').replace('{count}', String(o.counts.weekItems))}
          action={<CalendarCheck2 size={18} className="text-text-tertiary" />}
        />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[40rem] border-collapse text-[13px]">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-surface px-4 py-2 text-left font-medium text-text-tertiary">
                  {t('nav.horses')}
                </th>
                {o.dayKeys.map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className={cn(
                      'px-2 py-2 text-center font-medium',
                      key === o.todayKey ? 'text-primary' : 'text-text-tertiary',
                    )}
                  >
                    <span className="block text-[11px] uppercase">{weekday(key)}</span>
                    <span className="font-display text-[15px]">{Number(key.slice(8, 10))}</span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-medium text-text-tertiary">
                  {t('home.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {o.rows.map((row) => (
                <tr key={row.horseId} className="border-t border-line hover:bg-surface-muted/60">
                  <th scope="row" className="sticky left-0 bg-surface px-4 py-2 text-left font-normal">
                    <Link href={`/horses/${row.horseId}/agenda`} className="text-text-primary hover:text-primary">
                      {row.name}
                    </Link>
                  </th>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.dayKey}
                      className={cn('px-2 py-2 text-center', cell.dayKey === o.todayKey && 'bg-primary-soft/40')}
                      title={cell.kinds.map((k) => t(`agenda.type.${k.type}`)).join(', ')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {cell.kinds.slice(0, 4).map((k, i) => (
                          <span
                            key={i}
                            className={cn('h-2.5 w-2.5 rounded-full border-2', k.cancelled && 'opacity-30')}
                            style={{
                              borderColor: TYPE_ACCENT[k.type],
                              background: k.done ? TYPE_ACCENT[k.type] : 'transparent',
                            }}
                          />
                        ))}
                        {cell.kinds.length > 4 ? (
                          <span className="text-[11px] text-text-tertiary">+{cell.kinds.length - 4}</span>
                        ) : null}
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[12px] text-text-secondary">
            {CALENDAR_EVENT_TYPES.map((type) => (
              <span key={type} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_ACCENT[type] }} />
                {t(`agenda.type.${type}`)}
              </span>
            ))}
            <span className="ml-auto text-text-tertiary">{t('home.legend')}</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
