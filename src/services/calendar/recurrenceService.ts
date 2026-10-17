/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 *
 * Source: horsepowr/src/services/calendar/recurrenceService.ts
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
  addCivilDays,
  addCivilMonths,
  addCivilYears,
  civilWeekday,
  compareCivil,
  daysInMonth,
  startOfCivilWeek,
  type CivilDateTime,
  type Weekday,
} from '@/services/time/civilDate';
import { utcToZonedCivil, zonedCivilToUtcMs } from '@/services/time/timezone';

/**
 * Recurrence — parse and expand RFC 5545 RRULEs.
 *
 * PURE. No I/O, no logging, no clock, no Date mutation. Everything it needs
 * arrives as an argument, which is what makes the DST cases testable at all.
 *
 * Nothing is materialised in the database. A recurring vaccination is ONE row
 * with a rule; occurrences are computed over the range the agenda is currently
 * showing. That is the only design that does not force a decision about how far
 * into the future to generate rows, and the only one where editing the series
 * does not mean rewriting a thousand rows.
 *
 * Supported subset (deliberately bounded):
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, BYDAY (weekly),
 *   BYMONTHDAY (monthly), COUNT, UNTIL
 *
 * That covers every case this product has: yearly vaccination, deworming every
 * 8 weeks, farrier every 6 weeks, fixed weekly training days. We store VALID
 * RRULE text, so when the subset becomes too small a full library can be
 * dropped in behind this interface with no data migration.
 *
 * Expansion runs in the event's LOCAL wall clock and only then converts to UTC.
 * A farrier appointment at 08:00 every six weeks stays at 08:00 across a DST
 * change; "add 42 * 24 hours" would drift it by an hour twice a year.
 */

export type RecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** >= 1. */
  interval: number;
  /** Weekly only. Empty means "the weekday DTSTART falls on". */
  byDay: Weekday[];
  /** Monthly only. Empty means "the day of the month DTSTART falls on". */
  byMonthDay: number[];
  /** Total number of occurrences in the whole series, counted from DTSTART. */
  count: number | null;
  /** Inclusive UTC ISO end of the series. */
  until: string | null;
}

export type ParseRecurrenceResult =
  | { ok: true; rule: RecurrenceRule }
  | { ok: false; error: string };

/**
 * Hard ceiling on occurrences returned for one range. A pathological rule (a
 * daily series over a ten-year range) must degrade to "we showed you the first
 * N" rather than lock up the list. Surfaced via `truncated`, never silent.
 */
export const MAX_OCCURRENCES_PER_RANGE = 500;

/**
 * Ceiling on candidate steps walked while fast-forwarding from DTSTART to the
 * visible range. COUNT is defined from DTSTART, so the walk cannot simply start
 * at the range — but it also must not run forever on a corrupt rule.
 */
export const MAX_EXPANSION_STEPS = 20_000;

const WEEKDAY_CODES: Record<string, Weekday> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const WEEKDAY_CODE_BY_INDEX: readonly string[] = [
  'SU',
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
];

function isFreq(value: string): value is RecurrenceFreq {
  return (
    value === 'DAILY' ||
    value === 'WEEKLY' ||
    value === 'MONTHLY' ||
    value === 'YEARLY'
  );
}

/**
 * Parses RRULE text. Accepts a leading `RRULE:` prefix, is case-insensitive on
 * keys and values, and ignores a trailing semicolon.
 *
 * Rejects rather than guesses: an unsupported part (BYSETPOS, BYWEEKNO, …) is
 * an error, because quietly dropping it would show the user a series that is
 * not the one they asked for.
 */
