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
 * Events that could produce an occurrence in a range: anything overlapping it,
 * plus EVERY recurring master.
 *
 * The second half is not an optimisation miss — a master's own `starts_at` says
 * nothing about where its occurrences fall, so filtering masters by date would
 * silently empty a weekly series the moment you paged past its first week.
 */
export async function listEventsForRange(
  supa: Supa,
  rangeStartUtc: string,
  rangeEndUtc: string,
): Promise<CalendarEvent[]> {
  const overlapping = unwrap<CalendarEventRow[]>(
    await supa
      .from('calendar_events')
      .select('*')
      .is('deleted_at', null)
      .lt('starts_at', rangeEndUtc)
      .or(
        `ends_at.gte.${rangeStartUtc},and(ends_at.is.null,starts_at.gte.${rangeStartUtc})`,
      )
      .order('starts_at', { ascending: true }),
    'listEventsForRange',
  );

  const recurring = unwrap<CalendarEventRow[]>(
    await supa
      .from('calendar_events')
      .select('*')
      .is('deleted_at', null)
      .not('recurrence_rule', 'is', null)
      .order('starts_at', { ascending: true }),
    'listRecurringEvents',
  );

  const byId = new Map<string, CalendarEventRow>();
  for (const row of [...overlapping, ...recurring]) byId.set(row.id, row);
  return [...byId.values()].map(toEvent);
}

/** Per-occurrence deviations for a set of events. */
export async function listOverridesForEvents(
  supa: Supa,
  eventIds: readonly string[],
): Promise<CalendarEventOverride[]> {
  if (eventIds.length === 0) return [];
  const rows = unwrap<CalendarEventOverrideRow[]>(
    await supa
      .from('calendar_event_overrides')
      .select('*')
      .in('event_id', [...eventIds])
      .is('deleted_at', null),
    'listOverridesForEvents',
  );
  return rows.map(toOverride);
}

/** One event by id, or null when it is gone or not readable under RLS. */
export async function getEvent(
  supa: Supa,
  id: string,
): Promise<CalendarEvent | null> {
  const row = unwrapMaybe<CalendarEventRow>(
    await supa
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    'getEvent',
  );
  return row === null ? null : toEvent(row);
}

/** One occurrence's override, or null when that occurrence has never deviated. */
export async function getOverride(
  supa: Supa,
  eventId: string,
  originalStart: string,
): Promise<CalendarEventOverride | null> {
  const row = unwrapMaybe<CalendarEventOverrideRow>(
    await supa
      .from('calendar_event_overrides')
      .select('*')
      .eq('event_id', eventId)
      .eq('original_start', originalStart)
      .is('deleted_at', null)
      .maybeSingle(),
    'getOverride',
  );
  return row === null ? null : toOverride(row);
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
