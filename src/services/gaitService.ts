/**
 * Gait service — derives estimated gait bands from GPS speed on read (mirrors
 * the mobile speed-band classifier), or maps the cached segments when present.
 * Gait is a DERIVED estimate, never written back onto measurements. Always
 * presented with a Walk/Trot/Canter/Inactive label, never colour alone.
 */
import type { GaitSegmentJson, MeasurementRow } from '@/types/db';
import type { GaitBand } from '@/types/view';
import type { GaitKey } from '@/theme/tokens';
import { DEFAULT_GAIT_THRESHOLDS, gaitForSpeed, type GaitThresholds } from '@/constants/gait';

interface SpeedSample {
  t: number;
  speed: number;
}

function toSpeedSamples(rows: MeasurementRow[], startedAt: string): SpeedSample[] {
  const startMs = new Date(startedAt).getTime();
  const out: SpeedSample[] = [];
  for (const r of rows) {
    if (r.speed_ms === null || !Number.isFinite(r.speed_ms)) continue;
    out.push({ t: new Date(r.timestamp).getTime() - startMs, speed: r.speed_ms });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Per-sample gait with a hysteresis dead-zone so boundaries don't chatter. */
function classifyWithHysteresis(
  samples: SpeedSample[],
  t: GaitThresholds,
): Array<{ t: number; gait: GaitKey }> {
  const result: Array<{ t: number; gait: GaitKey }> = [];
  let current: GaitKey | null = null;
  const bounds = [t.inactiveMax, t.walkMax, t.trotMax];
  const order: GaitKey[] = ['inactive', 'walk', 'trot', 'canter'];

  for (const s of samples) {
    const naive = gaitForSpeed(s.speed, t);
    if (current === null) {
      current = naive;
    } else if (naive !== current) {
      // Only switch if the speed has cleared the boundary by the hysteresis margin.
      const naiveIdx = order.indexOf(naive);
      const curIdx = order.indexOf(current);
      const boundaryIdx = naiveIdx > curIdx ? curIdx : naiveIdx;
      const boundary = bounds[boundaryIdx] ?? 0;
      const cleared =
        naiveIdx > curIdx
          ? s.speed >= boundary + t.hysteresisMs
          : s.speed < boundary - t.hysteresisMs;
      if (cleared) current = naive;
    }
    result.push({ t: s.t, gait: current });
  }
  return result;
}

function toBands(
  classified: Array<{ t: number; gait: GaitKey }>,
  endTs: number,
): GaitBand[] {
  if (classified.length === 0) return [];
  const bands: GaitBand[] = [];
  let runGait = classified[0]!.gait;
  let runStart = classified[0]!.t;
  for (let i = 1; i < classified.length; i++) {
    const c = classified[i]!;
    if (c.gait !== runGait) {
      bands.push({ gait: runGait, startTs: runStart, endTs: c.t });
      runGait = c.gait;
      runStart = c.t;
    }
  }
  bands.push({ gait: runGait, startTs: runStart, endTs });
  return bands;
}

/** Merges sub-minimum bands into the previous band so output is block-like. */
function mergeShort(bands: GaitBand[], minMs: number): GaitBand[] {
  if (bands.length <= 1) return bands;
  const merged: GaitBand[] = [];
  for (const band of bands) {
    const prev = merged[merged.length - 1];
    if (prev && band.endTs - band.startTs < minMs) {
      prev.endTs = band.endTs; // absorb the short run into the previous band
    } else {
      merged.push({ ...band });
    }
  }
  return merged;
}

/** Derives gait bands from raw rows (used when there's no cached segment row). */
export function deriveGaitBands(
  rows: MeasurementRow[],
  startedAt: string,
  thresholds: GaitThresholds = DEFAULT_GAIT_THRESHOLDS,
): GaitBand[] {
  const samples = toSpeedSamples(rows, startedAt);
  if (samples.length === 0) return [];
  const endTs = samples[samples.length - 1]!.t;
  const classified = classifyWithHysteresis(samples, thresholds);
  return mergeShort(toBands(classified, endTs), thresholds.minSegmentMs);
}

/** Maps cached gait segments (jsonb) to view bands. */
export function bandsFromCache(segments: GaitSegmentJson[]): GaitBand[] {
  return segments.map((s) => ({ gait: s.gait, startTs: s.startTs, endTs: s.endTs }));
}
