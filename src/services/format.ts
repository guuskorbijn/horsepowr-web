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

/** Date like "24 Jun 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Date + time like "24 Jun 2026, 14:05". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Whole days since an ISO date (0 = today). A plain fact — no "due"/"overdue". */
export function daysSince(iso: string, now: Date = new Date()): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.max(0, Math.round((startOf(now) - startOf(d)) / 86_400_000));
}

/** "today", "yesterday", "3 days ago", or a date for older. Descriptive recency. */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}
