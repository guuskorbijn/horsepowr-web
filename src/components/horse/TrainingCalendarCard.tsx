'use client';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useTranslation } from '@/i18n/LocaleProvider';
import { formatDurationShort } from '@/services/format';
import { formatCalendarDate } from '@/services/format';
import type { TrainingCalendar } from '@/services/trainingCalendar';

/**
 * Half a year of training at a glance: a GitHub-style heat map of minutes per
 * day, a sparkline of minutes per week, and the last four weeks next to the
 * four before. Descriptive — the colour scale is minutes, nothing else.
 */

function Sparkline({ values }: { values: readonly number[] }) {
  const w = 220;
  const h = 40;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 6)).toFixed(1)}`);
  const area = `0,${h} ${pts.join(' ')} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Minutes per week">
      <polygon points={area} fill="var(--color-primary)" opacity={0.12} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2}
        strokeLinejoin="round"
        pathLength={1}
        className="hp-draw"
      />
    </svg>
  );
}

function level(minutes: number, max: number): number {
  if (minutes <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((minutes / max) * 4));
}

const LEVEL_OPACITY = [0, 0.25, 0.45, 0.7, 1];

export function TrainingCalendarCard({ calendar }: { calendar: TrainingCalendar }) {
  const { t } = useTranslation();
  const { recent, previous } = calendar;
  const fmt = (min: number): string => formatDurationShort(min * 60_000);

  return (
    <Card>
      <CardHeader title={t('trainingCalendar.title')} subtitle={t('trainingCalendar.subtitle')} />
      <CardBody className="space-y-4">
        <div className="overflow-x-auto">
          <div className="flex gap-[3px]">
            {calendar.weeks.map((col, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {col.map((day) => {
                  const lv = level(day.minutes, calendar.maxDayMinutes);
                  return (
                    <span
                      key={day.dayKey}
                      title={`${formatCalendarDate(day.dayKey)} · ${day.minutes > 0 ? fmt(day.minutes) : t('trainingCalendar.rest')}`}
                      className="h-3 w-3 rounded-[3px] border border-line/60"
                      style={{
                        background:
                          lv === 0
                            ? 'var(--color-surface-muted)'
                            : `color-mix(in srgb, var(--color-primary) ${(LEVEL_OPACITY[lv] ?? 1) * 100}%, transparent)`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[12px] text-text-secondary">{t('trainingCalendar.perWeek')}</p>
            <Sparkline values={calendar.weekMinutes} />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
            <dt className="text-text-secondary">{t('trainingCalendar.last4')}</dt>
            <dd className="text-right tabular-nums text-text-primary">
              {t('trainingCalendar.sessionsMinutes')
                .replace('{sessions}', String(recent.sessions))
                .replace('{time}', fmt(recent.minutes))}
            </dd>
            <dt className="text-text-secondary">{t('trainingCalendar.prev4')}</dt>
            <dd className="text-right tabular-nums text-text-secondary">
              {t('trainingCalendar.sessionsMinutes')
                .replace('{sessions}', String(previous.sessions))
                .replace('{time}', fmt(previous.minutes))}
            </dd>
          </dl>
        </div>
      </CardBody>
    </Card>
  );
}
