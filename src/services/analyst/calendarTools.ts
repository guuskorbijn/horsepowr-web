/**
 * Read-only agenda tools for the analyst chat: what is planned, and how a
 * session compared to the plan it was ridden against.
 *
 * Same guarantees as the other analyst tools: org scope comes from the
 * signed-in user's org id and every read runs under RLS through the
 * repositories, with an explicit org re-check on top (defense-in-depth, as in
 * list_horses/list_sessions). Event titles and notes are typed by people and
 * reach the model only inside tool results, as data.
 */
import type { Supa } from '@/lib/supabase/types';
import { listEvents, listOverrides } from '@/data/calendarRepository';
import { getHorse, listHorses } from '@/data/horseRepository';
import { listOrgProfiles } from '@/data/profileRepository';
import { getSession } from '@/data/sessionRepository';
import { getMeasurements } from '@/data/measurementRepository';
import { queryOccurrences } from '@/services/calendar/occurrenceQuery';
import { summariseTarget } from '@/services/calendar/agendaService';
import { buildPlannedComparison } from '@/services/calendar/plannedComparison';
import { targetZoneSpan } from '@/services/calendar/plannedVsActualService';
import { resolveRange } from '@/services/time/dateBounds';
import { utcToZonedCivil } from '@/services/time/timezone';
import { DEFAULT_HORSE_MAX_HR } from '@/services/hrZone';
import type {
  AnalystEventOccurrence,
  AnalystPlannedVsActual,
  GetPlannedVsActualInput,
  ListEventsInput,
  ListEventsResult,
} from '@/services/analyst/types';

export const DEFAULT_EVENT_LIMIT = 50;
export const MAX_EVENT_LIMIT = 200;
/** Default look-ahead when the model gives no `to`. */
export const DEFAULT_EVENT_WINDOW_DAYS = 14;
/** Widest window one call may expand: a year. Wider asks are refused, not cut. */
export const MAX_EVENT_WINDOW_DAYS = 366;

const DAY_MS = 86_400_000;

function dayKeyOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Fills in a missing bound: no `from` means today (UTC), or 14 days before
 * an explicit `to`; no `to` means 14 days after `from`. Throws a RangeError
 * naming the problem for a reversed or over-wide window.
 */
export function resolveEventWindow(
  input: Pick<ListEventsInput, 'from' | 'to'>,
  nowIso: string,
): { from: string; to: string; startUtc: string; endUtc: string } {
  const nowMs = Date.parse(nowIso);
  let from = input.from;
  let to = input.to;
  if (from === undefined && to !== undefined) {
    const toMs = resolveRange(to, to).startUtc;
    from = dayKeyOf(Date.parse(toMs) - DEFAULT_EVENT_WINDOW_DAYS * DAY_MS);
  }
  from ??= dayKeyOf(nowMs);
  if (to === undefined) {
    const fromStart = resolveRange(from, from).startUtc;
    to = dayKeyOf(Date.parse(fromStart) + DEFAULT_EVENT_WINDOW_DAYS * DAY_MS);
  }
  const { startUtc, endUtc } = resolveRange(from, to);
  if (Date.parse(endUtc) - Date.parse(startUtc) > MAX_EVENT_WINDOW_DAYS * DAY_MS) {
    throw new RangeError(`The window may span at most ${MAX_EVENT_WINDOW_DAYS} days; ask for a shorter range.`);
  }
  return { from, to, startUtc, endUtc };
}

