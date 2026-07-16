/**
 * HR↔GPS stream correlation for the analyst tools. Heart rate (Polar H10) and
 * speed/altitude (phone GPS) are SEPARATE measurement rows sharing a timestamp
 * clock. These pure functions align both streams onto one elapsed-time axis and
 * downsample to a compact, model-friendly series — so the model reasons about a
 * correlated curve, never the raw split rows. It also locates HR gaps (candidate
 * sensor dropouts) on the same clock.
 *
 * Resampling is time-bucketed mean per stream (not per-stream LTTB) precisely so
 * the two streams end up on the SAME set of timestamps — that shared clock is
 * the correlation. Empty buckets keep their slot with null values so a dropout
 * reads as a hole in the curve rather than being silently smoothed away.
 */
import type { MeasurementRow } from '@/types/db';
import type { AnalystSeries, AnalystSeriesPoint, AnalystDataGap } from '@/services/analyst/types';

/** Default resampled points for a session curve. */
export const DEFAULT_SERIES_POINTS = 60;
/** Never emit more than this many points to the model (token hygiene). */
export const MAX_SERIES_POINTS = 120;

/** Inter-HR-sample interval (s) above which we call it a gap. H10 streams ~1 Hz,
 *  so anything beyond a few seconds is a real hole, not normal jitter. */
const GAP_THRESHOLD_SEC = 5;
/** Most gaps to surface (the longest ones); the count/largest are always exact. */
const MAX_GAPS_REPORTED = 8;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface Bucket {
  hrSum: number;
  hrN: number;
  spSum: number;
  spN: number;
  altSum: number;
  altN: number;
}

/**
 * Correlate HR and GPS rows onto one clock and downsample to ~targetPoints
 * evenly-spaced time buckets across the session. Returns points in ascending
 * time; a bucket with no sample for a stream yields null for that field.
 */
export function correlateAndResample(
  rows: MeasurementRow[],
  startedAt: string,
  durationMs: number,
  targetPoints: number,
): AnalystSeries {
  const buckets = Math.max(1, Math.min(MAX_SERIES_POINTS, Math.floor(targetPoints)));
  const startMs = new Date(startedAt).getTime();

  if (!Number.isFinite(startMs) || durationMs <= 0 || rows.length === 0) {
    return { intervalSec: 0, points: [] };
  }

  const bucketMs = durationMs / buckets;
  const acc: Bucket[] = Array.from({ length: buckets }, () => ({
    hrSum: 0,
    hrN: 0,
    spSum: 0,
    spN: 0,
    altSum: 0,
    altN: 0,
  }));

  for (const r of rows) {
    const elapsed = new Date(r.timestamp).getTime() - startMs;
    if (!Number.isFinite(elapsed) || elapsed < 0) continue;
    let idx = Math.floor(elapsed / bucketMs);
    if (idx >= buckets) idx = buckets - 1;
    const b = acc[idx];
    if (!b) continue;
    if (r.hr_bpm !== null && Number.isFinite(r.hr_bpm)) {
      b.hrSum += r.hr_bpm;
      b.hrN += 1;
    }
    if (r.speed_ms !== null && Number.isFinite(r.speed_ms)) {
      b.spSum += r.speed_ms;
      b.spN += 1;
    }
    if (r.altitude_m !== null && Number.isFinite(r.altitude_m)) {
      b.altSum += r.altitude_m;
      b.altN += 1;
    }
  }

  const points: AnalystSeriesPoint[] = [];
  for (let i = 0; i < buckets; i++) {
    const b = acc[i];
    if (!b) continue;
    // Skip buckets that captured nothing at all — keeps the payload lean; a real
    // HR dropout still surfaces via detectHrGaps + the null hrBpm in adjacent
    // populated buckets.
    if (b.hrN === 0 && b.spN === 0 && b.altN === 0) continue;
    points.push({
      tSec: Math.round((i * bucketMs + bucketMs / 2) / 1000),
      hrBpm: b.hrN > 0 ? Math.round(b.hrSum / b.hrN) : null,
      speedKmh: b.spN > 0 ? round1((b.spSum / b.spN) * 3.6) : null,
      altitudeM: b.altN > 0 ? Math.round(b.altSum / b.altN) : null,
    });
  }

  return { intervalSec: Math.round(bucketMs / 1000), points };
}

export interface HrGapSummary {
  gaps: AnalystDataGap[];
  gapCount: number;
  largestGapSec: number;
}

/**
 * Find runs with no HR sample longer than GAP_THRESHOLD_SEC, on the shared clock.
 * Returns exact count and largest gap, plus the longest few gaps by time so the
 * model can point the reader at "the drop around 34 min".
 */
export function detectHrGaps(rows: MeasurementRow[], startedAt: string): HrGapSummary {
  const startMs = new Date(startedAt).getTime();
  const hrTimes = rows
    .filter((r) => r.hr_bpm !== null && Number.isFinite(r.hr_bpm))
    .map((r) => new Date(r.timestamp).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  const all: AnalystDataGap[] = [];
  for (let i = 1; i < hrTimes.length; i++) {
    const prev = hrTimes[i - 1];
    const cur = hrTimes[i];
    if (prev === undefined || cur === undefined) continue;
    const dtSec = (cur - prev) / 1000;
    if (dtSec > GAP_THRESHOLD_SEC) {
      all.push({
        startSec: Math.round((prev - startMs) / 1000),
        endSec: Math.round((cur - startMs) / 1000),
        durationSec: Math.round(dtSec),
      });
    }
  }

  const largestGapSec = all.reduce((max, g) => Math.max(max, g.durationSec), 0);
  const gaps = [...all]
    .sort((a, b) => b.durationSec - a.durationSec)
    .slice(0, MAX_GAPS_REPORTED)
    .sort((a, b) => a.startSec - b.startSec);

  return { gaps, gapCount: all.length, largestGapSec };
}
