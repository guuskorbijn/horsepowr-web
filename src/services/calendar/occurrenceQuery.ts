/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 *
 * Source: horsepowr/src/services/calendar/occurrenceQuery.ts
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
  expandRecurrence,
  parseRecurrenceRule,
  type RecurrenceRule,
} from './recurrenceService';
import type {
  CalendarEvent,
  CalendarEventOverride,
  CalendarEventType,
  EventOccurrence,
} from '@/types/calendar';

/**
 * Turns stored rows into the ordered list the agenda renders.
 *
 * PURE. Given the same rows and range it returns the same occurrences, which is
 * what lets the day view, the week view and the per-horse view all be the same
 * function with different filters instead of three near-identical queries.
 *
 * Three kinds of input are reconciled here:
 *   1. one-off events          → at most one occurrence each
 *   2. recurring masters       → expanded over the range, nothing materialised
 *   3. per-occurrence overrides → applied by exact `original_start` match
 *
 * Soft-deleted rows and cancelled occurrences are dropped unless explicitly
 * asked for, so no caller can accidentally render a tombstone.
 */

export interface OccurrenceQuery {
  /** Inclusive UTC ISO start of the window. */
  rangeStartUtc: string;
  /** Exclusive UTC ISO end of the window. */
  rangeEndUtc: string;
  /** Restrict to one horse. `null` matches only stable-wide (horse-less) items. */
  horseId?: string | null;
  /** Restrict to one assignee. */
  assigneeId?: string;
  /** Restrict to these types. Empty/undefined means all types. */
  types?: readonly CalendarEventType[];
  /** Include cancelled items (the detail screen does; the agenda does not). */
  includeCancelled?: boolean;
}

export interface OccurrenceQueryResult {
  occurrences: EventOccurrence[];
  /**
   * Ids of masters whose expansion hit a safety ceiling, and masters whose
   * `recurrence_rule` would not parse. Returned rather than logged so this
   * function stays pure — the caller logs, and nothing is swallowed.
   */
  truncatedEventIds: string[];
  unparseableRuleEventIds: string[];
}

function overrideKey(eventId: string, originalStart: string): string {
  // Normalised to an exact instant so a row written as '…+00:00' and one
  // written as '…Z' still match the same expanded occurrence.
  return `${eventId}@${new Date(originalStart).toISOString()}`;
}

function matchesFilters(event: CalendarEvent, query: OccurrenceQuery): boolean {
  if (query.types && query.types.length > 0 && !query.types.includes(event.type)) {
    return false;
  }
  if (query.horseId !== undefined && event.horse_id !== query.horseId) return false;
  if (query.assigneeId !== undefined && event.assignee_id !== query.assigneeId) {
    return false;
  }
  return true;
}

function baseOccurrence(event: CalendarEvent): Omit<
  EventOccurrence,
  'key' | 'original_start' | 'recurring' | 'starts_at'
> {
  return {
    event_id: event.id,
    horse_id: event.horse_id,
    type: event.type,
    title: event.title,
    notes: event.notes,
    ends_at: event.ends_at,
    all_day: event.all_day,
    timezone: event.timezone,
    location_id: event.location_id,
    assignee_id: event.assignee_id,
    status: event.status,
    targets: event.targets,
  };
}

/**
 * Applies an override on top of an expanded occurrence.
 *
 * Returns null when the override cancels the occurrence or is itself
 * soft-deleted-and-cancelled, i.e. when the item should not appear at all.
 */
function applyOverride(
  occurrence: EventOccurrence,
  override: CalendarEventOverride | undefined,
  includeCancelled: boolean,
): EventOccurrence | null {
  if (!override || override.deleted_at !== null) return occurrence;
  if (override.cancelled && !includeCancelled) return null;

  // An override's duration follows its moved start: keeping the master's
  // absolute ends_at after a move would silently invert the interval.
  const moved = override.starts_at !== null;
  const ends =
    override.ends_at !== null
      ? override.ends_at
      : moved
        ? shiftEnd(occurrence.starts_at, override.starts_at, occurrence.ends_at)
        : occurrence.ends_at;

  return {
    ...occurrence,
    starts_at: override.starts_at ?? occurrence.starts_at,
    ends_at: ends,
    title: override.title ?? occurrence.title,
    notes: override.notes ?? occurrence.notes,
    assignee_id: override.assignee_id ?? occurrence.assignee_id,
    status: override.cancelled ? 'cancelled' : (override.status ?? occurrence.status),
    targets: override.targets ?? occurrence.targets,
  };
}

/** Preserves an occurrence's duration when its start is moved. */
function shiftEnd(
  originalStart: string,
  newStart: string | null,
  originalEnd: string | null,
): string | null {
  if (originalEnd === null || newStart === null) return originalEnd;
  const durationMs = Date.parse(originalEnd) - Date.parse(originalStart);
  if (Number.isNaN(durationMs)) return originalEnd;
  return new Date(Date.parse(newStart) + durationMs).toISOString();
}

