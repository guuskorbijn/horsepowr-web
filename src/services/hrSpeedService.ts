/**
 * HR–speed service — the core descriptive fitness signal. Correlates measured HR
 * with measured speed (separate rows, paired by nearest timestamp), fits a
 * simple line over the locomotion range, and reads the speed at which HR crosses
 * each V-index threshold (V170/V180/V200).
 *
 * METHOD (documented so the analyst can validate it at Lips):
 *  - Each speed sample is paired with the nearest HR sample within a tolerance.
 *  - A least-squares line HR = a + b·speed is fit over points above a minimum
 *    speed (the aerobic/locomotion range), so the standing cluster doesn't flatten
 *    the slope. The relationship is treated as locally linear over that range.
 *  - V(threshold) = (threshold − a) / b, reported ONLY when the threshold lies
 *    within the session's observed HR range. Outside it we say "not reached"
 *    rather than extrapolate — never a judgment.
 *
 * DESCRIPTIVE only: V-values are plain measured speeds ("speed at HR 200"), never
 * "fitter"/"improving". Pure functions; nothing is persisted. Tested vs fixtures.
 */
import type { MeasurementRow } from '@/types/db';
import {
  DEFAULT_HR_SPEED_PARAMS,
  V_INDEX_THRESHOLDS,
  type HrSpeedParams,
  type VIndexThreshold,
} from '@/constants/hrSpeed';

export interface HrSpeedPoint {
  speedKmh: number;
  hr: number;
}

export interface HrSpeedFit {
  /** bpm per km/h. */
  slope: number;
  /** bpm at 0 km/h — for drawing the line only, not a claim about standing HR. */
  intercept: number;
  /** Speed domain the line was fit over (km/h). */
  domainKmh: [number, number];
  /** Number of points used in the fit. */
  n: number;
}

export interface VIndexValue {
  hr: VIndexThreshold;
  /** Speed (km/h) at which the fit crosses this HR, or null when not reached. */
  speedKmh: number | null;
  reached: boolean;
}

export interface HrSpeedAnalysis {
  points: HrSpeedPoint[];
  fit: HrSpeedFit | null;
  vIndices: VIndexValue[];
  observedHrRange: [number, number] | null;
}

interface TsSample {
  t: number;
  v: number;
}

function samplesOf(
  rows: MeasurementRow[],
  startMs: number,
  pick: (r: MeasurementRow) => number | null,
): TsSample[] {
  const out: TsSample[] = [];
  for (const r of rows) {
    const v = pick(r);
    if (v === null || !Number.isFinite(v)) continue;
    out.push({ t: new Date(r.timestamp).getTime() - startMs, v });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Nearest sample to time `t` via a forward cursor (both inputs are sorted). */
function nearestWithin(samples: TsSample[], t: number, tol: number): number | null {
  if (samples.length === 0) return null;
  // Binary search for the insertion point.
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid]!.t < t) lo = mid + 1;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[lo - 1];
  let best: TsSample | null = null;
  let bestGap = Infinity;
  for (const c of [a, b]) {
    if (!c) continue;
    const gap = Math.abs(c.t - t);
    if (gap < bestGap) {
      bestGap = gap;
      best = c;
    }
  }
  return best && bestGap <= tol ? best.v : null;
}

/** Pairs each speed sample with the nearest HR sample within tolerance. */
function pairPoints(
  rows: MeasurementRow[],
  startMs: number,
  params: HrSpeedParams,
): HrSpeedPoint[] {
  const hr = samplesOf(rows, startMs, (r) => r.hr_bpm);
  const speed = samplesOf(rows, startMs, (r) => r.speed_ms);
  const points: HrSpeedPoint[] = [];
  for (const s of speed) {
    const matched = nearestWithin(hr, s.t, params.pairToleranceMs);
    if (matched === null) continue;
    points.push({ speedKmh: s.v * 3.6, hr: matched });
  }
  return points;
}

/** Even strided downsample to keep the scatter light without biasing shape. */
function stride(points: HrSpeedPoint[], max: number): HrSpeedPoint[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: HrSpeedPoint[] = [];
  for (let i = 0; i < max; i++) {
    const p = points[Math.floor(i * step)];
    if (p) out.push(p);
  }
  return out;
}

function linearFit(points: HrSpeedPoint[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sx += p.speedKmh;
    sy += p.hr;
    sxx += p.speedKmh * p.speedKmh;
    sxy += p.speedKmh * p.hr;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

export function analyzeHrSpeed(
  rows: MeasurementRow[],
  startedAt: string,
  params: HrSpeedParams = DEFAULT_HR_SPEED_PARAMS,
): HrSpeedAnalysis {
  const startMs = new Date(startedAt).getTime();
  const allPoints = pairPoints(rows, startMs, params);

  if (allPoints.length === 0) {
    return { points: [], fit: null, vIndices: emptyVIndices(), observedHrRange: null };
  }

  const hrs = allPoints.map((p) => p.hr);
  const observedHrRange: [number, number] = [Math.min(...hrs), Math.max(...hrs)];

  const fitPoints = allPoints.filter((p) => p.speedKmh >= params.minFitSpeedKmh);
  const fitInput = fitPoints.length >= params.minFitPoints ? fitPoints : null;
  const coeffs = fitInput ? linearFit(fitInput) : null;

  let fit: HrSpeedFit | null = null;
  if (coeffs && fitInput) {
    const speeds = fitInput.map((p) => p.speedKmh);
    fit = {
      slope: coeffs.slope,
      intercept: coeffs.intercept,
      domainKmh: [Math.min(...speeds), Math.max(...speeds)],
      n: fitInput.length,
    };
  }

  return {
    points: stride(allPoints, params.maxScatterPoints),
    fit,
    vIndices: computeVIndices(fit, observedHrRange),
    observedHrRange,
  };
}

function emptyVIndices(): VIndexValue[] {
  return V_INDEX_THRESHOLDS.map((hr) => ({ hr, speedKmh: null, reached: false }));
}

/** Reads the crossing speed for each threshold, only within the observed HR
 *  range and only on a positive slope — otherwise "not reached" (no extrapolation). */
export function computeVIndices(
  fit: HrSpeedFit | null,
  observedHrRange: [number, number] | null,
): VIndexValue[] {
  return V_INDEX_THRESHOLDS.map((hr) => {
    if (!fit || !observedHrRange || fit.slope <= 0) {
      return { hr, speedKmh: null, reached: false };
    }
    const [loHr, hiHr] = observedHrRange;
    if (hr < loHr || hr > hiHr) return { hr, speedKmh: null, reached: false };
    const speedKmh = (hr - fit.intercept) / fit.slope;
    if (!Number.isFinite(speedKmh) || speedKmh < 0) {
      return { hr, speedKmh: null, reached: false };
    }
    return { hr, speedKmh, reached: true };
  });
}
