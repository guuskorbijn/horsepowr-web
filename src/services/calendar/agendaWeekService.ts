import {
  addCivilDays,
  civilDayKey,
  startOfCivilWeek,
  type CivilDateTime,
} from '@/services/time/civilDate';
import {
  deviceTimeZone,
  utcToZonedCivil,
  zonedCivilToUtcIso,
} from '@/services/time/timezone';
import { groupOccurrencesByReaderDay } from '@/services/calendar/agendaGrouping';
import { queryOccurrences } from '@/services/calendar/occurrenceQuery';
import type { CalendarEvent, CalendarEventOverride } from '@/types/calendar';
import type { DaySection } from '@/services/calendar/agendaGrouping';

/**
 * A week of the agenda, assembled — PURE.
 *
 * The desktop gets a week where the phone gets a day, which is the one place
 * the two products should genuinely differ: a browser has the room, and
 * planning a week is a desk job in a way that executing a day is not.
 *
 * Everything below composes the mirrored pure modules and adds no rules of its
 * own, so the web agenda cannot disagree with the mobile one about what a
 * recurrence expands to or which day an occurrence belongs on.
 */

export interface AgendaWeek {
  /** Monday-first, seven sections, empty days included. */
  days: DaySection[];
  /** YYYY-MM-DD of the Monday. */
  startDayKey: string;
  /** YYYY-MM-DD of the Sunday. */
  endDayKey: string;
  /** The zone the week is read in. */
  readerTimeZone: string;
  /** Reported rather than logged by the pure query; surfaced by the caller. */
  truncatedEventIds: string[];
  unparseableRuleEventIds: string[];
}

export interface WeekWindow {
  startUtc: string;
  endUtc: string;
  startDayKey: string;
  endDayKey: string;
  readerTimeZone: string;
}

/**
 * The UTC window for the week containing `anchorDayKey`.
 *
 * Separate from the assembly because the repository needs the window BEFORE
 * there are any events to group — the page fetches with it, then builds.
 */
export function weekWindow(
  anchorDayKey: string | null,
  readerTimeZone: string = deviceTimeZone(),
): WeekWindow {
  const anchor = parseDayKey(anchorDayKey) ?? todayCivil(readerTimeZone);
  const monday = startOfCivilWeek(anchor, 1);
  const nextMonday = addCivilDays(monday, 7);
  return {
    startUtc: zonedCivilToUtcIso(monday, readerTimeZone),
    endUtc: zonedCivilToUtcIso(nextMonday, readerTimeZone),
    startDayKey: civilDayKey(monday),
    endDayKey: civilDayKey(addCivilDays(nextMonday, -1)),
    readerTimeZone,
  };
}

export interface BuildWeekParams {
  window: WeekWindow;
  events: readonly CalendarEvent[];
  overrides: readonly CalendarEventOverride[];
  horseId?: string;
  assigneeId?: string;
}

export function buildAgendaWeek(params: BuildWeekParams): AgendaWeek {
  const { window, events, overrides, horseId, assigneeId } = params;

  const result = queryOccurrences(events, overrides, {
    rangeStartUtc: window.startUtc,
    rangeEndUtc: window.endUtc,
    // The week view shows cancellations: a desk-bound planner needs to see
    // that the farrier is not coming, not an empty slot.
    includeCancelled: true,
    ...(horseId !== undefined ? { horseId } : {}),
    ...(assigneeId !== undefined ? { assigneeId } : {}),
  });

  const monday = parseDayKey(window.startDayKey);
  const days =
    monday === null
      ? []
      : groupOccurrencesByReaderDay(
          result.occurrences,
          monday,
          7,
          window.readerTimeZone,
        );

  return {
    days,
    startDayKey: window.startDayKey,
    endDayKey: window.endDayKey,
    readerTimeZone: window.readerTimeZone,
    truncatedEventIds: result.truncatedEventIds,
    unparseableRuleEventIds: result.unparseableRuleEventIds,
  };
}

/** The week offset by `delta` weeks, as a day key to navigate to. */
export function shiftWeek(startDayKey: string, delta: number): string {
  const monday = parseDayKey(startDayKey);
  if (monday === null) return startDayKey;
  return civilDayKey(addCivilDays(monday, delta * 7));
}

function todayCivil(readerTimeZone: string): CivilDateTime {
  return utcToZonedCivil(new Date().toISOString(), readerTimeZone);
}

function parseDayKey(dayKey: string | null): CivilDateTime | null {
  if (dayKey === null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 0,
    minute: 0,
    second: 0,
  };
}