export function parseRecurrenceRule(text: string): ParseRecurrenceResult {
  const trimmed = text.trim().replace(/^RRULE:/i, '').replace(/;$/, '');
  if (trimmed.length === 0) return { ok: false, error: 'empty rule' };

  let freq: RecurrenceFreq | null = null;
  let interval = 1;
  const byDay: Weekday[] = [];
  const byMonthDay: number[] = [];
  let count: number | null = null;
  let until: string | null = null;

  for (const part of trimmed.split(';')) {
    if (part.length === 0) continue;
    const eq = part.indexOf('=');
    if (eq < 0) return { ok: false, error: `malformed part: ${part}` };
    const key = part.slice(0, eq).trim().toUpperCase();
    const raw = part.slice(eq + 1).trim();

    switch (key) {
      case 'FREQ': {
        const value = raw.toUpperCase();
        if (!isFreq(value)) return { ok: false, error: `unsupported FREQ: ${raw}` };
        freq = value;
        break;
      }
      case 'INTERVAL': {
        const value = Number(raw);
        if (!Number.isInteger(value) || value < 1) {
          return { ok: false, error: `invalid INTERVAL: ${raw}` };
        }
        interval = value;
        break;
      }
      case 'COUNT': {
        const value = Number(raw);
        if (!Number.isInteger(value) || value < 1) {
          return { ok: false, error: `invalid COUNT: ${raw}` };
        }
        count = value;
        break;
      }
      case 'UNTIL': {
        const parsed = parseUntil(raw);
        if (parsed === null) return { ok: false, error: `invalid UNTIL: ${raw}` };
        until = parsed;
        break;
      }
      case 'BYDAY': {
        for (const code of raw.split(',')) {
          const weekday = WEEKDAY_CODES[code.trim().toUpperCase()];
          if (weekday === undefined) {
            return { ok: false, error: `invalid BYDAY: ${code}` };
          }
          if (!byDay.includes(weekday)) byDay.push(weekday);
        }
        break;
      }
      case 'BYMONTHDAY': {
        for (const token of raw.split(',')) {
          const value = Number(token.trim());
          // Negative month days (-1 = last day) are not in the supported
          // subset; accepting them silently would mis-expand the series.
          if (!Number.isInteger(value) || value < 1 || value > 31) {
            return { ok: false, error: `invalid BYMONTHDAY: ${token}` };
          }
          if (!byMonthDay.includes(value)) byMonthDay.push(value);
        }
        break;
      }
      case 'WKST':
        // Only affects BYWEEKNO/BYSETPOS expansion, neither of which is
        // supported. Accepted and ignored so round-tripped rules survive.
        break;
      default:
        return { ok: false, error: `unsupported RRULE part: ${key}` };
    }
  }

  if (!freq) return { ok: false, error: 'missing FREQ' };
  if (count !== null && until !== null) {
    return { ok: false, error: 'COUNT and UNTIL are mutually exclusive' };
  }
  if (byDay.length > 0 && freq !== 'WEEKLY') {
    return { ok: false, error: 'BYDAY is only supported with FREQ=WEEKLY' };
  }
  if (byMonthDay.length > 0 && freq !== 'MONTHLY') {
    return { ok: false, error: 'BYMONTHDAY is only supported with FREQ=MONTHLY' };
  }

  byDay.sort((a, b) => a - b);
  byMonthDay.sort((a, b) => a - b);
  return { ok: true, rule: { freq, interval, byDay, byMonthDay, count, until } };
}

