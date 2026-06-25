/**
 * Gradient service — derives an ESTIMATED slope profile from GPS rows on read.
 * Altitude is smoothed (consumer GPS is noisy) then differentiated against the
 * horizontal distance travelled. Shared by the per-effort gradient (W11) and the
 * gradient strip + climbs summary (W15) so the math is written once (DRY).
 *
 * Gradient is an ESTIMATE, never a measured fact — every surface that shows it
 * pairs it with that caveat. Nothing here is written back to the database.
 */
import type { MeasurementRow } from '@/types/db';
import { haversineMetres } from '@/services/sessionMetrics';
import { DEFAULT_GRADIENT_PARAMS, type GradientParams } from '@/constants/gradient';

/** One point on the gradient profile, on the shared elapsed-ms clock. */
export interface GradientPoint {
  /** ms elapsed from session start. */
  t: number;
  /** Cumulative horizontal distance from the first GPS point (m). */
  cumDistanceM: number;
  /** Smoothed altitude (m). */
  altitudeM: number;
  /** Slope of the step ending at this point as a fraction (rise/run); +up, −down. */
  gradient: number;
}

interface GpsSample {
  t: number;
  lat: number;
  lng: number;
  alt: number | null;
}

function toGpsSamples(rows: MeasurementRow[], startedAt: string): GpsSample[] {
  const startMs = new Date(startedAt).getTime();
  const out: GpsSample[] = [];
  for (const r of rows) {
    if (r.lat === null || r.lng === null) continue;
    out.push({
      t: new Date(r.timestamp).getTime() - startMs,
      lat: r.lat,
      lng: r.lng,
      alt: r.altitude_m,
    });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Centered moving average over altitude; samples without altitude are skipped
 *  and the previous smoothed value carries forward. */
function smoothAltitude(samples: GpsSample[], window: number): Array<number | null> {
  const half = Math.max(0, Math.floor(window / 2));
  const out: Array<number | null> = [];
  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      const s = samples[j];
      if (!s || s.alt === null || !Number.isFinite(s.alt)) continue;
      sum += s.alt;
      count += 1;
    }
    out.push(count > 0 ? sum / count : null);
  }
  return out;
}

/**
 * Builds the gradient profile for a session. Returns an empty array when there
 * is no GPS or no usable altitude (HR-only sessions degrade to nothing here).
 */
export function buildGradientProfile(
  rows: MeasurementRow[],
  startedAt: string,
  params: GradientParams = DEFAULT_GRADIENT_PARAMS,
): GradientPoint[] {
  const samples = toGpsSamples(rows, startedAt);
  if (samples.length < 2) return [];
  const smoothed = smoothAltitude(samples, params.altitudeSmoothWindow);

  const points: GradientPoint[] = [];
  let cumDistance = 0;
  let lastAlt: number | null = null;
  let lastGradient = 0;
  let hasAltitude = false;

  for (let i = 0; i < samples.length; i++) {
    const cur = samples[i]!;
    const alt: number | null = smoothed[i] ?? lastAlt;
    if (alt !== null) hasAltitude = true;

    let gradient = lastGradient;
    if (i > 0) {
      const prev = samples[i - 1]!;
      const step = haversineMetres(prev.lat, prev.lng, cur.lat, cur.lng);
      cumDistance += step;
      if (step >= params.minStepM && alt !== null && lastAlt !== null) {
        gradient = (alt - lastAlt) / step;
        lastGradient = gradient;
      }
    }

    points.push({
      t: cur.t,
      cumDistanceM: cumDistance,
      altitudeM: alt ?? 0,
      gradient,
    });
    if (alt !== null) lastAlt = alt;
  }

  return hasAltitude ? points : [];
}

export interface GradientWindowStats {
  distanceM: number;
  /** Net rise / horizontal distance over the window, as a fraction. */
  avgGradient: number | null;
  /** Cumulative positive altitude change (m) — the "climb". */
  climbM: number | null;
}

