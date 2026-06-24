/**
 * Measurement service — turns raw measurement rows into the view-model shapes
 * the charts and map consume. HR and GPS are separate rows correlated by
 * timestamp; this service filters by field and aligns everything to ms elapsed
 * from session start (the same clock the RN charts use). Pure functions only.
 */
import type { MeasurementRow } from '@/types/db';
import type { ChartPoint, ChartSeries, RoutePoint } from '@/types/view';

/** Target points per series for display. Deep-zoom/export use the raw rows. */
export const DISPLAY_POINT_TARGET = 1500;

function startMsOf(startedAt: string): number {
  return new Date(startedAt).getTime();
}

function elapsed(row: MeasurementRow, startMs: number): number {
  return new Date(row.timestamp).getTime() - startMs;
}

function buildSeries(
  rows: MeasurementRow[],
  startedAt: string,
  pick: (row: MeasurementRow) => number | null,
): ChartPoint[] {
  const startMs = startMsOf(startedAt);
  const points: ChartPoint[] = [];
  for (const row of rows) {
    const v = pick(row);
    if (v === null || !Number.isFinite(v)) continue;
    points.push({ t: elapsed(row, startMs), v });
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

export function hrSeries(rows: MeasurementRow[], startedAt: string): ChartSeries {
  return {
    key: 'hr',
    kind: 'hr',
    label: 'Heart rate',
    unit: 'bpm',
    color: 'var(--color-z2)',
    points: buildSeries(rows, startedAt, (r) => r.hr_bpm),
  };
}

export function speedSeries(rows: MeasurementRow[], startedAt: string): ChartSeries {
  return {
    key: 'speed',
    kind: 'speed',
    label: 'Speed',
    unit: 'km/h',
    color: 'var(--color-gait-trot)',
    // Stored in m/s; display in km/h.
    points: buildSeries(rows, startedAt, (r) =>
      r.speed_ms === null ? null : r.speed_ms * 3.6,
    ),
  };
}

export function altitudeSeries(rows: MeasurementRow[], startedAt: string): ChartSeries {
  return {
    key: 'altitude',
    kind: 'altitude',
    label: 'Altitude',
    unit: 'm',
    color: 'var(--color-text-tertiary)',
    points: buildSeries(rows, startedAt, (r) => r.altitude_m),
  };
}

/** Ordered GPS track for the route map. */
export function routePoints(rows: MeasurementRow[], startedAt: string): RoutePoint[] {
  const startMs = startMsOf(startedAt);
  const out: RoutePoint[] = [];
  for (const row of rows) {
    if (row.lat === null || row.lng === null) continue;
    out.push({ lat: row.lat, lng: row.lng, t: elapsed(row, startMs), speed: row.speed_ms });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/**
 * Largest-Triangle-Three-Buckets downsampling. Preserves visual shape (peaks /
 * troughs) far better than naive decimation, so a downsampled HR trace still
 * shows the spikes. Returns the input unchanged when already under threshold.
 */
export function downsample(points: ChartPoint[], threshold: number): ChartPoint[] {
  const n = points.length;
  if (threshold <= 2 || threshold >= n) return points;

  const first = points[0];
  const last = points[n - 1];
  if (!first || !last) return points;

  const sampled: ChartPoint[] = [first];
  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    // Average point of the *next* bucket.
    let avgX = 0;
    let avgY = 0;
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);
    const rangeLen = Math.max(rangeEnd - rangeStart, 1);
    for (let j = rangeStart; j < rangeEnd; j++) {
      const p = points[j];
      if (!p) continue;
      avgX += p.t;
      avgY += p.v;
    }
    avgX /= rangeLen;
    avgY /= rangeLen;

    // Pick the point in the current bucket forming the largest triangle.
    const pointA = points[a];
    if (!pointA) continue;
    let curStart = Math.floor(i * bucketSize) + 1;
    const curEnd = Math.floor((i + 1) * bucketSize) + 1;
    let maxArea = -1;
    let chosen = points[curStart];
    let chosenIndex = curStart;
    for (; curStart < curEnd; curStart++) {
      const p = points[curStart];
      if (!p) continue;
      const area =
        Math.abs(
          (pointA.t - avgX) * (p.v - pointA.v) - (pointA.t - p.t) * (avgY - pointA.v),
        ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        chosen = p;
        chosenIndex = curStart;
      }
    }
    if (chosen) {
      sampled.push(chosen);
      a = chosenIndex;
    }
  }

  sampled.push(last);
  return sampled;
}

/** Downsamples a whole series for display. */
export function downsampleSeries(
  series: ChartSeries,
  threshold = DISPLAY_POINT_TARGET,
): ChartSeries {
  return { ...series, points: downsample(series.points, threshold) };
}
