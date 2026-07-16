/**
 * Tool registry + dispatcher for the analyst chat. This is the ONLY surface the
 * model can reach: three read-only, org-scoped tools. Each definition is a plain
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
import type { TrainingType } from '@/types/db';
import { listHorsesForAnalyst, listSessionsForAnalyst } from '@/services/analyst/lists';
import { getSessionForAnalyst } from '@/services/analyst/sessionDetail';
import type { ListHorsesInput, ListSessionsInput, GetSessionInput } from '@/services/analyst/types';
import { MAX_SERIES_POINTS } from '@/services/analyst/streamCorrelation';

const TRAINING_TYPES: readonly TrainingType[] = [
  'dressage',
  'cross_country',
  'conditioning',
  'other',
];

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
];

export interface AnalystToolContext {
  supa: Supa;
  orgId: string;
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
      default:
        return { isError: true, content: { error: `Unknown tool: ${name}` } };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tool execution failed.';
    return { isError: true, content: { error: message } };
  }
}
