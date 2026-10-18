/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 *
 * Source: horsepowr/src/services/calendar/rescheduleService.ts
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

import { addCivilDays, civilDayKey, parseCivilDayKey } from '@/services/time/civilDate';
import { utcToZonedCivil, zonedCivilToUtcIso } from '@/services/time/timezone';

/**
 * Where an agenda item lands when it is dragged onto another day.
 *
 * PURE, and shared by both products, because the easy version of this is
 * wrong in three separate ways and each one is invisible until someone misses
 * an appointment.
 *
 * 1. It moves by WHOLE DAYS in the event's own wall clock, not by adding
 *    24h × n milliseconds. Across a DST boundary those differ by an hour: a
 *    09:00 training dragged over the last Sunday in October would land at
 *    08:00 if you did the arithmetic in UTC. The horse is still worked at
 *    nine.
 * 2. The column that was dropped on is a day in the READER's zone, while the
 *    time that must be preserved is in the EVENT's zone. Dragging a Mexico
 *    City appointment while sitting in Breda has to keep Mexico's 09:00, and
 *    the two zones can disagree about which day it even is.
 * 3. Duration is carried as an absolute span. A 45-minute session is 45
 *    minutes on both sides of a clock change.
 *
 * The time of day is deliberately NOT changed. The week grid is day-columns
 * with no hour axis, so a drop position carries no information about time;
 * inventing one from the cursor's height would be a guess the user never
 * made.
 */

export interface MovedTimes {
  /** New UTC instant for the start. */
  startsAt: string;
  /** New UTC instant for the end, or null for an open-ended item. */
  endsAt: string | null;
  /** Whole days moved, signed. Useful for the undo copy. */
  deltaDays: number;
}

/**
 * Whole days from one YYYY-MM-DD to another, or null if either is unreadable.
 *
 * Computed on the civil dates themselves rather than on timestamps, so no
 * zone or clock change can make a day count come out at 0.958 of a day.
 */
export function daysBetweenDayKeys(from: string, to: string): number | null {
  const a = parseCivilDayKey(from);
  const b = parseCivilDayKey(to);
  if (!a || !b) return null;
  const aMs = Date.UTC(a.year, a.month - 1, a.day);
  const bMs = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bMs - aMs) / 86_400_000);
}

export interface MoveToDayInput {
  /** The occurrence's current start, as a UTC instant. */
  startsAt: string;
  /** Its current end, or null. */
  endsAt: string | null;
  /** The zone the EVENT happens in. Its wall clock is what is preserved. */
  timeZone: string;
  /** The zone the agenda's day columns are expressed in. */
  readerTimeZone: string;
  /** The day column it was dropped on, YYYY-MM-DD in `readerTimeZone`. */
  targetDayKey: string;
}

/**
 * The new start and end, or null when nothing should change.
 *
 * Null covers both "dropped back where it came from" and "the input could not
 * be read". Both mean the same thing to the caller — do not write — and
 * collapsing them keeps a drag that lands on its own column from generating a
 * pointless round trip and a pointless notification.
 */
export function moveOccurrenceToDay(input: MoveToDayInput): MovedTimes | null {
  const sourceDayKey = civilDayKey(
    utcToZonedCivil(input.startsAt, input.readerTimeZone),
  );
  const deltaDays = daysBetweenDayKeys(sourceDayKey, input.targetDayKey);
  if (deltaDays === null || deltaDays === 0) return null;

  const civil = utcToZonedCivil(input.startsAt, input.timeZone);
  const startsAt = zonedCivilToUtcIso(
    addCivilDays(civil, deltaDays),
    input.timeZone,
  );

  const durationMs =
    input.endsAt === null
      ? null
      : Date.parse(input.endsAt) - Date.parse(input.startsAt);
  const endsAt =
    durationMs === null || Number.isNaN(durationMs)
      ? null
      : new Date(Date.parse(startsAt) + durationMs).toISOString();

  return { startsAt, endsAt, deltaDays };
}
