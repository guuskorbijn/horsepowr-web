import type { Supa } from '@/lib/supabase/types';
import { unwrap, unwrapMaybe, RepositoryError } from '@/data/errors';
import { parseTargetsOrNull } from '@/services/calendar/trainingTargets';
import type { TrainingTargets } from '@/services/calendar/trainingTargets';
import type {
  CalendarEvent,
  CalendarEventOverride,
  CalendarEventStatus,
  CalendarEventType,
} from '@/types/calendar';
import type { CalendarEventRow, CalendarEventOverrideRow } from '@/types/db';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  parseCalendarEventOverrideRow,
  parseCalendarEventRow,
} from '@/types/calendarSchemas';
import { resolveRange } from '@/services/time/dateBounds';
import { log } from '@/lib/log';

/**
 * Every Supabase call the agenda makes on web.
 *
 * Reads and writes. The writes are deliberately PLAIN and online — no outbox,
 * no conflict policy, no tombstone merge. The phone needs that machinery
 * because a trainer edits an appointment in a field with no signal; a browser
 * tab either reaches the server or shows an error. Mirroring the hard part
 * here would buy nothing. The same RLS gates both: trainer-only writes,
 * org-scoped, and a hard DELETE is refused by the database, so removal is a
 * `deleted_at` tombstone exactly as it is on mobile.
 *
 * `training_type` is handled defensively in both directions: the Phase 2
 * migration that adds it is still a proposal, so PostgREST may not know the
 * column. On read it is simply absent; on write, a rejection naming it is
 * retried without it (see `writeTolerantly`) so a pending migration can never
 * block someone from planning a training.
 */

function toEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    org_id: row.org_id,
    horse_id: row.horse_id,
    type: row.type,
    title: row.title,
    notes: row.notes,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    all_day: row.all_day,
    timezone: row.timezone,
    location_id: row.location_id,
    assignee_id: row.assignee_id,
    status: row.status,
    created_by: row.created_by,
    targets: parseTargetsOrNull(row.targets, { eventId: row.id }),
    training_type: row.training_type ?? null,
    recurrence_rule: row.recurrence_rule,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function toOverride(row: CalendarEventOverrideRow): CalendarEventOverride {
  return {
    id: row.id,
    event_id: row.event_id,
    original_start: row.original_start,
    cancelled: row.cancelled,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    title: row.title,
    notes: row.notes,
    assignee_id: row.assignee_id,
    status: row.status,
    targets: parseTargetsOrNull(row.targets, { eventId: row.event_id }),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

/**
 * Validates rows at the boundary. A row that does not match the DDL is logged
 * and dropped: one corrupt appointment must not blank a stable's whole week,
 * and the log line is what keeps that from being a silent loss.
 */
function validEvents(rows: readonly unknown[], context: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const raw of rows) {
    const parsed = parseCalendarEventRow(raw);
    if (parsed.ok) events.push(toEvent(parsed.row));
    else log.error(`${context}: dropping calendar_events row that fails validation`, { error: parsed.error });
  }
  return events;
}

function validOverrides(rows: readonly unknown[], context: string): CalendarEventOverride[] {
  const overrides: CalendarEventOverride[] = [];
  for (const raw of rows) {
    const parsed = parseCalendarEventOverrideRow(raw);
    if (parsed.ok) overrides.push(toOverride(parsed.row));
    else log.error(`${context}: dropping calendar_event_overrides row that fails validation`, { error: parsed.error });
  }
  return overrides;
}

/**
 * Page size for every calendar read.
 *
 * Kept BELOW PostgREST's default `max-rows` (1000). Pagination stops only on
 * an EMPTY page, never on a short one, so a server configured with a lower
 * cap than this still returns everything instead of quietly stopping at the
 * cap — the bug a "fewer rows than asked for means done" loop has.
 */
export const CALENDAR_PAGE_SIZE = 500;

/** Upper bound on pages per read; reaching it is an error, never a cut. */
const MAX_PAGES = 200;

/** How many ids go into one `in (...)` filter, to keep the URL bounded. */
const ID_CHUNK = 100;

/**
 * Reads every page of a query ordered by a stable key. The ordering MUST end
 * in a unique column (`id`) so no row can sit on a page boundary in two
 * different positions; the map below drops any row seen twice anyway.
 */
async function readAllPages(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>,
  context: string,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let index = 0; index < MAX_PAGES; index++) {
    const offset = rows.length;
    const batch = unwrap<unknown[]>(await page(offset, offset + CALENDAR_PAGE_SIZE - 1), context);
    if (batch.length === 0) return rows;
    rows.push(...batch);
  }
  throw new RepositoryError(
    `${context}: more than ${MAX_PAGES * CALENDAR_PAGE_SIZE} rows; refusing to return a partial agenda`,
  );
}

function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) byId.set(item.id, item);
  return [...byId.values()];
}

