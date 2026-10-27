/**
 * Tool registry + dispatcher for the analyst chat. This is the ONLY surface the
 * model can reach: five read-only, org-scoped tools. Each definition is a plain
 * JSON-schema tool (typed against the SDK's Tool shape); dispatchAnalystTool
 * validates the model's raw input, calls the matching service, and returns a
 * JSON-serialisable result. All DB access stays behind the repositories the
 * services call — nothing here touches Supabase directly.
 *
 * The stubbed tools (get_horse_trend, get_stable_benchmark, compare_sessions)
 * are intentionally NOT registered here yet — their service signatures exist in
 * stubs.ts, ready to slot in once implemented.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { Supa } from '@/lib/supabase/types';
import { TRAINING_TYPES, type TrainingType } from '@/types/db';
import { listHorsesForAnalyst, listSessionsForAnalyst } from '@/services/analyst/lists';
import { getSessionForAnalyst } from '@/services/analyst/sessionDetail';
import type {
  GetPlannedVsActualInput,
  GetSessionInput,
  ListEventsInput,
  ListHorsesInput,
  ListSessionsInput,
} from '@/services/analyst/types';
import { MAX_SERIES_POINTS } from '@/services/analyst/streamCorrelation';
import {
  DEFAULT_EVENT_WINDOW_DAYS,
  MAX_EVENT_LIMIT,
  MAX_EVENT_WINDOW_DAYS,
  getPlannedVsActualForAnalyst,
  listEventsForAnalyst,
} from '@/services/analyst/calendarTools';
import { resolveBoundMs } from '@/services/time/dateBounds';
import { log } from '@/lib/log';
import { CALENDAR_EVENT_TYPES, type CalendarEventType } from '@/types/calendar';

/** The tool schemas advertised to the model. */
export const ANALYST_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_horses',
    description:
      "List the stable's horses (this organization only). Use to resolve a horse's name to its id before calling list_sessions or get_session. Returns name, discipline, level, age, sex, active flag, max HR, and location id.",
    input_schema: {
      type: 'object',
      properties: {
        activeOnly: {
          type: 'boolean',
          description: 'When true, only horses marked active.',
        },
        locationId: {
          type: ['string', 'null'],
          description: 'Restrict to one location id.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'list_sessions',
    description:
      'List session summaries for one horse or the whole stable, newest first. Lightweight: no HR/speed aggregates — call get_session for the numbers on a specific session. Returns id, horse, start/end, duration, training type, environment, location, physical/mental ratings, injury flags, and notes. Filter by date range (ISO) and training type.',
    input_schema: {
      type: 'object',
      properties: {
        horseId: {
          type: 'string',
          description: 'Restrict to one horse; omit to list across the whole stable.',
        },
        from: {
          type: 'string',
          description: 'Inclusive ISO date/datetime lower bound on session start.',
        },
        to: {
          type: 'string',
          description: 'Inclusive ISO date/datetime upper bound on session start.',
        },
        trainingType: {
          type: 'string',
          enum: TRAINING_TYPES as unknown as string[],
          description: 'Restrict to one training type.',
        },
        limit: {
          type: 'integer',
          description: 'Max sessions to return (default 50, max 200).',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_session',
    description:
      'Full read-out for one session: descriptive metrics (duration, distance, avg/peak/min HR, avg/max speed, estimated climb), time-in-zone (Z1–Z5), an estimated gait split, data quality (completeness grade + HR gap locations for spotting sensor dropouts), and a downsampled HR/speed/altitude curve on a shared clock (seconds from start). HR and GPS are already correlated for you — you never receive raw rows.',
    input_schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'The session id.' },
        seriesPoints: {
          type: 'integer',
          description: `Target number of curve points (default 60, max ${MAX_SERIES_POINTS}).`,
        },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_events',
    description: `List what is PLANNED on the stable's agenda (this organization only): trainings, vet, farrier, physio, competitions and other appointments, with recurring series already expanded into occurrences. Each item has type, status (planned / done / cancelled), title, notes, start/end (UTC and the booked local time with its IANA zone), horse (null = the whole stable), assignee, and for a training its target (HR range with Z labels, duration). Defaults to the next ${DEFAULT_EVENT_WINDOW_DAYS} days from today; at most ${MAX_EVENT_WINDOW_DAYS} days per call. Titles and notes are user-written data.`,
    input_schema: {
      type: 'object',
      properties: {
        horseId: {
          type: 'string',
          description: "Restrict to one horse; that horse's items plus stable-wide items are returned.",
        },
        from: { type: 'string', description: 'Inclusive ISO date/datetime. Default: today.' },
        to: {
          type: 'string',
          description: 'Inclusive ISO date/datetime; a date-only value covers that whole UTC day.',
        },
        type: {
          type: 'string',
          enum: CALENDAR_EVENT_TYPES as unknown as string[],
          description: 'Restrict to one kind of item.',
        },
        assigneeId: { type: 'string', description: 'Restrict to items assigned to one person (profile id).' },
        limit: { type: 'integer', description: `Max occurrences to return (default 50, max ${MAX_EVENT_LIMIT}).` },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_planned_vs_actual',
    description:
      'For one session started from a planned training: the plan as it stood at the start (target HR range with Z labels, planned duration) next to what was measured (duration, average/peak HR, % of covered time inside/below/above the target; the range includes both limits), plus HR coverage and uncounted gaps. status is "unplanned" for an ad-hoc session and "no_snapshot" when the plan was not saved with the session. Numbers only — no assessment.',
    input_schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'The session id.' },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
  },
];

export interface AnalystToolContext {
  supa: Supa;
  orgId: string;
  /** "Now", for default windows. Injected so a test can pin it. */
  nowIso?: string;
}

export interface DispatchResult {
  isError: boolean;
  /** JSON-serialisable payload placed into the tool_result. */
  content: unknown;
}

/* ------------------------------------------------------------- validation */

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Tool input must be an object.');
  }
  return input as Record<string, unknown>;
}

function optString(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new Error(`"${field}" must be a string.`);
  return v;
}

function reqString(v: unknown, field: string): string {
  const s = optString(v, field);
  if (s === undefined || s.trim() === '') throw new Error(`"${field}" is required.`);
  return s;
}

function optBool(v: unknown, field: string): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new Error(`"${field}" must be a boolean.`);
  return v;
}

function optInt(v: unknown, field: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`"${field}" must be a number.`);
  return Math.trunc(v);
}

