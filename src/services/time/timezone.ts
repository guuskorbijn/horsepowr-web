/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 *
 * Source: horsepowr/src/utils/timezone.ts
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

import { log } from '@/lib/log';
import type { CivilDateTime } from './civilDate';

/**
 * The bridge between a UTC instant and a wall clock in a named IANA zone.
 *
 * Why this exists rather than a date library: the product stores every event as
 * `starts_at` (UTC) + `timezone` (IANA), because Lips runs stables in Breda,
 * China and Mexico and a trainer in Breda must be able to read a Mexico
 * appointment in Mexico's local time. That needs real zone rules, which means
 * either a ~70 kB tz database or the one the runtime already ships with (ICU,
 * via Intl). This module is that one dependency-free seam — swap its internals
 * for luxon and nothing else in the app changes.
 *
 * Honest failure, not silent wrongness: if the JS engine was built without
 * time-zone-aware Intl (a historical Hermes/Android pitfall), a fixed-offset
 * guess would be wrong across every DST boundary. So support is probed once,
 * logged loudly, and reported through `isTimeZoneSupported()` so the UI can say
 * what it is actually showing instead of quietly lying.
 */

/** The zones this product knows it has to work in. */
export const KNOWN_TIME_ZONES = [
  'Europe/Amsterdam',
  'America/Mexico_City',
  'Asia/Shanghai',
] as const;

export const FALLBACK_TIME_ZONE = 'UTC';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function buildFormatter(timeZone: string): Intl.DateTimeFormat {
  // 'en-US' with hour12:false and 2-digit everything gives the most stable
  // formatToParts output across ICU versions; we only ever read the numbers.
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getFormatter(timeZone: string): Intl.DateTimeFormat | null {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  try {
    const formatter = buildFormatter(timeZone);
    formatterCache.set(timeZone, formatter);
    return formatter;
  } catch (err: unknown) {
    log.warn('timezone: unusable IANA zone, falling back to UTC', {
      timeZone,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** True when `timeZone` is an IANA zone this runtime can actually resolve. */
export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone.trim().length === 0) return false;
  return getFormatter(timeZone) !== null;
}

let supportProbe: boolean | null = null;

/**
 * Whether this engine's Intl implementation really applies `timeZone`.
 *
 * Probed by converting a known instant into a zone with a known, DST-free
 * offset: 2026-01-01T00:00:00Z is 08:00 in Asia/Shanghai (UTC+8, no DST ever).
 * An engine without tz data either throws or returns the UTC value, and both
 * are caught here.
 */
export function isTimeZoneSupported(): boolean {
  if (supportProbe !== null) return supportProbe;
  try {
    const parts = partsInZone('Asia/Shanghai', Date.UTC(2026, 0, 1, 0, 0, 0));
    supportProbe = parts !== null && parts.hour === 8 && parts.day === 1;
  } catch (err: unknown) {
    log.error('timezone: Intl time-zone probe threw', {
      error: err instanceof Error ? err.message : String(err),
    });
    supportProbe = false;
  }
  if (!supportProbe) {
    log.error(
      'timezone: this engine cannot apply IANA time zones; all times will be ' +
        'shown in UTC and labelled as such',
    );
  }
  return supportProbe;
}

/** Test seam — forgets the probe and the formatter cache. */
export function resetTimeZoneProbeForTests(): void {
  supportProbe = null;
  formatterCache.clear();
}

function partsInZone(timeZone: string, utcMs: number): CivilDateTime | null {
  const formatter = getFormatter(timeZone);
  if (!formatter) return null;

  const read: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(utcMs))) {
    if (part.type === 'literal') continue;
    const value = Number(part.value);
    if (!Number.isNaN(value)) read[part.type] = value;
  }

  const year = read['year'];
  const month = read['month'];
  const day = read['day'];
  const minute = read['minute'];
  const second = read['second'];
  // ICU renders midnight as hour 24 in some versions of the h23/h24 cycle.
  const rawHour = read['hour'];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    rawHour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    return null;
  }
  const hour = rawHour === 24 ? 0 : rawHour;
  return { year, month, day, hour, minute, second };
}

/**
 * The wall clock in `timeZone` at a UTC instant.
 *
 * Falls back to UTC (and says so in the log) when the zone or the engine cannot
 * deliver — never to a silently wrong offset.
 */