interface EventScope {
  /** The caller's org. Defense-in-depth on top of RLS, never instead of it. */
  orgId: string;
  /** One horse. Stable-wide items are included unless `includeStableWide` is false. */
  horseId?: string;
  /** Items assigned to one person. */
  assigneeId?: string;
  types?: readonly CalendarEventType[];
  /** Default true: a farrier visit for the whole yard concerns every horse. */
  includeStableWide?: boolean;
}

export interface ListEventsFilter extends EventScope {
  /** Inclusive start: an ISO instant or a date-only `YYYY-MM-DD`. */
  from: string;
  /** End: an ISO instant (inclusive) or a date-only day (the whole UTC day). */
  to: string;
}

export interface EventWindowFilter extends EventScope {
  /** Inclusive UTC ISO start. */
  startUtc: string;
  /** Exclusive UTC ISO end. */
  endUtc: string;
}

/**
 * Events for a range given as text (the analyst's `from`/`to`). Date-only
 * bounds cover whole UTC days; a bad bound throws a RangeError naming it.
 */
export async function listEvents(
  supa: Supa,
  filter: ListEventsFilter,
): Promise<CalendarEvent[]> {
  const { from, to, ...scope } = filter;
  const { startUtc, endUtc } = resolveRange(from, to);
  return listEventsInWindow(supa, { ...scope, startUtc, endUtc });
}

/**
 * Events that can produce an occurrence inside a half-open window.
 *
 * Two queries, because the two kinds of row are bounded differently:
 *  - one-offs overlapping the window: `starts_at < end` and the item has not
 *    ended before `start` (an open-ended item counts from its start);
 *  - recurring masters that have STARTED before the window ends. Where the
 *    series ends is unknown here (UNTIL/COUNT live in the rule text), so a
 *    master that started in 2025 is still fetched — the pure expansion
 *    decides whether it reaches the window.
 *
 * Tombstones (`deleted_at`) never leave this function. Cancelled status does:
 * the display layer decides whether to strike an item through or hide it.
 */
