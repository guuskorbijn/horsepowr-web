/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 *
 * Source: horsepowr/src/services/calendar/agendaGrouping.ts
 *
 * CLAUDE.md forbids importing the RN repo as a build dependency, and Vercel
 * builds this repo alone, so shared domain logic is copied rather than linked.
 * The copy is deliberate and checked: `npm run check:mirror` fails when this
 * file and its source have drifted, so the duplication is visible instead of
 * silent. Fix a bug in the mobile repo and re-run the mirror; never patch here.
 *
 * These modules are PURE on purpose — that is what makes them safe to mirror.
 * Anything touching Supabase, storage or React stays on its own side.
 */

import {
  addCivilDays,
  civilDayKey,
  type CivilDateTime,
} from '@/services/time/civilDate';
import { utcToZonedCivil } from '@/services/time/timezone';
import type { EventOccurrence } from '@/types/calendar';

/**
 * Groups occurrences into one bucket per day of the visible window.
 *
 * PURE, and extracted out of the hook so the one subtle rule here is testable:
 * items are bucketed by the READER's day, not the event's. A session at 23:00
 * in Shanghai belongs on the day the person looking at the agenda calls it,
 * which is a different date. Grouping by the event's own zone would scatter a
 * multi-location stable's week across the wrong columns.
 *
 * Every day in the window gets a bucket, including empty ones, so the week view
 * can render a row per day without inventing dates of its own.
 */
export interface DaySection {
  /** YYYY-MM-DD in the reader's zone. */
  dayKey: string;
  occurrences: EventOccurrence[];
}

export function groupOccurrencesByReaderDay(
  occurrences: readonly EventOccurrence[],
  windowStart: CivilDateTime,
  dayCount: number,
  readerTimeZone: string,
): DaySection[] {
  const byDay = new Map<string, EventOccurrence[]>();
  for (let i = 0; i < dayCount; i++) {
    byDay.set(civilDayKey(addCivilDays(windowStart, i)), []);
  }

  for (const occurrence of occurrences) {
    const key = civilDayKey(
      utcToZonedCivil(occurrence.starts_at, readerTimeZone),
    );
    const bucket = byDay.get(key);
    // An occurrence outside the window is dropped rather than forced into an
    // edge bucket: the caller already filtered by range, so landing here means
    // a rounding disagreement, and silently showing it on the wrong day would
    // be worse than not showing it.
    if (bucket) bucket.push(occurrence);
  }

  return [...byDay.entries()].map(([dayKey, items]) => ({
    dayKey,
    occurrences: items,
  }));
}
