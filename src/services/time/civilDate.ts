/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit cc497bd, do not edit here.
 *
 * Source: horsepowr/src/utils/civilDate.ts
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

/**
 * Civil (wall-clock) date arithmetic — no time zones, no Date mutation.
 *
 * A "civil" date-time is what a wall clock and a paper calendar show: 2027-03-28
 * at 08:00, with no statement about which instant that is. Recurrence has to be
 * computed here and only here, because the whole point of a recurring 08:00
 * farrier appointment is that it stays 08:00 after a DST change — which is
 * false for every form of "add 7 * 24 hours to an instant".
 *
 * The UTC-instant conversion is a separate concern and lives in
 * utils/timezone.ts. These functions never touch Intl and never look at the
 * host's local zone, which is what makes them deterministic in tests.
 */

export interface CivilDateTime {
  /** Full year, e.g. 2027. */
  year: number;
  /** 1-12. */
  month: number;
  /** 1-31. */
  day: number;
  /** 0-23. */
  hour: number;
  /** 0-59. */
  minute: number;
  /** 0-59. */
  second: number;
}

/** 0 = Sunday … 6 = Saturday, matching Date.prototype.getUTCDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Internally we lean on Date.UTC purely as a proleptic-Gregorian calculator —
 * it is the only correct calendar implementation already in the runtime. No
 * time-zone semantics leak in, because every value handed to it and read back
 * out is UTC-based.
 */
function toEpochScalar(c: CivilDateTime): number {
  return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second, 0);
}

function fromEpochScalar(ms: number): CivilDateTime {
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

export function civilWeekday(c: CivilDateTime): Weekday {
  return new Date(toEpochScalar(c)).getUTCDay() as Weekday;
}

/** Days in a given month, honouring leap years. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addCivilDays(c: CivilDateTime, days: number): CivilDateTime {
  return fromEpochScalar(toEpochScalar(c) + days * 86_400_000);
}

/**
 * Adds months, clamping the day to the target month's length.
 *
 * Clamping (31 Jan + 1 month = 28/29 Feb) rather than overflowing into March is
 * what RFC 5545 calls for and what users expect from "the 31st of every month".
 */
export function addCivilMonths(c: CivilDateTime, months: number): CivilDateTime {
  const zeroBased = c.year * 12 + (c.month - 1) + months;
  const year = Math.floor(zeroBased / 12);
  const month = (zeroBased % 12) + 1;
  const day = Math.min(c.day, daysInMonth(year, month));
  return { ...c, year, month, day };
}

export function addCivilYears(c: CivilDateTime, years: number): CivilDateTime {
  return addCivilMonths(c, years * 12);
}

/** Chronological comparison of two civil date-times. */
export function compareCivil(a: CivilDateTime, b: CivilDateTime): number {
  return toEpochScalar(a) - toEpochScalar(b);
}

/** Midnight (00:00:00) on the same civil day. */
export function startOfCivilDay(c: CivilDateTime): CivilDateTime {
  return { ...c, hour: 0, minute: 0, second: 0 };
}

/**
 * Start of the civil week containing `c`.
 *
 * @param weekStartsOn 0 = Sunday, 1 = Monday. The agenda uses Monday (NL/EU
 *   convention and how a stable's week is actually organised).
 */
export function startOfCivilWeek(
  c: CivilDateTime,
  weekStartsOn: 0 | 1 = 1,
): CivilDateTime {
  const current = civilWeekday(c);
  const diff = (current - weekStartsOn + 7) % 7;
  return startOfCivilDay(addCivilDays(c, -diff));
}

/** `YYYY-MM-DD` for the civil day — the key the agenda groups by. */
export function civilDayKey(c: CivilDateTime): string {
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${String(c.year).padStart(4, '0')}-${p2(c.month)}-${p2(c.day)}`;
}

/** Parses `YYYY-MM-DD` into a civil midnight. Returns null when malformed. */
export function parseCivilDayKey(key: string): CivilDateTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day, hour: 0, minute: 0, second: 0 };
}