/** Aggregates a gradient profile over an elapsed-time window [startTs, endTs]. */
export function windowGradientStats(
  profile: GradientPoint[],
  startTs: number,
  endTs: number,
  params: GradientParams = DEFAULT_GRADIENT_PARAMS,
): GradientWindowStats {
  const inWindow = profile.filter((p) => p.t >= startTs && p.t <= endTs);
  if (inWindow.length < 2) {
    return { distanceM: 0, avgGradient: null, climbM: null };
  }
  const first = inWindow[0]!;
  const last = inWindow[inWindow.length - 1]!;
  const distanceM = last.cumDistanceM - first.cumDistanceM;

  let climb = 0;
  for (let i = 1; i < inWindow.length; i++) {
    const delta = inWindow[i]!.altitudeM - inWindow[i - 1]!.altitudeM;
    if (delta >= params.minClimbStepM) climb += delta;
  }

  const netRise = last.altitudeM - first.altitudeM;
  const avgGradient = distanceM > params.minStepM ? netRise / distanceM : null;
  return { distanceM, avgGradient, climbM: climb };
}

/** Detected uphill run for the W15 climbs summary. */
export interface Climb {
  startTs: number;
  endTs: number;
  distanceM: number;
  climbM: number;
  avgGradient: number;
}

/** A climb enriched with the HR/speed measured during it (descriptive). */
export interface ClimbSegment extends Climb {
  avgHr: number | null;
  peakHr: number | null;
  avgSpeedMs: number | null;
  maxSpeedMs: number | null;
}

/** Detects uphill runs from the gradient profile, with enter/exit hysteresis and
 *  a minimum distance so GPS-altitude jitter doesn't invent climbs. */
export function detectClimbs(
  profile: GradientPoint[],
  params: GradientParams = DEFAULT_GRADIENT_PARAMS,
): Climb[] {
  if (profile.length < 2) return [];
  const climbs: Climb[] = [];
  let inClimb = false;
  let startIdx = 0;

  const flush = (endIdx: number) => {
    const start = profile[startIdx]!;
    const end = profile[endIdx]!;
    const stats = windowGradientStats(profile, start.t, end.t, params);
    if (stats.distanceM >= params.minClimbDistanceM && (stats.avgGradient ?? 0) > 0) {
      climbs.push({
        startTs: start.t,
        endTs: end.t,
        distanceM: stats.distanceM,
        climbM: stats.climbM ?? 0,
        avgGradient: stats.avgGradient ?? 0,
      });
    }
  };

  for (let i = 0; i < profile.length; i++) {
    const g = profile[i]!.gradient;
    if (!inClimb && g >= params.climbEnterGradient) {
      inClimb = true;
      startIdx = i;
    } else if (inClimb && g < params.climbExitGradient) {
      flush(i);
      inClimb = false;
    }
  }
  if (inClimb) flush(profile.length - 1);
  return climbs;
}

/** Detects climbs and enriches each with the HR/speed measured over it. */
export function analyzeClimbs(
  rows: MeasurementRow[],
  startedAt: string,
  profile: GradientPoint[],
  params: GradientParams = DEFAULT_GRADIENT_PARAMS,
): ClimbSegment[] {
  const climbs = detectClimbs(profile, params);
  if (climbs.length === 0) return [];
  const startMs = new Date(startedAt).getTime();

  return climbs.map((c) => {
    const hr: number[] = [];
    const speed: number[] = [];
    for (const r of rows) {
      const t = new Date(r.timestamp).getTime() - startMs;
      if (t < c.startTs || t > c.endTs) continue;
      if (r.hr_bpm !== null && Number.isFinite(r.hr_bpm)) hr.push(r.hr_bpm);
      if (r.speed_ms !== null && Number.isFinite(r.speed_ms)) speed.push(r.speed_ms);
    }
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    return {
      ...c,
      avgHr: avg(hr),
      peakHr: hr.length ? Math.max(...hr) : null,
      avgSpeedMs: avg(speed),
      maxSpeedMs: speed.length ? Math.max(...speed) : null,
    };
  });
}
