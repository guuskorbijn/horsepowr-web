import { z } from 'zod';
import type { CalendarEventStatus, CalendarEventType } from '@/types/calendar';
import type { CalendarEventOverrideRow, CalendarEventRow } from '@/types/db';

/**
 * Runtime validation of the two calendar tables AS POSTGREST RETURNS THEM.
 *
 * The hand-written row types in `db.ts` are a promise the compiler cannot
 * check: the columns arrive as JSON from another process. These schemas turn
 * that promise into a check at the repository boundary, so a row that does
 * not match the introspected DDL (`20261015000000_calendar_events.sql`) is
 * caught where it enters instead of three components later as `undefined`.
 *
 * `targets` stays `unknown` here on purpose. It has its own versioned schema
 * (`trainingTargets.ts`), applied leniently: one malformed target costs one
 * event its target, never the event itself.
 */

const EVENT_TYPES = [
  'training',
  'vet',
  'farrier',
  'physio',
  'competition',
  'other',
] as const satisfies readonly CalendarEventType[];

const EVENT_STATUSES = [
  'planned',
  'done',
  'cancelled',
] as const satisfies readonly CalendarEventStatus[];

/** A timestamptz as PostgREST serialises it ('…+00:00' or '…Z'). */
const instant = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'not a timestamp' });

const id = z.string().min(1);

export const calendarEventRowSchema = z.object({
  id,
  org_id: id,
  horse_id: id.nullable(),
  type: z.enum(EVENT_TYPES),
  title: z.string().min(1),
  notes: z.string().nullable(),
  starts_at: instant,
  ends_at: instant.nullable(),
  all_day: z.boolean(),
  timezone: z.string().min(1),
  location_id: id.nullable(),
  assignee_id: id.nullable(),
  status: z.enum(EVENT_STATUSES),
  created_by: id,
  targets: z.unknown(),
  // Phase 2 proposal: absent until that migration is applied.
  training_type: z.string().nullable().optional(),
  recurrence_rule: z.string().nullable(),
  created_at: instant,
  updated_at: instant,
  deleted_at: instant.nullable(),
});

export const calendarEventOverrideRowSchema = z.object({
  id,
  event_id: id,
  original_start: instant,
  cancelled: z.boolean(),
  starts_at: instant.nullable(),
  ends_at: instant.nullable(),
  title: z.string().nullable(),
  notes: z.string().nullable(),
  assignee_id: id.nullable(),
  status: z.enum(EVENT_STATUSES).nullable(),
  targets: z.unknown(),
  created_at: instant,
  updated_at: instant,
  deleted_at: instant.nullable(),
});

// Compile-time guard: the schemas and the hand-written row types must agree.
// If a column is added to one and not the other, this stops compiling.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const eventRowMatches: Same<z.infer<typeof calendarEventRowSchema>, CalendarEventRow> = true;
const overrideRowMatches: Same<
  z.infer<typeof calendarEventOverrideRowSchema>,
  CalendarEventOverrideRow
> = true;
void eventRowMatches;
void overrideRowMatches;

export type RowParseResult<T> = { ok: true; row: T } | { ok: false; error: string };

function describe(error: z.ZodError): string {
  const first = error.issues[0];
  const where = first && first.path.length > 0 ? `${first.path.join('.')}: ` : '';
  return `${where}${first?.message ?? 'invalid row'}`;
}

export function parseCalendarEventRow(input: unknown): RowParseResult<CalendarEventRow> {
  const result = calendarEventRowSchema.safeParse(input);
  return result.success ? { ok: true, row: result.data } : { ok: false, error: describe(result.error) };
}

export function parseCalendarEventOverrideRow(
  input: unknown,
): RowParseResult<CalendarEventOverrideRow> {
  const result = calendarEventOverrideRowSchema.safeParse(input);
  return result.success ? { ok: true, row: result.data } : { ok: false, error: describe(result.error) };
}
