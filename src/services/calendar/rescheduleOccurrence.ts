import {
  getOverride,
  updateEvent,
  upsertOverride,
} from '@/data/calendarRepository';
import { moveOccurrenceToDay } from '@/services/calendar/rescheduleService';
import type { Supa } from '@/lib/supabase/types';
import type { EventOccurrence } from '@/types/calendar';

/**
 * Writing a drag to the database.
 *
 * The arithmetic is in `rescheduleService` (pure, shared with the phone); this
 * is only the part that has to know about rows. Two rules it exists to
 * enforce:
 *
 * A recurring occurrence is moved by writing an OVERRIDE keyed on its original
 * start. Dragging next Tuesday must never drag every Tuesday, and the only
 * way to guarantee that is to leave the master's rule alone.
 *
 * The override is MERGED, not replaced. An occurrence that already carries a
 * custom title or a reassignment has those fields in the same row; writing a
 * fresh override with only the new times would silently erase them. That is a
 * data-loss bug, not a styling detail, so the existing row is read first.
 */

export interface OccurrenceTimes {
  startsAt: string;
  endsAt: string | null;
}

export interface RescheduleResult {
  /** What the times were, so the move can be undone. */
  previous: OccurrenceTimes;
  next: OccurrenceTimes;
  deltaDays: number;
}

/** Writes times onto the right row: an override for a series, else the master. */
async function writeTimes(
  supa: Supa,
  occurrence: EventOccurrence,
  times: OccurrenceTimes,
): Promise<void> {
  if (occurrence.recurring && occurrence.original_start !== null) {
    const existing = await getOverride(
      supa,
      occurrence.event_id,
      occurrence.original_start,
    );
    await upsertOverride(supa, occurrence.event_id, occurrence.original_start, {
      cancelled: existing?.cancelled ?? false,
      title: existing?.title ?? null,
      notes: existing?.notes ?? null,
      assignee_id: existing?.assignee_id ?? null,
      status: existing?.status ?? null,
      targets: existing?.targets ?? null,
      starts_at: times.startsAt,
      ends_at: times.endsAt,
    });
    return;
  }
  await updateEvent(supa, occurrence.event_id, {
    starts_at: times.startsAt,
    ends_at: times.endsAt,
  });
}

/**
 * Moves an occurrence onto another day column.
 *
 * Returns null when nothing should change — dropped on its own day, or an
 * unreadable date. Both mean "do not write", and that keeps a drag that lands
 * where it started from costing a round trip and a notification.
 */
export async function rescheduleOccurrenceToDay(
  supa: Supa,
  input: {
    occurrence: EventOccurrence;
    targetDayKey: string;
    readerTimeZone: string;
  },
): Promise<RescheduleResult | null> {
  const moved = moveOccurrenceToDay({
    startsAt: input.occurrence.starts_at,
    endsAt: input.occurrence.ends_at,
    timeZone: input.occurrence.timezone,
    readerTimeZone: input.readerTimeZone,
    targetDayKey: input.targetDayKey,
  });
  if (moved === null) return null;

  const previous: OccurrenceTimes = {
    startsAt: input.occurrence.starts_at,
    endsAt: input.occurrence.ends_at,
  };
  const next: OccurrenceTimes = {
    startsAt: moved.startsAt,
    endsAt: moved.endsAt,
  };
  await writeTimes(supa, input.occurrence, next);
  return { previous, next, deltaDays: moved.deltaDays };
}

/**
 * Puts an occurrence back where it was.
 *
 * Undo writes the remembered instants directly rather than moving by minus
 * the same number of days, because re-deriving a move is a second chance to
 * get a clock change wrong. The instants are already known to be right.
 */
export async function restoreOccurrenceTimes(
  supa: Supa,
  occurrence: EventOccurrence,
  times: OccurrenceTimes,
): Promise<void> {
  await writeTimes(supa, occurrence, times);
}