/** `YYYYMMDD` or `YYYYMMDDTHHMMSSZ` (both RFC 5545 forms) → UTC ISO. */
function parseUntil(raw: string): string | null {
  const basic = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(raw);
  if (basic) {
    const [, y, mo, d, h, mi, s] = basic;
    const ms = Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      h === undefined ? 23 : Number(h),
      mi === undefined ? 59 : Number(mi),
      s === undefined ? 59 : Number(s),
    );
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  // Tolerate an ISO string, which is what our own writer would never emit but
  // an import or a hand-edited row might.
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Serialises a rule back to RRULE text. Round-trips with the parser. */
export function formatRecurrenceRule(rule: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${rule.freq}`];
  if (rule.interval !== 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay.length > 0) {
    parts.push(
      `BYDAY=${rule.byDay.map((d) => WEEKDAY_CODE_BY_INDEX[d] ?? 'MO').join(',')}`,
    );
  }
  if (rule.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  }
  if (rule.count !== null) parts.push(`COUNT=${rule.count}`);
  if (rule.until !== null) {
    const d = new Date(rule.until);
    const p2 = (n: number): string => String(n).padStart(2, '0');
    parts.push(
      `UNTIL=${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(
        d.getUTCDate(),
      )}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`,
    );
  }
  return parts.join(';');
}

export interface ExpansionResult {
  /** UTC ISO instants, ascending, inside the requested range. */
  starts: string[];
  /**
   * True when the series was cut short by a safety ceiling rather than by the
   * rule itself. The caller decides how to surface it; this module does not
   * log, so truncation can never be swallowed.
   */
  truncated: boolean;
}

export interface ExpandOptions {
  rule: RecurrenceRule;
  /** The series anchor: the master event's `starts_at` (UTC ISO). */
  dtstartUtc: string;
  /** The event's IANA zone — the clock the series is anchored to. */
  timeZone: string;
  /** Inclusive UTC ISO start of the visible range. */
  rangeStartUtc: string;
  /** Exclusive UTC ISO end of the visible range. */
  rangeEndUtc: string;
}

/**
 * Expands a rule into the UTC instants that fall inside a range.
 *
 * Walks candidates from DTSTART rather than from the range start, because COUNT
 * is defined over the whole series: you cannot know whether the 2027 occurrence
 * exists without knowing how many came before it. The step ceiling keeps that
 * walk bounded.
 */
export function expandRecurrence(options: ExpandOptions): ExpansionResult {
  const { rule, dtstartUtc, timeZone, rangeStartUtc, rangeEndUtc } = options;

  const rangeStartMs = Date.parse(rangeStartUtc);
  const rangeEndMs = Date.parse(rangeEndUtc);
  const dtstartMs = Date.parse(dtstartUtc);
  if (
    Number.isNaN(rangeStartMs) ||
    Number.isNaN(rangeEndMs) ||
    Number.isNaN(dtstartMs) ||
    rangeEndMs <= rangeStartMs
  ) {
    return { starts: [], truncated: false };
  }

  const untilMs = rule.until === null ? null : Date.parse(rule.until);
  const anchor = utcToZonedCivil(dtstartUtc, timeZone);

  const starts: string[] = [];
  let emitted = 0; // counted over the whole series, for COUNT
  let steps = 0;
  let truncated = false;

  for (const candidate of candidateCivilStarts(rule, anchor)) {
    steps += 1;
    if (steps > MAX_EXPANSION_STEPS) {
      truncated = true;
      break;
    }

    // A candidate before DTSTART is a by-rule artefact (BYDAY earlier in the
    // anchor week, BYMONTHDAY earlier in the anchor month) and is not part of
    // the series.
    if (compareCivil(candidate, anchor) < 0) continue;

    const utcMs = zonedCivilToUtcMs(candidate, timeZone);
    if (untilMs !== null && utcMs > untilMs) break;

    emitted += 1;
    if (rule.count !== null && emitted > rule.count) break;

    if (utcMs >= rangeEndMs) break;
    if (utcMs >= rangeStartMs) {
      starts.push(new Date(utcMs).toISOString());
      if (starts.length >= MAX_OCCURRENCES_PER_RANGE) {
        truncated = true;
        break;
      }
    }
  }

  return { starts, truncated };
}

/**
 * Lazily yields candidate civil start times in ascending order.
 *
 * A generator rather than an array: a weekly series with no COUNT or UNTIL is
 * infinite, and the caller decides where to stop.
 */
function* candidateCivilStarts(
  rule: RecurrenceRule,
  anchor: CivilDateTime,
): Generator<CivilDateTime> {
  switch (rule.freq) {
    case 'DAILY': {
      let current = anchor;
      for (;;) {
        yield current;
        current = addCivilDays(current, rule.interval);
      }
    }
    case 'WEEKLY': {
      const days =
        rule.byDay.length > 0 ? [...rule.byDay].sort((a, b) => a - b) : [civilWeekday(anchor)];
      // Anchor to the Monday of DTSTART's week so INTERVAL counts whole weeks,
      // which is what "every two weeks" has to mean for a multi-day BYDAY set.
      let weekStart = startOfCivilWeek(anchor, 1);
      for (;;) {
        for (const weekday of days) {
          const offset = (weekday - 1 + 7) % 7; // Monday-based week
          const candidate = addCivilDays(weekStart, offset);
          yield {
            ...candidate,
            hour: anchor.hour,
            minute: anchor.minute,
            second: anchor.second,
          };
        }
        weekStart = addCivilDays(weekStart, 7 * rule.interval);
      }
    }
    case 'MONTHLY': {
      // No BYMONTHDAY: step month by month from DTSTART, clamping the day so
      // "the 31st of every month" lands on the 28th/29th/30th where needed.
      if (rule.byMonthDay.length === 0) {
        let step = 0;
        for (;;) {
          yield addCivilMonths(anchor, step * rule.interval);
          step += 1;
        }
      }
      // Explicit BYMONTHDAY: a day that does not exist in a month is SKIPPED,
      // per RFC 5545 — the opposite of the clamping above, and the reason the
      // two paths are kept separate instead of unified.
      const days = [...rule.byMonthDay].sort((a, b) => a - b);
      let step = 0;
      for (;;) {
        const month = addCivilMonths({ ...anchor, day: 1 }, step * rule.interval);
        const length = daysInMonth(month.year, month.month);
        for (const day of days) {
          if (day > length) continue;
          yield { ...month, day, hour: anchor.hour, minute: anchor.minute, second: anchor.second };
        }
        step += 1;
      }
    }
    case 'YEARLY': {
      let step = 0;
      for (;;) {
        yield addCivilYears(anchor, step * rule.interval);
        step += 1;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Presets — what the v1 UI actually offers
// ---------------------------------------------------------------------------

/**
 * The recurrence choices a trainer picks from. The service supports more than
 * this; the v1 screen deliberately does not, because a free-form RRULE editor
 * is a worse answer to "every six weeks, the farrier" than a list is.
 *
 * A rule that matches none of these (imported, or authored on the web later) is
 * still expanded correctly and shown as `custom` — never dropped.
 */
export type RecurrencePreset =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'every_4_weeks'
  | 'every_6_weeks'
  | 'every_8_weeks'
  | 'monthly'
  | 'yearly'
  | 'custom';

export const RECURRENCE_PRESETS: readonly RecurrencePreset[] = [
  'none',
  'daily',
  'weekly',
  'biweekly',
  'every_4_weeks',
  'every_6_weeks',
  'every_8_weeks',
  'monthly',
  'yearly',
] as const;

const PRESET_RULES: Partial<Record<RecurrencePreset, string>> = {
  daily: 'FREQ=DAILY',
  weekly: 'FREQ=WEEKLY',
  biweekly: 'FREQ=WEEKLY;INTERVAL=2',
  every_4_weeks: 'FREQ=WEEKLY;INTERVAL=4',
  every_6_weeks: 'FREQ=WEEKLY;INTERVAL=6',
  every_8_weeks: 'FREQ=WEEKLY;INTERVAL=8',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
};

/** The RRULE text for a preset, or null for 'none'/'custom'. */
export function presetToRule(preset: RecurrencePreset): string | null {
  return PRESET_RULES[preset] ?? null;
}

/** Which preset a stored rule corresponds to, or 'custom' when none matches. */
export function ruleToPreset(rule: string | null): RecurrencePreset {
  if (rule === null || rule.trim().length === 0) return 'none';
  const parsed = parseRecurrenceRule(rule);
  if (!parsed.ok) return 'custom';
  const normalised = formatRecurrenceRule(parsed.rule);
  for (const preset of RECURRENCE_PRESETS) {
    const candidate = PRESET_RULES[preset];
    if (candidate !== undefined && candidate === normalised) return preset;
  }
  return 'custom';
}