export async function listEventsInWindow(
  supa: Supa,
  filter: EventWindowFilter,
): Promise<CalendarEvent[]> {
  const { startUtc, endUtc } = filter;
  const includeStableWide = filter.includeStableWide ?? true;

  const scoped = () => {
    let query = supa
      .from('calendar_events')
      .select('*')
      .eq('org_id', filter.orgId)
      .is('deleted_at', null)
      .lt('starts_at', endUtc);
    if (filter.assigneeId !== undefined) query = query.eq('assignee_id', filter.assigneeId);
    if (filter.types !== undefined && filter.types.length > 0) query = query.in('type', [...filter.types]);
    // The inclusive horse filter ("this horse, or the whole yard") is applied
    // in memory below: it is an OR, and the one-off query already needs the
    // one `or` filter PostgREST can be relied on to AND with the rest.
    if (filter.horseId !== undefined && !includeStableWide) query = query.eq('horse_id', filter.horseId);
    return query;
  };

  const [oneOffRows, recurringRows] = await Promise.all([
    readAllPages(
      (from, to) =>
        scoped()
          .is('recurrence_rule', null)
          .or(`ends_at.gte.${startUtc},and(ends_at.is.null,starts_at.gte.${startUtc})`)
          .order('starts_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      'listEventsInWindow(one-off)',
    ),
    readAllPages(
      (from, to) =>
        scoped()
          .not('recurrence_rule', 'is', null)
          .order('starts_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      'listEventsInWindow(recurring)',
    ),
  ]);

  const events = validEvents([...oneOffRows, ...recurringRows], 'listEventsInWindow');
  // Defense-in-depth: RLS already scopes to the caller's org; this guarantees
  // a policy regression can never put another stable's appointment on screen.
  return dedupeById(events).filter(
    (event) =>
      event.org_id === filter.orgId &&
      (filter.horseId === undefined || event.horse_id === filter.horseId || event.horse_id === null),
  );
}

/**
 * Per-occurrence deviations for a set of events, tombstones excluded.
 * Chunked and paginated, so a busy stable cannot hit the row cap.
 */
export async function listOverrides(
  supa: Supa,
  eventIds: readonly string[],
): Promise<CalendarEventOverride[]> {
  const unique = [...new Set(eventIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += ID_CHUNK) chunks.push(unique.slice(i, i + ID_CHUNK));

  const pages = await Promise.all(
    chunks.map((ids) =>
      readAllPages(
        (from, to) =>
          supa
            .from('calendar_event_overrides')
            .select('*')
            .in('event_id', ids)
            .is('deleted_at', null)
            .order('original_start', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        'listOverrides',
      ),
    ),
  );
  return dedupeById(validOverrides(pages.flat(), 'listOverrides'));
}

/** One event by id, or null when it is gone or not readable under RLS. */
export async function getEvent(
  supa: Supa,
  id: string,
): Promise<CalendarEvent | null> {
  const row = unwrapMaybe<unknown>(
    await supa
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    'getEvent',
  );
  return row === null ? null : (validEvents([row], 'getEvent')[0] ?? null);
}

/** One occurrence's override, or null when that occurrence has never deviated. */
export async function getOverride(
  supa: Supa,
  eventId: string,
  originalStart: string,
): Promise<CalendarEventOverride | null> {
  const row = unwrapMaybe<unknown>(
    await supa
      .from('calendar_event_overrides')
      .select('*')
      .eq('event_id', eventId)
      .eq('original_start', originalStart)
      .is('deleted_at', null)
      .maybeSingle(),
    'getOverride',
  );
  return row === null ? null : (validOverrides([row], 'getOverride')[0] ?? null);
}

/** The writable shape of an event, shared by create and update. */
export interface EventWriteInput {
  type: CalendarEventType;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  timezone: string;
  horse_id: string | null;
  location_id: string | null;
  assignee_id: string | null;
  targets: TrainingTargets | null;
  training_type: string | null;
  recurrence_rule: string | null;
}

/**
 * Runs a write, and retries it once without `training_type` if the server says
 * it does not know that column.
 *
 * The RN repo solves this with `pendingColumns.ts` for the same reason: the
 * Phase 2 migration is a proposal, and a planning screen that refuses to save
 * because of an unapplied migration is a worse failure than one that saves the
 * other fourteen fields. PostgREST reports the unknown column as PGRST204;
 * Postgres itself reports 42703 if the request reaches it.
 */
const UNKNOWN_COLUMN_CODES = new Set(['PGRST204', '42703']);

async function writeTolerantly<T>(
  attempt: (payload: Record<string, unknown>) => Promise<T>,
  payload: Record<string, unknown>,
): Promise<T> {
  try {
    return await attempt(payload);
  } catch (err: unknown) {
    const code = err instanceof RepositoryError ? err.cause?.code : undefined;
    const mentionsPending =
      code !== undefined &&
      UNKNOWN_COLUMN_CODES.has(code) &&
      'training_type' in payload;
    if (!mentionsPending) throw err;
    const { training_type: _pending, ...rest } = payload;
    void _pending;
    return attempt(rest);
  }
}

/**
 * Creates an event.
 *
 * The id is generated here rather than by the database, matching mobile: the
 * client-generated uuid is the idempotency key, so a create that is retried
 * after a timeout cannot produce a duplicate appointment.
 */
export async function createEvent(
  supa: Supa,
  input: EventWriteInput,
  ctx: { orgId: string; userId: string },
): Promise<CalendarEvent> {
  const payload: Record<string, unknown> = {
    ...input,
    id: crypto.randomUUID(),
    org_id: ctx.orgId,
    created_by: ctx.userId,
    status: 'planned' satisfies CalendarEventStatus,
  };
  const row = await writeTolerantly(
    async (body) =>
      unwrap<CalendarEventRow>(
        await supa
          .from('calendar_events')
          .insert(body as never)
          .select('*')
          .single(),
        'createEvent',
      ),
    payload,
  );
  return toEvent(row);
}

/** Updates the master event — i.e. the whole series, for a recurring item. */
export async function updateEvent(
  supa: Supa,
  id: string,
  input: Partial<EventWriteInput> & { status?: CalendarEventStatus },
): Promise<CalendarEvent> {
  const row = await writeTolerantly(
    async (body) =>
      unwrap<CalendarEventRow>(
        await supa
          .from('calendar_events')
          .update(body as never)
          .eq('id', id)
          .select('*')
          .single(),
        'updateEvent',
      ),
    { ...input },
  );
  return toEvent(row);
}

/**
 * Removes an event by writing a tombstone.
 *
 * Not a DELETE: `calendar_events` has no DELETE policy on purpose, so the
 * database refuses one. The trigger also refuses to clear `deleted_at` again,
 * which is what stops a stale client resurrecting a cancelled appointment.
 */
export async function softDeleteEvent(supa: Supa, id: string): Promise<void> {
  unwrap<CalendarEventRow>(
    await supa
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single(),
    'softDeleteEvent',
  );
}

/** The writable shape of a single occurrence's deviation. */
export interface OverrideWriteInput {
  cancelled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  title: string | null;
  notes: string | null;
  assignee_id: string | null;
  status: CalendarEventStatus | null;
  targets: TrainingTargets | null;
}

/**
 * Writes one occurrence's deviation, keyed by its ORIGINAL start.
 *
 * An upsert rather than a read-then-write: `(event_id, original_start)` is
 * unique, so two trainers editing the same occurrence at once resolve to
 * last-write-wins at the database instead of one of them getting a duplicate
 * key error. The master's rule is never touched, so the rest of the series
 * stays exactly as it was.
 */
export async function upsertOverride(
  supa: Supa,
  eventId: string,
  originalStart: string,
  input: OverrideWriteInput,
): Promise<CalendarEventOverride> {
  const row = unwrap<CalendarEventOverrideRow>(
    await supa
      .from('calendar_event_overrides')
      .upsert(
        {
          event_id: eventId,
          original_start: originalStart,
          ...input,
        } as never,
        { onConflict: 'event_id,original_start' },
      )
      .select('*')
      .single(),
    'upsertOverride',
  );
  return toOverride(row);
}
