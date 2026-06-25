/**
 * V-index trend service — the adaptation view. For each of a horse's sessions it
 * reuses the W12 hrSpeedService to compute that session's V-index and fitted
 * HR–speed line, then exposes them as a time series so the analyst can SEE the
 * relationship move across weeks.
 *
 * HARD GUARDRAIL: this only plots measured numbers (speed at HR x) and the raw
 * fitted curves. It draws no conclusion — no "improving/declining/fitter". The
 * human reads the trend. Pure functions; client-side aggregation over existing
 * rows; nothing persisted.
 */
import { analyzeHrSpeed, type HrSpeedFit, type VIndexValue } from '@/services/hrSpeedService';
import type { VIndexThreshold } from '@/constants/hrSpeed';
import type { MeasurementRow, SessionRow, TrainingType } from '@/types/db';

export interface SessionVIndex {
  sessionId: string;
  /** Session start as epoch ms (calendar x-axis). */
  t: number;
  startedAt: string;
  trainingType: TrainingType | null;
  vIndices: VIndexValue[];
  fit: HrSpeedFit | null;
}

export interface SessionWithRows {
  session: SessionRow;
  rows: MeasurementRow[];
}

export function sessionVIndex({ session, rows }: SessionWithRows): SessionVIndex {
  const a = analyzeHrSpeed(rows, session.started_at);
  return {
    sessionId: session.id,
    t: new Date(session.started_at).getTime(),
    startedAt: session.started_at,
    trainingType: session.training_type,
    vIndices: a.vIndices,
    fit: a.fit,
  };
}

/** Builds the per-session V-index series for a horse, ascending by date. */
export function buildVIndexTrend(inputs: SessionWithRows[]): SessionVIndex[] {
  return inputs.map(sessionVIndex).sort((a, b) => a.t - b.t);
}

export interface VTrendPoint {
  t: number;
  sessionId: string;
  speedKmh: number;
}

/** The reached V-values for one threshold, as (date, speed) points. */
export function vTrendPoints(
  trend: SessionVIndex[],
  threshold: VIndexThreshold,
): VTrendPoint[] {
  const out: VTrendPoint[] = [];
  for (const s of trend) {
    const v = s.vIndices.find((x) => x.hr === threshold);
    if (v && v.reached && v.speedKmh !== null) {
      out.push({ t: s.t, sessionId: s.sessionId, speedKmh: v.speedKmh });
    }
  }
  return out;
}

/** Filters a trend by an optional inclusive date range and training type. */
export function filterTrend(
  trend: SessionVIndex[],
  opts: { fromMs?: number | null; toMs?: number | null; trainingType?: TrainingType | null },
): SessionVIndex[] {
  return trend.filter((s) => {
    if (opts.fromMs != null && s.t < opts.fromMs) return false;
    if (opts.toMs != null && s.t > opts.toMs) return false;
    if (opts.trainingType != null && s.trainingType !== opts.trainingType) return false;
    return true;
  });
}
