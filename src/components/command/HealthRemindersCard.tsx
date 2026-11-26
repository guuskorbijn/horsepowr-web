import Link from 'next/link';
import { Syringe } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatCalendarDate } from '@/services/format';
import type { HealthReminder } from '@/services/health/healthReminders';

/**
 * "Coming up: vaccinations that expire." Dates and day counts only — the
 * stable decides what to do, HorsePowr only remembers the date for them.
 * Server component: rendered with the server translator, no client JS.
 */
export function HealthRemindersCard({
  reminders,
  horseNames,
  t,
}: {
  reminders: readonly HealthReminder[];
  horseNames: ReadonlyMap<string, string>;
  t: (key: string) => string;
}) {
  if (reminders.length === 0) return null;
  return (
    <Card className="mb-6">
      <CardHeader title={t('health.remindersTitle')} subtitle={t('health.remindersSubtitle')} />
      <CardBody className="p-0">
        <ul className="divide-y divide-line">
          {reminders.slice(0, 8).map((r) => (
            <li key={r.recordId}>
              <Link
                href={`/horses/${r.horseId}`}
                className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-surface-muted"
              >
                <Syringe size={15} className="text-text-tertiary" />
                <span className="min-w-[8rem] text-[14px] font-medium text-text-primary">
                  {horseNames.get(r.horseId) ?? '—'}
                </span>
                <span className="flex-1 text-[13px] text-text-secondary">{r.title}</span>
                <span className="text-[12px] tabular-nums text-text-tertiary">{formatCalendarDate(r.validUntil)}</span>
                <StatusPill tone={r.state === 'expired' ? 'warning' : 'info'}>
                  {r.state === 'expired'
                    ? t('health.expired')
                    : t('health.expiresIn').replace('{days}', String(r.daysLeft))}
                </StatusPill>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
