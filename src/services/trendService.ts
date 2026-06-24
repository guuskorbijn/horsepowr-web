/**
 * Trend service — DESCRIPTIVE aggregation of per-session metrics over time.
 *
 * HARD GUARDRAIL: this plots measured numbers only. No load score, no recovery
 * grade, no "improving/concerning", no baseline judgment. Labels name the metric
 * and its unit, nothing normative. The UI must keep it that way.
 */
import { computeSessionMetrics } from '@/services/sessionMetrics';
import type { MeasurementRow, SessionRow } from '@/types/db';

export type TrendMetric = 'duration' | 'distance' | 'avgHr' | 'avgSpeed';

export interface TrendMetricDef {
  key: TrendMetric;
  label: string;
  unit: string;
}

/** Descriptive metric definitions — neutral labels, no judgment. */
export const TREND_METRICS: readonly TrendMetricDef[] = [
  { key: 'duration', label: 'Duration', unit: 'min' },
  { key: 'distance', label: 'Distance', unit: 'km' },
  { key: 'avgHr', label: 'Avg HR', unit: 'bpm' },
  { key: 'avgSpeed', label: 'Avg speed', unit: 'km/h' },
];

export interface TrendPoint {
  /** Session start as epoch ms (calendar x-axis). */
  t: number;
  /** Metric value, or null when not measured for this session. */
  values: Record<TrendMetric, number | null>;
  sessionId: string;
}

export interface TrendSeries {
  label: string;
  color: string;
  points: TrendPoint[];
}

export interface SessionWithRows {
  session: SessionRow;
  rows: MeasurementRow[];
}

function pointFor(session: SessionRow, rows: MeasurementRow[]): TrendPoint {
  const m = computeSessionMetrics(session, rows);
  return {
    t: new Date(session.started_at).getTime(),
    sessionId: session.id,
    values: {
      duration: m.durationMs > 0 ? m.durationMs / 60000 : null,
      distance: m.distanceM === null ? null : m.distanceM / 1000,
      avgHr: m.avgHr,
      avgSpeed: m.avgSpeedMs === null ? null : m.avgSpeedMs * 3.6,
    },
  };
}

/** Builds one trend series for a horse from its sessions (ascending by date). */
export function buildHorseTrend(
  inputs: SessionWithRows[],
  label: string,
  color: string,
): TrendSeries {
  const points = inputs
    .map(({ session, rows }) => pointFor(session, rows))
    .sort((a, b) => a.t - b.t);
  return { label, color, points };
}
