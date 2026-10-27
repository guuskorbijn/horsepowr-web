import {
  addCivilDays,
  civilDayKey,
  parseCivilDayKey,
  startOfCivilWeek,
  type CivilDateTime,
} from '@/services/time/civilDate';
import {
  FALLBACK_TIME_ZONE,
  formatZonedTime,
  isValidTimeZone,
  utcToZonedCivil,
  zoneShortLabel,
  zonedCivilToUtcIso,
} from '@/services/time/timezone';
import { groupOccurrencesByReaderDay } from '@/services/calendar/agendaGrouping';
import { queryOccurrences } from '@/services/calendar/occurrenceQuery';
import { targetZoneSpan } from '@/services/calendar/plannedVsActualService';
import { DEFAULT_HORSE_MAX_HR } from '@/services/hrZone';
import type { ZoneKey } from '@/theme/tokens';
import type {
  CalendarEvent,
  CalendarEventOverride,
  CalendarEventType,
  EventOccurrence,
} from '@/types/calendar';

/**
 * The agenda, assembled — PURE: no I/O, no clock (today arrives as an
 * argument), no logging (problems come back in the result for the caller to
 * log).
 *
 * It composes the vendored modules (expansion, overrides, reader-day grouping)
 * and adds only what is the web's own business: a day OR a week window,
 * filters, and the display fields a card needs. Nothing here decides what a
 * recurrence expands to, so the web cannot disagree with the phone about it.
 *
 * Two clocks, both shown when they differ. Items are BUCKETED and timed on the
 * reader's clock (a stable owner in Breda reads a Mexico vet visit at the hour
 * it is for them), and the event's own wall-clock time is shown next to it
 * with the zone's name, because that is the time the vet was actually booked
 * for. Rendering only one of the two is how a multi-location stable misses an
 * appointment.
 */

export type AgendaView = 'day' | 'week';

export const AGENDA_VIEWS: readonly AgendaView[] = ['day', 'week'] as const;

export interface AgendaWindow {
  view: AgendaView;
  /** Inclusive UTC ISO start (reader's midnight). */
  startUtc: string;
  /** Exclusive UTC ISO end. */
  endUtc: string;
  /** YYYY-MM-DD, reader's zone. Monday for a week. */
  startDayKey: string;
  /** YYYY-MM-DD of the last day shown. */
  endDayKey: string;
  dayCount: number;
  readerTimeZone: string;
}

/** Narrows a query-string value to a view; anything else is the week. */
export function asAgendaView(value: string | null | undefined): AgendaView {
  return value === 'day' ? 'day' : 'week';
}

/**
 * The reader's zone, from what the browser reported. An unknown or invalid
 * value falls back to UTC, and says so, so the page can show that times are
 * in UTC instead of pretending they are local.
 */
export function resolveReaderTimeZone(reported: string | null | undefined): {
  timeZone: string;
  isFallback: boolean;
} {
  if (reported && isValidTimeZone(reported)) return { timeZone: reported, isFallback: false };
  return { timeZone: FALLBACK_TIME_ZONE, isFallback: true };
}

/** Today's day key on the reader's clock. */
export function todayDayKey(nowIso: string, readerTimeZone: string): string {
  return civilDayKey(utcToZonedCivil(nowIso, readerTimeZone));
}

/**
 * The UTC window for the day or week containing `anchorDayKey` (today when
 * absent or malformed). Separate from assembly because the repository needs
 * the window before there is anything to assemble.
 */
export function agendaWindow(params: {
  view: AgendaView;
  anchorDayKey: string | null;
  readerTimeZone: string;
  nowIso: string;
}): AgendaWindow {
  const { view, readerTimeZone } = params;
  const anchor =
    (params.anchorDayKey !== null ? parseCivilDayKey(params.anchorDayKey) : null) ??
    utcToZonedCivil(params.nowIso, readerTimeZone);
  const day = { ...anchor, hour: 0, minute: 0, second: 0 };
  const first = view === 'week' ? startOfCivilWeek(day, 1) : day;
  const dayCount = view === 'week' ? 7 : 1;
  const afterLast = addCivilDays(first, dayCount);
  return {
    view,
    startUtc: zonedCivilToUtcIso(first, readerTimeZone),
    endUtc: zonedCivilToUtcIso(afterLast, readerTimeZone),
    startDayKey: civilDayKey(first),
    endDayKey: civilDayKey(addCivilDays(afterLast, -1)),
    dayCount,
    readerTimeZone,
  };
}

/** The anchor day `delta` windows away — a day or a week per step. */
export function shiftAgenda(view: AgendaView, startDayKey: string, delta: number): string {
  const start = parseCivilDayKey(startDayKey);
  if (start === null) return startDayKey;
  return civilDayKey(addCivilDays(start, delta * (view === 'week' ? 7 : 1)));
}

export interface AgendaFilters {
  /** One horse, plus the stable-wide items that concern every horse. */
  horseId?: string;
  /** Items assigned to one person. */
  assigneeId?: string;
  types?: readonly CalendarEventType[];
}

/** A training's target, ready to print: numbers plus the Z labels they span. */
export interface AgendaTargetSummary {
  hrMinBpm: number | null;
  hrMaxBpm: number | null;
  durationMin: number | null;
  /** Never empty when there is an HR range: an HR is always shown with a Z label. */
  zones: ZoneKey[];
  /** Interval/steady blocks exist beyond the simple range. */
  blockCount: number;
}

