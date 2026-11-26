import type { EventWriteInput } from '@/data/calendarRepository';
import { addCivilDays, parseCivilDayKey } from '@/services/time/civilDate';
import { zonedCivilToUtcIso } from '@/services/time/timezone';

/**
 * The agenda item that reminds the stable a vaccination is about to expire.
 *
 * PURE. The reminder is an ordinary all-day `vet` item, placed
 * REMINDER_LEAD_DAYS before the expiry, so it shows on both platforms, works
 * offline on the phone, and — once someone is assigned — triggers the normal
 * agenda push. No second notification mechanism to maintain.
 */
export const REMINDER_LEAD_DAYS = 14;

export function reminderEventInput(params: {
  horseId: string;
  horseName: string;
  title: string;
  /** YYYY-MM-DD */
  validUntil: string;
  timeZone: string;
  /** e.g. "{title} expires {date} ({horse})" from i18n. */
  titleTemplate: string;
  leadDays?: number;
}): EventWriteInput {
  const expiry = parseCivilDayKey(params.validUntil);
  if (expiry === null) throw new Error(`invalid validUntil: ${params.validUntil}`);
  const day = addCivilDays({ ...expiry, hour: 0, minute: 0, second: 0 }, -(params.leadDays ?? REMINDER_LEAD_DAYS));
  return {
    type: 'vet',
    title: params.titleTemplate
      .replace('{title}', params.title)
      .replace('{date}', params.validUntil)
      .replace('{horse}', params.horseName)
      .slice(0, 160),
    notes: null,
    starts_at: zonedCivilToUtcIso(day, params.timeZone),
    ends_at: null,
    all_day: true,
    timezone: params.timeZone,
    horse_id: params.horseId,
    location_id: null,
    assignee_id: null,
    targets: null,
    training_type: null,
    recurrence_rule: null,
  };
}
