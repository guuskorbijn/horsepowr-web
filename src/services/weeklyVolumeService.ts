/**
 * Weekly volume service — DESCRIPTIVE measured sums per ISO week for one horse:
 * total distance, total duration, time in each HR zone, and session count.
 *
 * HARD GUARDRAIL: these are measured sums, full stop. NO training-load index, NO
 * readiness, NO "high/low", NO recommendation. The view is titled "Weekly volume
 * (measured)" so the framing stays factual. Pure functions; client-side
 * aggregation over existing rows. Tested against fixtures.
 */
import { computeSessionMetrics } from '@/services/sessionMetrics';
import { zoneDistribution } from '@/services/hrZone';
import { hrZones, type ZoneKey } from '@/theme/tokens';
import type { MeasurementRow, SessionRow } from '@/types/db';

const ZONE_KEYS: readonly ZoneKey[] = ['z1', 'z2', 'z3', 'z4', 'z5'];

export interface WeekVolume {
  /** Monday 00:00 UTC of the week, epoch ms (stable bucket key). */
  weekStartMs: number;
  sessionCount: number;
  durationMin: number;
  distanceKm: number;
  /** Approximate minutes in each HR zone (HR-sample share × session duration). */
  zoneMinutes: Record<ZoneKey, number>;
}

export interface WeeklyVolumeInput {
  session: SessionRow;
  rows: MeasurementRow[];
}

/** Monday 00:00 UTC for the week containing `ms` — a TZ-stable bucket key. */
export function weekStartUtc(ms: number): number {
  const d = new Date(ms);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const fromMonday = (day + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - fromMonday);
}

function emptyZones(): Record<ZoneKey, number> {
  return { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
}

/** Aggregates per-week measured volume, ascending by week. */
export function buildWeeklyVolume(
  inputs: WeeklyVolumeInput[],
  maxHr: number,
): WeekVolume[] {
  const byWeek = new Map<number, WeekVolume>();

  for (const { session, rows } of inputs) {
    const metrics = computeSessionMetrics(session, rows);
    const durationMin = metrics.durationMs / 60_000;
    const key = weekStartUtc(new Date(session.started_at).getTime());

    let week = byWeek.get(key);
    if (!week) {
      week = {
        weekStartMs: key,
        sessionCount: 0,
        durationMin: 0,
        distanceKm: 0,
        zoneMinutes: emptyZones(),
      };
      byWeek.set(key, week);
    }

    week.sessionCount += 1;
    week.durationMin += durationMin;
    week.distanceKm += metrics.distanceM === null ? 0 : metrics.distanceM / 1000;

    // Time in zone ≈ HR-sample share of the zone × the session's duration.
    const shares = zoneDistribution(rows, maxHr);
    for (const share of shares) {
      week.zoneMinutes[share.zone] += share.fraction * durationMin;
    }
  }

  return [...byWeek.values()].sort((a, b) => a.weekStartMs - b.weekStartMs);
}

export interface ZoneLegendItem {
  zone: ZoneKey;
  label: string;
  color: string;
}

export const ZONE_LEGEND: readonly ZoneLegendItem[] = ZONE_KEYS.map((zone) => ({
  zone,
  label: hrZones[zone].label,
  color: hrZones[zone].color,
}));

/** Total minutes across all zones in a week (the stacked-bar height). */
export function weekZoneTotalMin(week: WeekVolume): number {
  return ZONE_KEYS.reduce((sum, z) => sum + week.zoneMinutes[z], 0);
}
