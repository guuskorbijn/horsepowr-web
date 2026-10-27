/**
 * Range bounds that callers (the agenda, the analyst tools) pass as text.
 *
 * PURE. One rule, written once, because it already bit once (AI_CHAT_SPEC §5,
 * `fd24de9`): a date-only `to` such as "2026-06-21" parses to midnight UTC,
 * so a single-day range silently excluded everything after 00:00Z. A
 * date-only bound therefore means the WHOLE UTC day.
 *
 * Both bounds resolve to a half-open window `[start, endExclusive)`:
 *   - start, date-only   -> that day 00:00:00.000Z
 *   - end,   date-only   -> the NEXT day 00:00:00.000Z
 *   - start, datetime    -> that instant
 *   - end,   datetime    -> that instant + 1 ms (an explicit `to` is inclusive)
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export type BoundEdge = 'start' | 'end';

/** True for a bare `YYYY-MM-DD`. */
export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value.trim());
}

/**
 * Resolves one bound to epoch milliseconds, or null when it does not parse.
 * A date-only value must also be a real calendar date: "2026-02-30" is
 * rejected rather than rolled over into March.
 */
export function resolveBoundMs(value: string, edge: BoundEdge): number | null {
  const trimmed = value.trim();
  const match = DATE_ONLY.exec(trimmed);
  if (match) {
    const [, y, m, d] = match;
    const ms = Date.UTC(Number(y), Number(m) - 1, Number(d));
    const roundTrip = new Date(ms).toISOString().slice(0, 10);
    if (Number.isNaN(ms) || roundTrip !== trimmed) return null;
    return edge === 'start' ? ms : ms + DAY_MS;
  }
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return edge === 'start' ? ms : ms + 1;
}

export interface ResolvedRange {
  /** Inclusive UTC ISO start. */
  startUtc: string;
  /** Exclusive UTC ISO end. */
  endUtc: string;
}

/**
 * Resolves a `from`/`to` pair, throwing a RangeError naming the bad field —
 * callers turn that into a visible validation error, never an empty result.
 */
export function resolveRange(from: string, to: string): ResolvedRange {
  const startMs = resolveBoundMs(from, 'start');
  if (startMs === null) throw new RangeError(`"from" is not a valid date: ${from}`);
  const endMs = resolveBoundMs(to, 'end');
  if (endMs === null) throw new RangeError(`"to" is not a valid date: ${to}`);
  if (endMs <= startMs) throw new RangeError('"to" must not be before "from".');
  return { startUtc: new Date(startMs).toISOString(), endUtc: new Date(endMs).toISOString() };
}