export function utcToZonedCivil(
  utcIso: string,
  timeZone: string,
): CivilDateTime {
  const utcMs = Date.parse(utcIso);
  if (Number.isNaN(utcMs)) {
    log.warn('timezone: unparseable instant, using epoch', { utcIso });
    return utcToZonedCivil(new Date(0).toISOString(), FALLBACK_TIME_ZONE);
  }
  const parts = partsInZone(timeZone, utcMs);
  if (parts) return parts;

  const utc = partsInZone(FALLBACK_TIME_ZONE, utcMs);
  if (utc) return utc;

  // Last resort: the engine has no usable Intl at all.
  const d = new Date(utcMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

/** The zone's UTC offset in minutes at a given instant (east of UTC = positive). */
export function offsetMinutesAt(timeZone: string, utcMs: number): number {
  const whole = Math.floor(utcMs / 1000) * 1000;
  const parts = partsInZone(timeZone, whole);
  if (!parts) return 0;
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return (asIfUtc - whole) / 60_000;
}

/**
 * The UTC instant at which `civil` is on the clock in `timeZone`.
 *
 * Solving this needs care because the offset depends on the very instant we are
 * looking for. Two candidates are built — one using the offset in force a day
 * earlier, one using the offset a day later — and each is checked by converting
 * it back. That makes both awkward cases explicit instead of accidental:
 *
 *  - Autumn-back OVERLAP (the wall clock shows this time twice): both
 *    candidates convert back correctly, and we take the EARLIER instant. "02:30"
 *    means the first 02:30, which is also what date libraries settle on.
 *  - Spring-forward GAP (the wall clock never shows this time): neither
 *    candidate converts back, and we take the later one, which shifts the
 *    appointment forward out of the gap (02:30 becomes 03:30). Refusing instead
 *    would make a recurring 02:30 series silently lose an occurrence once a
 *    year, which is a worse answer than moving it by an hour.
 */
export function zonedCivilToUtcMs(
  civil: CivilDateTime,
  timeZone: string,
): number {
  const naive = Date.UTC(
    civil.year,
    civil.month - 1,
    civil.day,
    civil.hour,
    civil.minute,
    civil.second,
  );

  const offsetBefore = offsetMinutesAt(timeZone, naive - 86_400_000);
  const offsetAfter = offsetMinutesAt(timeZone, naive + 86_400_000);
  const candidates =
    offsetBefore === offsetAfter
      ? [naive - offsetBefore * 60_000]
      : [naive - offsetBefore * 60_000, naive - offsetAfter * 60_000];

  const matches = candidates.filter((candidate) => {
    const parts = partsInZone(timeZone, candidate);
    return (
      parts !== null &&
      parts.year === civil.year &&
      parts.month === civil.month &&
      parts.day === civil.day &&
      parts.hour === civil.hour &&
      parts.minute === civil.minute
    );
  });

  if (matches.length > 0) return Math.min(...matches);
  return Math.max(...candidates);
}

/** Convenience wrapper returning a UTC ISO string. */
export function zonedCivilToUtcIso(
  civil: CivilDateTime,
  timeZone: string,
): string {
  return new Date(zonedCivilToUtcMs(civil, timeZone)).toISOString();
}

/**
 * The device's own IANA zone, used only as the DEFAULT when creating an event.
 * Never used to render an existing one — that always uses the event's stored
 * zone, which is the whole point of storing it.
 */
export function deviceTimeZone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved && isValidTimeZone(resolved)) return resolved;
  } catch (err: unknown) {
    log.warn('timezone: cannot resolve device zone, defaulting to UTC', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return FALLBACK_TIME_ZONE;
}

/**
 * `HH:MM` on the clock in `timeZone`. Formatting for display stays here so no
 * screen has to know about Intl or about the fallback behaviour.
 */
export function formatZonedTime(utcIso: string, timeZone: string): string {
  const civil = utcToZonedCivil(utcIso, timeZone);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${p2(civil.hour)}:${p2(civil.minute)}`;
}

/**
 * A short zone label to show next to a time when the event's zone differs from
 * the reader's — "09:00 (Mexico City)". Returns null when they match, so a
 * caller can simply omit it.
 */
export function zoneShortLabel(
  timeZone: string,
  readerTimeZone: string,
): string | null {
  if (timeZone === readerTimeZone) return null;
  const city = timeZone.split('/').pop() ?? timeZone;
  return city.replace(/_/g, ' ');
}