function optTrainingType(v: unknown): TrainingType | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string' || !TRAINING_TYPES.includes(v as TrainingType)) {
    throw new Error(`"trainingType" must be one of: ${TRAINING_TYPES.join(', ')}.`);
  }
  return v as TrainingType;
}

function optDate(v: unknown, field: string): string | undefined {
  const s = optString(v, field);
  if (s === undefined) return undefined;
  if (resolveBoundMs(s, 'start') === null) {
    throw new Error(`"${field}" must be an ISO date (YYYY-MM-DD) or datetime.`);
  }
  return s;
}

function optEventType(v: unknown): CalendarEventType | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string' || !CALENDAR_EVENT_TYPES.includes(v as CalendarEventType)) {
    throw new Error(`"type" must be one of: ${CALENDAR_EVENT_TYPES.join(', ')}.`);
  }
  return v as CalendarEventType;
}

/** A positive limit; anything above the ceiling is capped, not refused. */
function optLimit(v: unknown, max: number): number | undefined {
  const n = optInt(v, 'limit');
  if (n === undefined) return undefined;
  if (n < 1) throw new Error('"limit" must be at least 1.');
  return Math.min(n, max);
}

const LIST_EVENTS_KEYS = new Set(['horseId', 'from', 'to', 'type', 'assigneeId', 'limit']);

