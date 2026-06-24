/**
 * Per-horse HR zone model (ported from the RN app). Zones are % of the horse's
 * configured max HR — never human reference values. Descriptive only: this
 * classifies measured HR into labelled bands, it does not judge effort.
 */
import { hrZones, type ZoneKey } from '@/theme/tokens';
import type { MeasurementRow } from '@/types/db';

export const DEFAULT_HORSE_MAX_HR = 240;

/** Lower-bound (inclusive) fraction of max HR for each zone. */
export const ZONE_BOUNDARIES: Readonly<Record<ZoneKey, number>> = {
  z1: 0,
  z2: 0.6,
  z3: 0.7,
  z4: 0.8,
  z5: 0.9,
};

const ZONE_ORDER: readonly ZoneKey[] = ['z1', 'z2', 'z3', 'z4', 'z5'];

export function getZone(bpm: number, maxHr: number): ZoneKey {
  const pct = bpm / maxHr;
  if (pct >= ZONE_BOUNDARIES.z5) return 'z5';
  if (pct >= ZONE_BOUNDARIES.z4) return 'z4';
  if (pct >= ZONE_BOUNDARIES.z3) return 'z3';
  if (pct >= ZONE_BOUNDARIES.z2) return 'z2';
  return 'z1';
}

export interface ZoneValueBand {
  zone: ZoneKey;
  label: string;
  color: string;
  lowBpm: number;
  highBpm: number;
}

/** Absolute bpm bands for the chart backdrop, scaled from the horse's max HR. */
export function zoneValueBands(maxHr: number): ZoneValueBand[] {
  return ZONE_ORDER.map((zone, idx) => {
    const low = ZONE_BOUNDARIES[zone];
    const nextZone = ZONE_ORDER[idx + 1];
    const high = nextZone ? ZONE_BOUNDARIES[nextZone] : 1;
    return {
      zone,
      label: hrZones[zone].label,
      color: hrZones[zone].color,
      lowBpm: low * maxHr,
      highBpm: high * maxHr,
    };
  });
}

export interface ZoneShare {
  zone: ZoneKey;
  label: string;
  color: string;
  /** Sample count in this zone. */
  count: number;
  /** Fraction of total HR samples [0..1]. */
  fraction: number;
}

/** Time-in-zone distribution from HR rows (by sample count — a measured fact). */
export function zoneDistribution(rows: MeasurementRow[], maxHr: number): ZoneShare[] {
  const counts: Record<ZoneKey, number> = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  let total = 0;
  for (const r of rows) {
    if (r.hr_bpm === null || !Number.isFinite(r.hr_bpm)) continue;
    counts[getZone(r.hr_bpm, maxHr)] += 1;
    total += 1;
  }
  return ZONE_ORDER.map((zone) => ({
    zone,
    label: hrZones[zone].label,
    color: hrZones[zone].color,
    count: counts[zone],
    fraction: total === 0 ? 0 : counts[zone] / total,
  }));
}
