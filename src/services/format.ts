/**
 * Descriptive formatting helpers. Pure functions, no judgment — they format
 * measured facts (duration, distance, HR, speed) for display. Numbers render
 * with tabular figures at the component level (the `tabular` class).
 */

/** Whole-minute + second clock, e.g. 80 min -> "1:20:04" or "12:30". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Short human duration for cards, e.g. "1h 20m" or "47m". */
export function formatDurationShort(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDistanceKm(metres: number): string {
  if (!Number.isFinite(metres)) return '—';
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(2)} km`;
}

/** m/s -> km/h, one decimal. */
export function formatSpeedKmh(metresPerSecond: number): string {
  if (!Number.isFinite(metresPerSecond)) return '—';
  return `${(metresPerSecond * 3.6).toFixed(1)} km/h`;
}

export function formatBpm(bpm: number | null | undefined): string {
  if (bpm == null || !Number.isFinite(bpm)) return '—';
  return `${Math.round(bpm)} bpm`;
}

export function formatAltitude(metres: number): string {
  if (!Number.isFinite(metres)) return '—';
  return `${Math.round(metres)} m`;
}

/** A rise/run fraction as a signed percent, e.g. 0.052 -> "+5.2%". Estimate. */
export function formatGradient(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction)) return '—';
  const pct = fraction * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/** Speed in km/h, one decimal, no unit suffix (for dense tables). */
export function formatKmhValue(metresPerSecond: number | null | undefined): string {
  if (metresPerSecond == null || !Number.isFinite(metresPerSecond)) return '—';
  return (metresPerSecond * 3.6).toFixed(1);
}

/*
 * Dates and times.
 *
 * Every function below takes the READER's IANA zone. On the server that zone
 * is not the server's own: Vercel runs in UTC, so formatting "on the server's
 * clock" showed a 10:30 Breda ride as 09:30, and a Mexico City one six hours
 * off. Server components pass `getReaderTimeZone()`; client components pass
 * `useReaderTimeZone()`, which carries the same value so the server render and
 * the hydrated page agree. Omitting it means UTC, said out loud rather than
 * left to whatever machine runs the code.
 */

const DEFAULT_ZONE = 'UTC';

function safeZone(timeZone: string | undefined): string {
  if (!timeZone) return DEFAULT_ZONE;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return timeZone;
  } catch {
    // An unknown zone string is a caller bug, not a reason to crash a page.
    return DEFAULT_ZONE;
  }
}

/** Date like "24 Jun 2026", on the reader's calendar. */
export function formatDate(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: safeZone(timeZone),
  });
}

/** Date + time like "24 Jun 2026, 14:05", on the reader's clock. */
export function formatDateTime(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: safeZone(timeZone),
  });
}

/** "14:05" on the reader's clock. */
export function formatTime(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: safeZone(timeZone) });
}

/** The reader's calendar day of an instant as a day number (days since epoch). */
function civilDayNumber(d: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(d); // "2026-11-03"
  return Math.round(Date.parse(`${parts}T00:00:00Z`) / 86_400_000);
}

/** Whole days since an ISO date (0 = today), counted on the reader's calendar. */
export function daysSince(iso: string, now: Date = new Date(), timeZone?: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const zone = safeZone(timeZone);
  return Math.max(0, civilDayNumber(now, zone) - civilDayNumber(d, zone));
}

/** "today", "yesterday", "3 days ago", or a date for older. Descriptive recency. */
export function formatRelativeDay(iso: string, now: Date = new Date(), timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const zone = safeZone(timeZone);
  const days = civilDayNumber(now, zone) - civilDayNumber(d, zone);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso, zone);
}

/*
 * Calendar dates that are NOT instants — a date of birth, an agenda day key.
 * They name a day, not a moment, so they are formatted without any zone shift:
 * "2015-04-02" is 2 April everywhere.
 */

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayKeyDate(key: string): Date | null {
  const m = DAY_KEY.exec(key.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2 Apr 2015" for a YYYY-MM-DD calendar date; the input unchanged if it is not one. */
export function formatCalendarDate(key: string): string {
  const d = dayKeyDate(key);
  if (d === null) return key;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "Tue 3 Nov 2026" for an agenda day key. */
export function formatDayKey(key: string): string {
  const d = dayKeyDate(key);
  if (d === null) return key;
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  return `${weekday} ${formatCalendarDate(key)}`;
}

/** "2 – 8 Nov 2026", "30 Nov – 6 Dec 2026", "28 Dec 2026 – 3 Jan 2027". */
export function formatDayRange(startKey: string, endKey: string): string {
  const a = dayKeyDate(startKey);
  const b = dayKeyDate(endKey);
  if (a === null || b === null) return `${startKey} – ${endKey}`;
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions): string =>
    d.toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
  const end = fmt(b, { day: 'numeric', month: 'short', year: 'numeric' });
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${fmt(a, { day: 'numeric', month: 'short', year: 'numeric' })} – ${end}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${fmt(a, { day: 'numeric', month: 'short' })} – ${end}`;
  return `${a.getUTCDate()} – ${end}`;
}
