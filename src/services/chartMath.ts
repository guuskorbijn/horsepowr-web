/**
 * Chart math — pure helpers shared by the single-session, comparison and trend
 * charts (DRY). No rendering, no DOM. The actual SVG components build d3 scales
 * from these domains; keeping the math here makes it testable and reusable.
 */
import { bisector, extent } from 'd3-array';
import type { ChartPoint, ChartSeries } from '@/types/view';

export type Domain = [number, number];

const bisectT = bisector<ChartPoint, number>((p) => p.t).left;

/** mm:ss (or h:mm:ss past an hour) for an elapsed-ms axis tick. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Combined elapsed-time domain across one or more series. */
export function xDomainOf(seriesList: ChartSeries[]): Domain {
  let min = Infinity;
  let max = -Infinity;
  for (const s of seriesList) {
    for (const p of s.points) {
      if (p.t < min) min = p.t;
      if (p.t > max) max = p.t;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [0, 1];
  return [min, max];
}

/** Y domain for series, optionally limited to a visible x-window, with padding. */
export function yDomainOf(
  seriesList: ChartSeries[],
  xWindow?: Domain,
  pad = 0.08,
): Domain {
  const values: number[] = [];
  for (const s of seriesList) {
    for (const p of s.points) {
      if (xWindow && (p.t < xWindow[0] || p.t > xWindow[1])) continue;
      values.push(p.v);
    }
  }
  const [lo, hi] = extent(values);
  if (lo === undefined || hi === undefined) return [0, 1];
  if (lo === hi) return [lo - 1, hi + 1];
  const span = hi - lo;
  return [lo - span * pad, hi + span * pad];
}

/** Nearest point to an elapsed time `t` (for the crosshair readout). */
export function nearestPoint(points: ChartPoint[], t: number): ChartPoint | null {
  if (points.length === 0) return null;
  const i = bisectT(points, t);
  const before = points[i - 1];
  const after = points[i];
  if (!before) return after ?? null;
  if (!after) return before ?? null;
  return t - before.t <= after.t - t ? before : after;
}

/** Points within a visible window (for re-windowed downsampling on zoom). */
export function pointsInWindow(points: ChartPoint[], xWindow: Domain): ChartPoint[] {
  return points.filter((p) => p.t >= xWindow[0] && p.t <= xWindow[1]);
}

/** Clamps a candidate [min,max] window inside the full domain, keeping span. */
export function clampWindow(candidate: Domain, full: Domain): Domain {
  const fullSpan = full[1] - full[0];
  let [a, b] = candidate;
  const span = Math.min(b - a, fullSpan);
  if (a < full[0]) {
    a = full[0];
    b = a + span;
  }
  if (b > full[1]) {
    b = full[1];
    a = b - span;
  }
  return [Math.max(full[0], a), Math.min(full[1], b)];
}