export interface AgendaItem {
  occurrence: EventOccurrence;
  /** HH:MM on the reader's clock, or null for an all-day item. */
  readerTime: string | null;
  /** HH:MM on the event's own clock — set only when that clock differs. */
  eventLocalTime: string | null;
  /** City name of the event's zone — set only when it differs from the reader's. */
  eventZoneLabel: string | null;
  cancelled: boolean;
  done: boolean;
  /** Set for a training with a non-empty target; null otherwise. */
  target: AgendaTargetSummary | null;
}

export interface AgendaDay {
  dayKey: string;
  isToday: boolean;
  items: AgendaItem[];
}

export interface Agenda {
  window: AgendaWindow;
  days: AgendaDay[];
  /** True when no day holds an item (cancelled ones count: they are shown). */
  isEmpty: boolean;
  /** Masters cut short by a safety ceiling — the caller logs these. */
  truncatedEventIds: string[];
  /** Masters whose rule would not parse — the caller logs these. */
  unparseableRuleEventIds: string[];
}

export interface BuildAgendaParams {
  window: AgendaWindow;
  events: readonly CalendarEvent[];
  overrides: readonly CalendarEventOverride[];
  filters?: AgendaFilters;
  /** Per-horse max HR, for the Z labels on a target. Missing horses use the default. */
  maxHrByHorse?: Readonly<Record<string, number>>;
  /** Today, on the reader's clock. */
  todayKey: string;
}

export function summariseTarget(
  occurrence: EventOccurrence,
  maxHr: number,
): AgendaTargetSummary | null {
  if (occurrence.type !== 'training' || occurrence.targets === null) return null;
  const { hrMinBpm, hrMaxBpm, durationMin, blocks } = occurrence.targets;
  const min = hrMinBpm ?? null;
  const max = hrMaxBpm ?? null;
  const duration = durationMin ?? null;
  const blockCount = blocks?.length ?? 0;
  if (min === null && max === null && duration === null && blockCount === 0) return null;
  return {
    hrMinBpm: min,
    hrMaxBpm: max,
    durationMin: duration,
    zones: targetZoneSpan(min, max, maxHr),
    blockCount,
  };
}

function toItem(
  occurrence: EventOccurrence,
  readerTimeZone: string,
  maxHrByHorse: Readonly<Record<string, number>>,
): AgendaItem {
  const zonesDiffer = occurrence.timezone !== readerTimeZone;
  const maxHr =
    occurrence.horse_id === null
      ? DEFAULT_HORSE_MAX_HR
      : (maxHrByHorse[occurrence.horse_id] ?? DEFAULT_HORSE_MAX_HR);
  return {
    occurrence,
    readerTime: occurrence.all_day ? null : formatZonedTime(occurrence.starts_at, readerTimeZone),
    eventLocalTime:
      occurrence.all_day || !zonesDiffer
        ? null
        : formatZonedTime(occurrence.starts_at, occurrence.timezone),
    eventZoneLabel: zoneShortLabel(occurrence.timezone, readerTimeZone),
    cancelled: occurrence.status === 'cancelled',
    done: occurrence.status === 'done',
    target: summariseTarget(occurrence, maxHr),
  };
}

/** All-day items first, then by start, then by title, so the order is stable. */
function compareItems(a: AgendaItem, b: AgendaItem): number {
  if (a.occurrence.all_day !== b.occurrence.all_day) return a.occurrence.all_day ? -1 : 1;
  const byStart = Date.parse(a.occurrence.starts_at) - Date.parse(b.occurrence.starts_at);
  if (byStart !== 0) return byStart;
  return a.occurrence.title.localeCompare(b.occurrence.title);
}

export function buildAgenda(params: BuildAgendaParams): Agenda {
  const { window, events, overrides, filters = {}, maxHrByHorse = {}, todayKey } = params;

  // The horse filter includes stable-wide items, so it is applied here rather
  // than through queryOccurrences' exact-match `horseId`.
  const scoped =
    filters.horseId === undefined
      ? events
      : events.filter((e) => e.horse_id === filters.horseId || e.horse_id === null);

  const result = queryOccurrences(scoped, overrides, {
    rangeStartUtc: window.startUtc,
    rangeEndUtc: window.endUtc,
    // Cancellations stay visible, struck through: a planner needs to see that
    // the farrier is not coming, not an empty slot.
    includeCancelled: true,
    ...(filters.assigneeId !== undefined ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.types !== undefined && filters.types.length > 0 ? { types: filters.types } : {}),
  });

  const first: CivilDateTime | null = parseCivilDayKey(window.startDayKey);
  const sections =
    first === null
      ? []
      : groupOccurrencesByReaderDay(result.occurrences, first, window.dayCount, window.readerTimeZone);

  const days: AgendaDay[] = sections.map((section) => ({
    dayKey: section.dayKey,
    isToday: section.dayKey === todayKey,
    items: section.occurrences
      .map((o) => toItem(o, window.readerTimeZone, maxHrByHorse))
      .sort(compareItems),
  }));

  return {
    window,
    days,
    isEmpty: days.every((day) => day.items.length === 0),
    truncatedEventIds: result.truncatedEventIds,
    unparseableRuleEventIds: result.unparseableRuleEventIds,
  };
}
