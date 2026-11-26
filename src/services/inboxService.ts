import type { AgendaDay } from '@/services/calendar/agendaService';
import type { HealthReminder } from '@/services/health/healthReminders';

/**
 * The notification inbox's entries, in priority order. PURE.
 *  1. Polar rides waiting for a horse (they block a session existing).
 *  2. Expired / expiring health records (dates, never advice).
 *  3. My open items today and tomorrow.
 */

export interface InboxEntry {
  id: string;
  kind: 'polar' | 'health' | 'task';
  title: string;
  detail: string;
  dayKey: string | null;
  href: string;
  urgent: boolean;
}

export function buildInbox(params: {
  todayKey: string;
  polar: ReadonlyArray<{ id: string; started_at: string; suggested_horse_id: string | null }>;
  reminders: readonly HealthReminder[];
  agendaDays: readonly AgendaDay[];
  horseNames: ReadonlyMap<string, string>;
  t: (key: string) => string;
}): InboxEntry[] {
  const { t, horseNames } = params;
  const out: InboxEntry[] = [];

  for (const ride of params.polar) {
    out.push({
      id: `polar:${ride.id}`,
      kind: 'polar',
      title: t('inbox.polarTitle'),
      detail: ride.suggested_horse_id
        ? t('inbox.polarSuggested').replace('{horse}', horseNames.get(ride.suggested_horse_id) ?? '—')
        : t('inbox.polarPick'),
      dayKey: ride.started_at.slice(0, 10),
      href: '/sessions/import',
      urgent: false,
    });
  }

  for (const r of params.reminders) {
    out.push({
      id: `health:${r.recordId}:${r.state}`,
      kind: 'health',
      title: `${horseNames.get(r.horseId) ?? '—'} · ${r.title}`,
      detail:
        r.state === 'expired'
          ? t('inbox.expired')
          : t('inbox.expiresIn').replace('{days}', String(r.daysLeft)),
      dayKey: r.validUntil,
      href: `/horses/${r.horseId}`,
      urgent: r.state === 'expired' || r.daysLeft <= 7,
    });
  }

  const tomorrow = new Date(Date.parse(`${params.todayKey}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  for (const day of params.agendaDays) {
    if (day.dayKey !== params.todayKey && day.dayKey !== tomorrow) continue;
    for (const item of day.items) {
      if (item.cancelled || item.done) continue;
      const o = item.occurrence;
      out.push({
        id: `task:${o.key}`,
        kind: 'task',
        title: o.title,
        detail: [item.readerTime ?? t('agenda.allDay'), o.horse_id ? horseNames.get(o.horse_id) : null]
          .filter(Boolean)
          .join(' · '),
        dayKey: day.dayKey,
        href: `/agenda?view=day&date=${day.dayKey}`,
        urgent: false,
      });
    }
  }
  return out;
}
