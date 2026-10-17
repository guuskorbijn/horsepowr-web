import type { Supa } from '@/lib/supabase/types';
import { unwrap } from '@/data/errors';
import { parseTargetsOrNull } from '@/services/calendar/trainingTargets';
import type { CalendarEvent, CalendarEventOverride } from '@/types/calendar';

/**
 * Every Supabase call the agenda makes on web.
 *
 * Reads only, for now, and that is a scope decision rather than an oversight:
 * CLAUDE.md puts capture in the mobile app, and the agenda's WRITE path on
 * mobile is built around an offline outbox with a conflict policy that has no
 * meaning in a browser tab. Mirroring that machinery here would be mirroring
 * the hard part for none of the benefit. Web writes, when they come, will be
 * plain online writes against the same RLS.
 *
 * `training_type` is read defensively: the Phase 2 migration that adds it is a
 * proposal and may not be applied, in which case PostgREST simply omits the
 * column.
 */

interface CalendarEventRow {
  id: string;
  org_id: string;
  horse_id: string | null;
  type: CalendarEvent['type'];
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  timezone: string;
  location_id: string | null;
  assignee_id: string | null;
  status: CalendarEvent['status'];
  created_by: string;
  targets: unknown;
  training_type?: string | null;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CalendarEventOverrideRow {
  id: string;
  event_id: string;
  original_start: string;
  cancelled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  title: string | null;
  notes: string | null;
  assignee_id: string | null;
  status: CalendarEvent['status'] | null;
  targets: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

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
