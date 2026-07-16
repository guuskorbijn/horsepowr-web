/**
 * getSessionForAnalyst — the meaty read-only tool. Loads one session in full and
 * returns the compact, model-facing AnalystSessionDetail:
 *   - descriptive metrics (reuses computeSessionMetrics)
 *   - time-in-zone (reuses zoneDistribution against the horse's max HR)
 *   - a correlated + downsampled HR/GPS curve (correlateAndResample) — the model
 *     never sees the raw split measurement rows
 *   - data-quality gaps (assessRecordingQuality + detectHrGaps) so it can tell an
 *     artifact from a physiological change
 *   - an estimated gait split (cached or derived on read from GPS speed)
 *
 * Org guard (defense-in-depth): the session is loaded under RLS, then we re-check
 * that its horse belongs to the caller's org. A session id from another org
 * resolves to a horse the caller can't read (getHorse → null under RLS), so we
 * return null — the tool reports "not found" without leaking existence. This does
 * not replace RLS; it backstops it.
 */
import type { Supa } from '@/lib/supabase/types';
import type { MeasurementRow } from '@/types/db';
import type { GaitBand } from '@/types/view';
import type { GaitKey } from '@/theme/tokens';
import { getSession } from '@/data/sessionRepository';
import { getHorse } from '@/data/horseRepository';
import { getMeasurements } from '@/data/measurementRepository';
import { getGaitSegments } from '@/data/gaitSegmentRepository';
import { computeSessionMetrics } from '@/services/sessionMetrics';
import { zoneDistribution } from '@/services/hrZone';
import { assessRecordingQuality } from '@/services/recordingQuality';
import { bandsFromCache, deriveGaitBands } from '@/services/gaitService';
import {
  correlateAndResample,
  detectHrGaps,
  DEFAULT_SERIES_POINTS,
} from '@/services/analyst/streamCorrelation';
import { toSessionSummary } from '@/services/analyst/lists';
import type {
  AnalystSessionDetail,
  AnalystGaitSummary,
  AnalystGaitSlice,
  AnalystZoneSlice,
} from '@/services/analyst/types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildGaitSummary(
  bands: GaitBand[],
  source: 'cache' | 'derived' | 'none',
): AnalystGaitSummary {
  if (source === 'none' || bands.length === 0) {
    return { source, dominant: null, byGait: [] };
  }
  const totals = new Map<GaitKey, number>();
  for (const b of bands) {
    const ms = Math.max(0, b.endTs - b.startTs);
    totals.set(b.gait, (totals.get(b.gait) ?? 0) + ms);
  }
  const grandMs = [...totals.values()].reduce((a, b) => a + b, 0);

  const byGait: AnalystGaitSlice[] = [...totals.entries()].map(([gait, ms]) => ({
    gait,
    seconds: Math.round(ms / 1000),
    fraction: grandMs > 0 ? round2(ms / grandMs) : 0,
  }));
  byGait.sort((a, b) => b.seconds - a.seconds);

  let dominant: GaitKey | null = null;
  let bestMs = 0;
  for (const [gait, ms] of totals) {
    if (gait === 'inactive') continue;
    if (ms > bestMs) {
      bestMs = ms;
      dominant = gait;
    }
  }
  return { source, dominant, byGait };
}

export async function getSessionForAnalyst(
  supa: Supa,
  orgId: string,
  input: { sessionId: string; seriesPoints?: number },
): Promise<AnalystSessionDetail | null> {
  const session = await getSession(supa, input.sessionId);
  if (!session) return null;

  const horse = await getHorse(supa, session.horse_id);
  // Org guard: unknown/foreign horse → treat the session as not found.
  if (!horse || horse.org_id !== orgId) return null;

  const rows: MeasurementRow[] = await getMeasurements(supa, input.sessionId);
  const maxHr = horse.max_hr;
  const metrics = computeSessionMetrics(session, rows);
  const durationMin =
    metrics.durationMs > 0 ? Math.round(metrics.durationMs / 60000) : null;
  const durationSec = metrics.durationMs / 1000;

  // Time-in-zone (share of HR samples), with approximate seconds in zone.
  const zones = zoneDistribution(rows, maxHr);
  const timeInZone: AnalystZoneSlice[] = zones.map((z) => ({
    zone: z.zone,
    label: z.label,
    fraction: round2(z.fraction),
    seconds: Math.round(z.fraction * durationSec),
  }));

  // Gait: prefer the mobile cache, else derive on read from GPS speed.
  const cached = await getGaitSegments(supa, input.sessionId);
  let gait: AnalystGaitSummary;
  if (cached) {
    gait = buildGaitSummary(bandsFromCache(cached.segments), 'cache');
  } else {
    const derived = deriveGaitBands(rows, session.started_at);
    gait = buildGaitSummary(derived, derived.length > 0 ? 'derived' : 'none');
  }

  // Data quality: completeness grade + gap locations on the shared clock.
  const quality = assessRecordingQuality(metrics);
  const gapInfo = detectHrGaps(rows, session.started_at);

  // Correlated + downsampled curve — raw split rows stop here.
  const series = correlateAndResample(
    rows,
    session.started_at,
    metrics.durationMs,
    input.seriesPoints ?? DEFAULT_SERIES_POINTS,
  );

  return {
    session: toSessionSummary(session, horse.name),
    horse: { id: horse.id, name: horse.name, maxHr, discipline: horse.discipline },
    durationMin,
    metrics: {
      distanceKm: metrics.distanceM === null ? null : round2(metrics.distanceM / 1000),
      avgHr: metrics.avgHr === null ? null : Math.round(metrics.avgHr),
      peakHr: metrics.peakHr === null ? null : Math.round(metrics.peakHr),
      minHr: metrics.minHr === null ? null : Math.round(metrics.minHr),
      avgSpeedKmh:
        metrics.avgSpeedMs === null ? null : round2(metrics.avgSpeedMs * 3.6),
      maxSpeedKmh:
        metrics.maxSpeedMs === null ? null : round2(metrics.maxSpeedMs * 3.6),
      altitudeGainM:
        metrics.altitudeGainM === null ? null : Math.round(metrics.altitudeGainM),
    },
    timeInZone,
    gait,
    dataQuality: {
      grade: quality.grade,
      hrCompleteness:
        quality.completeness === null ? null : round2(quality.completeness),
      hrSampleCount: metrics.hrSampleCount,
      gpsSampleCount: metrics.gpsSampleCount,
      gpsPresent: metrics.gpsSampleCount > 0,
      gapCount: gapInfo.gapCount,
      largestGapSec: gapInfo.largestGapSec,
      gaps: gapInfo.gaps,
      notes: quality.explanation,
    },
    series,
  };
}