function localStart(startsAt: string, timeZone: string): string {
  const c = utcToZonedCivil(startsAt, timeZone);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${c.year}-${p2(c.month)}-${p2(c.day)} ${p2(c.hour)}:${p2(c.minute)}`;
}

export async function listEventsForAnalyst(
  supa: Supa,
  orgId: string,
  input: ListEventsInput,
  nowIso: string,
): Promise<ListEventsResult> {
  const window = resolveEventWindow(input, nowIso);
  const limit = Math.min(MAX_EVENT_LIMIT, Math.max(1, input.limit ?? DEFAULT_EVENT_LIMIT));
  const empty: ListEventsResult = { from: window.from, to: window.to, events: [], count: 0, truncated: false };

  if (input.horseId !== undefined) {
    const horse = await getHorse(supa, input.horseId);
    // Not in this stable (or not visible under RLS): nothing, without saying why.
    if (!horse || horse.org_id !== orgId) return empty;
  }

  const [events, horses, people] = await Promise.all([
    listEvents(supa, {
      orgId,
      from: window.from,
      to: window.to,
      ...(input.horseId !== undefined ? { horseId: input.horseId } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.type !== undefined ? { types: [input.type] } : {}),
    }),
    listHorses(supa, orgId),
    listOrgProfiles(supa, orgId),
  ]);
  // Defense-in-depth: the repository already filters by org and RLS enforces
  // it; this re-check means a policy regression still cannot leak an event —
  // including a stable-wide one, which has no horse to check through.
  const own = events.filter((event) => event.org_id === orgId);
  const overrides = await listOverrides(supa, own.map((event) => event.id));

  const result = queryOccurrences(own, overrides, {
    rangeStartUtc: window.startUtc,
    rangeEndUtc: window.endUtc,
    includeCancelled: true,
    ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    ...(input.type !== undefined ? { types: [input.type] } : {}),
  });

  const horseById = new Map(horses.filter((h) => h.org_id === orgId).map((h) => [h.id, h]));
  const personName = new Map(people.map((p) => [p.id, p.name ?? p.email ?? null]));

  const mapped: AnalystEventOccurrence[] = result.occurrences.slice(0, limit).map((o) => {
    const horse = o.horse_id === null ? undefined : horseById.get(o.horse_id);
    return {
      eventId: o.event_id,
      occurrenceStart: o.original_start,
      type: o.type,
      status: o.status,
      title: o.title,
      notes: o.notes,
      startsAt: o.starts_at,
      endsAt: o.ends_at,
      allDay: o.all_day,
      timeZone: o.timezone,
      localStart: localStart(o.starts_at, o.timezone),
      horseId: o.horse_id,
      horseName: horse?.name ?? null,
      assigneeId: o.assignee_id,
      assigneeName: o.assignee_id === null ? null : (personName.get(o.assignee_id) ?? null),
      recurring: o.recurring,
      target: (() => {
        const summary = summariseTarget(o, horse?.max_hr ?? DEFAULT_HORSE_MAX_HR);
        return summary === null
          ? null
          : {
              hrMinBpm: summary.hrMinBpm,
              hrMaxBpm: summary.hrMaxBpm,
              zones: summary.zones,
              durationMin: summary.durationMin,
              blockCount: summary.blockCount,
            };
      })(),
    };
  });

  return {
    from: window.from,
    to: window.to,
    events: mapped,
    count: mapped.length,
    truncated: result.occurrences.length > limit,
  };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Planned vs measured for one session, or null when the session is not in
 * this stable (RLS hides it, or the org re-check refuses it).
 */
export async function getPlannedVsActualForAnalyst(
  supa: Supa,
  orgId: string,
  input: GetPlannedVsActualInput,
): Promise<AnalystPlannedVsActual | null> {
  const session = await getSession(supa, input.sessionId);
  if (!session) return null;
  const horse = await getHorse(supa, session.horse_id);
  if (!horse || horse.org_id !== orgId) return null;

  if ((session.planned_event_id ?? null) === null) {
    return { sessionId: session.id, status: 'unplanned' };
  }
  const rows = await getMeasurements(supa, session.id);
  const planned = buildPlannedComparison(session, rows, horse.max_hr);

  if (planned.kind === 'unplanned') return { sessionId: session.id, status: 'unplanned' };
  if (planned.kind === 'linked-without-snapshot') {
    return {
      sessionId: session.id,
      status: 'no_snapshot',
      plannedEventId: planned.plannedEventId,
      note: 'The session was started from a planned item, but the plan as it stood at the start was not saved with it, so there is nothing to compare against.',
    };
  }

  const { duration, hr, hrOmittedReason, coverage } = planned.comparison;
  return {
    sessionId: session.id,
    status: 'compared',
    plannedEventId: planned.plannedEventId,
    horseName: horse.name,
    plannedDurationMin: duration.plannedMs === null ? null : round1(duration.plannedMs / 60_000),
    measuredDurationMin: round1(duration.measuredMs / 60_000),
    durationDeltaMin: duration.deltaMs === null ? null : round1(duration.deltaMs / 60_000),
    // From the snapshot's band rather than the HR comparison, so a plan's
    // range is still reported when the sensor recorded nothing.
    target:
      planned.targetBand === null
        ? null
        : {
            hrMinBpm: planned.targetBand.minBpm,
            hrMaxBpm: planned.targetBand.maxBpm,
            zones: targetZoneSpan(planned.targetBand.minBpm, planned.targetBand.maxBpm, horse.max_hr),
          },
    hrOmittedReason,
    measuredAvgHr: hr?.measuredAvgBpm ?? null,
    measuredPeakHr: hr?.measuredPeakBpm ?? null,
    insidePct: hr?.insidePct == null ? null : round1(hr.insidePct),
    belowPct: hr?.belowPct == null ? null : round1(hr.belowPct),
    abovePct: hr?.abovePct == null ? null : round1(hr.abovePct),
    hrCoveragePct: round1(coverage.coveragePct),
    uncountedGapCount: coverage.uncountedGapCount,
    uncountedGapSec: Math.round(coverage.uncountedGapMs / 1000),
  };
}