export function queryOccurrences(
  events: readonly CalendarEvent[],
  overrides: readonly CalendarEventOverride[],
  query: OccurrenceQuery,
): OccurrenceQueryResult {
  const rangeStartMs = Date.parse(query.rangeStartUtc);
  const rangeEndMs = Date.parse(query.rangeEndUtc);
  const includeCancelled = query.includeCancelled ?? false;

  if (Number.isNaN(rangeStartMs) || Number.isNaN(rangeEndMs) || rangeEndMs <= rangeStartMs) {
    return { occurrences: [], truncatedEventIds: [], unparseableRuleEventIds: [] };
  }

  const overridesByKey = new Map<string, CalendarEventOverride>();
  for (const override of overrides) {
    overridesByKey.set(overrideKey(override.event_id, override.original_start), override);
  }

  const occurrences: EventOccurrence[] = [];
  const truncatedEventIds: string[] = [];
  const unparseableRuleEventIds: string[] = [];

  for (const event of events) {
    if (event.deleted_at !== null) continue;
    if (!matchesFilters(event, query)) continue;
    if (event.status === 'cancelled' && !includeCancelled) continue;

    if (event.recurrence_rule === null || event.recurrence_rule.trim().length === 0) {
      const startMs = Date.parse(event.starts_at);
      if (Number.isNaN(startMs) || startMs < rangeStartMs || startMs >= rangeEndMs) {
        continue;
      }
      occurrences.push({
        ...baseOccurrence(event),
        key: event.id,
        original_start: null,
        recurring: false,
        starts_at: event.starts_at,
      });
      continue;
    }

    const parsed = parseRecurrenceRule(event.recurrence_rule);
    if (!parsed.ok) {
      // The master itself is still shown at its anchor instant: a rule we
      // cannot read must not make a real vet appointment disappear.
      unparseableRuleEventIds.push(event.id);
      const startMs = Date.parse(event.starts_at);
      if (!Number.isNaN(startMs) && startMs >= rangeStartMs && startMs < rangeEndMs) {
        occurrences.push({
          ...baseOccurrence(event),
          key: event.id,
          original_start: null,
          recurring: false,
          starts_at: event.starts_at,
        });
      }
      continue;
    }

    pushExpanded(
      event,
      parsed.rule,
      query,
      overridesByKey,
      includeCancelled,
      occurrences,
      truncatedEventIds,
    );
  }

  occurrences.sort(compareOccurrences);
  return { occurrences, truncatedEventIds, unparseableRuleEventIds };
}

function pushExpanded(
  event: CalendarEvent,
  rule: RecurrenceRule,
  query: OccurrenceQuery,
  overridesByKey: Map<string, CalendarEventOverride>,
  includeCancelled: boolean,
  out: EventOccurrence[],
  truncatedEventIds: string[],
): void {
  // Widen the expansion window by a day on each side so an occurrence MOVED by
  // an override into the visible range is not missed, and one moved out of it
  // is correctly dropped below.
  const pad = 86_400_000;
  const expansion = expandRecurrence({
    rule,
    dtstartUtc: event.starts_at,
    timeZone: event.timezone,
    rangeStartUtc: new Date(Date.parse(query.rangeStartUtc) - pad).toISOString(),
    rangeEndUtc: new Date(Date.parse(query.rangeEndUtc) + pad).toISOString(),
  });
  if (expansion.truncated) truncatedEventIds.push(event.id);

  const rangeStartMs = Date.parse(query.rangeStartUtc);
  const rangeEndMs = Date.parse(query.rangeEndUtc);

  // Each occurrence's end is derived from the master's DURATION, not from its
  // absolute `ends_at`. The master's end instant belongs to the FIRST
  // occurrence only; copying it onto later ones left every occurrence after the
  // first claiming it ended days before it started.
  const masterDurationMs =
    event.ends_at === null
      ? null
      : Date.parse(event.ends_at) - Date.parse(event.starts_at);

  for (const originalStart of expansion.starts) {
    const candidate: EventOccurrence = {
      ...baseOccurrence(event),
      key: overrideKey(event.id, originalStart),
      original_start: originalStart,
      recurring: true,
      starts_at: originalStart,
      ends_at:
        masterDurationMs === null || Number.isNaN(masterDurationMs)
          ? null
          : new Date(Date.parse(originalStart) + masterDurationMs).toISOString(),
    };
    const resolved = applyOverride(
      candidate,
      overridesByKey.get(overrideKey(event.id, originalStart)),
      includeCancelled,
    );
    if (!resolved) continue;

    const effectiveMs = Date.parse(resolved.starts_at);
    if (Number.isNaN(effectiveMs)) continue;
    if (effectiveMs < rangeStartMs || effectiveMs >= rangeEndMs) continue;
    out.push(resolved);
  }
}

/**
 * Agenda order: by start instant, then all-day items first (they head the day),
 * then by title so the list is stable across renders rather than dependent on
 * row order from the store.
 */
function compareOccurrences(a: EventOccurrence, b: EventOccurrence): number {
  const byStart = Date.parse(a.starts_at) - Date.parse(b.starts_at);
  if (byStart !== 0) return byStart;
  if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
  const byTitle = a.title.localeCompare(b.title);
  if (byTitle !== 0) return byTitle;
  return a.key.localeCompare(b.key);
}