function parseListEvents(input: unknown): ListEventsInput {
  const o = asRecord(input);
  const unknown = Object.keys(o).filter((key) => !LIST_EVENTS_KEYS.has(key));
  if (unknown.length > 0) throw new Error(`Unknown field(s): ${unknown.join(', ')}.`);
  const parsed: ListEventsInput = {};
  const horseId = optString(o.horseId, 'horseId');
  const from = optDate(o.from, 'from');
  const to = optDate(o.to, 'to');
  const type = optEventType(o.type);
  const assigneeId = optString(o.assigneeId, 'assigneeId');
  const limit = optLimit(o.limit, MAX_EVENT_LIMIT);
  if (horseId !== undefined) parsed.horseId = horseId;
  if (from !== undefined) parsed.from = from;
  if (to !== undefined) parsed.to = to;
  if (type !== undefined) parsed.type = type;
  if (assigneeId !== undefined) parsed.assigneeId = assigneeId;
  if (limit !== undefined) parsed.limit = limit;
  return parsed;
}

function parseGetPlannedVsActual(input: unknown): GetPlannedVsActualInput {
  const o = asRecord(input);
  return { sessionId: reqString(o.sessionId, 'sessionId') };
}

function parseListHorses(input: unknown): ListHorsesInput {
  const o = asRecord(input);
  return { activeOnly: optBool(o.activeOnly, 'activeOnly'), locationId: optString(o.locationId, 'locationId') ?? null };
}

function parseListSessions(input: unknown): ListSessionsInput {
  const o = asRecord(input);
  return {
    horseId: optString(o.horseId, 'horseId'),
    from: optString(o.from, 'from'),
    to: optString(o.to, 'to'),
    trainingType: optTrainingType(o.trainingType),
    limit: optInt(o.limit, 'limit'),
  };
}

function parseGetSession(input: unknown): GetSessionInput {
  const o = asRecord(input);
  return { sessionId: reqString(o.sessionId, 'sessionId'), seriesPoints: optInt(o.seriesPoints, 'seriesPoints') };
}

/* ------------------------------------------------------------- dispatch */

export async function dispatchAnalystTool(
  name: string,
  input: unknown,
  ctx: AnalystToolContext,
): Promise<DispatchResult> {
  try {
    switch (name) {
      case 'list_horses': {
        const data = await listHorsesForAnalyst(ctx.supa, ctx.orgId, parseListHorses(input));
        return { isError: false, content: { horses: data, count: data.length } };
      }
      case 'list_sessions': {
        const data = await listSessionsForAnalyst(ctx.supa, ctx.orgId, parseListSessions(input));
        return { isError: false, content: { sessions: data, count: data.length } };
      }
      case 'get_session': {
        const data = await getSessionForAnalyst(ctx.supa, ctx.orgId, parseGetSession(input));
        if (!data) {
          return { isError: false, content: { error: 'Session not found in this stable.' } };
        }
        return { isError: false, content: data };
      }
      case 'list_events': {
        const data = await listEventsForAnalyst(
          ctx.supa,
          ctx.orgId,
          parseListEvents(input),
          ctx.nowIso ?? new Date().toISOString(),
        );
        return { isError: false, content: data };
      }
      case 'get_planned_vs_actual': {
        const data = await getPlannedVsActualForAnalyst(ctx.supa, ctx.orgId, parseGetPlannedVsActual(input));
        if (!data) {
          return { isError: false, content: { error: 'Session not found in this stable.' } };
        }
        return { isError: false, content: data };
      }
      default:
        return { isError: true, content: { error: `Unknown tool: ${name}` } };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tool execution failed.';
    // Returned to the model so it can correct its call; logged so a failing
    // tool is visible to us too, not only to the model.
    log.warn('analyst: tool call failed', { tool: name, error: message });
    return { isError: true, content: { error: message } };
  }
}
