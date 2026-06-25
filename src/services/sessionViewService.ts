/**
 * Session view service — assembles the full descriptive view-model for one
 * session from raw rows. Reused by the deep session page and the export/print
 * path so the numbers are computed once, identically (DRY).
 */
import type { Supa } from '@/lib/supabase/types';
import { getSession } from '@/data/sessionRepository';
import { getHorse } from '@/data/horseRepository';
import { getMeasurements } from '@/data/measurementRepository';
import { getGaitSegments } from '@/data/gaitSegmentRepository';
import { invokeSessionSummary } from '@/data/aiSummaryRepository';
import { computeSessionMetrics } from '@/services/sessionMetrics';
import {
  altitudeSeries,
  hrSeries,
  routePoints,
  speedSeries,
} from '@/services/measurementService';
import { bandsFromCache, deriveGaitBands } from '@/services/gaitService';
import { zoneDistribution, type ZoneShare } from '@/services/hrZone';
import { assessRecordingQuality, type RecordingQuality } from '@/services/recordingQuality';
import { buildDeterministicSummary, type SessionSummary } from '@/services/sessionSummary';
import { detectEfforts } from '@/services/effortService';
import { effortThresholdsFor } from '@/constants/effort';
import {
  buildGradientProfile,
  analyzeClimbs,
  type GradientPoint,
  type ClimbSegment,
} from '@/services/gradientService';
import { analyzeHrSpeed, type HrSpeedAnalysis } from '@/services/hrSpeedService';
import { buildRecoveryDescent, type RecoveryDescent } from '@/services/recoveryService';
import type { HorseRow, SessionRow } from '@/types/db';
import type { ChartSeries, Effort, GaitBand, RoutePoint, SessionMetrics } from '@/types/view';

export interface SessionView {
  session: SessionRow;
  horse: HorseRow;
  maxHr: number;
  metrics: SessionMetrics;
  hr: ChartSeries | null;
  speed: ChartSeries | null;
  altitude: ChartSeries | null;
  route: RoutePoint[];
  gaitBands: GaitBand[];
  efforts: Effort[];
  gradientProfile: GradientPoint[];
  climbs: ClimbSegment[];
  hrSpeed: HrSpeedAnalysis;
  recovery: RecoveryDescent | null;
  zones: ZoneShare[];
  quality: RecordingQuality;
  summary: SessionSummary;
  gaitFromCache: boolean;
}

function nonEmpty(series: ChartSeries): ChartSeries | null {
  return series.points.length > 0 ? series : null;
}

/** Loads and computes everything the session view needs. Returns null when the
 *  session does not exist (or RLS hides it). */
export async function loadSessionView(
  supa: Supa,
  sessionId: string,
): Promise<SessionView | null> {
  const session = await getSession(supa, sessionId);
  if (!session) return null;
  const horse = await getHorse(supa, session.horse_id);
  if (!horse) return null;

  const rows = await getMeasurements(supa, sessionId);
  const maxHr = horse.max_hr;
  const metrics = computeSessionMetrics(session, rows);

  const cached = await getGaitSegments(supa, sessionId);
  const gaitBands = cached
    ? bandsFromCache(cached.segments)
    : deriveGaitBands(rows, session.started_at);

  const zones = zoneDistribution(rows, maxHr);
  const quality = assessRecordingQuality(metrics);

  // Effort/interval detection + gradient profile — both derived on read.
  const efforts = detectEfforts(
    { rows, startedAt: session.started_at, maxHr },
    effortThresholdsFor(horse.discipline),
  );
  const gradientProfile = buildGradientProfile(rows, session.started_at);
  const climbs = analyzeClimbs(rows, session.started_at, gradientProfile);
  const hrSpeed = analyzeHrSpeed(rows, session.started_at);
  const recovery = buildRecoveryDescent(rows, session.started_at, efforts);

  // Reuse the existing AI Edge Function; fall back to the deterministic summary.
  const aiLines = await invokeSessionSummary(supa, sessionId);
  const summary: SessionSummary = aiLines
    ? { source: 'ai', lines: aiLines }
    : buildDeterministicSummary(horse, metrics, zones, gaitBands);

  return {
    session,
    horse,
    maxHr,
    metrics,
    hr: nonEmpty(hrSeries(rows, session.started_at)),
    speed: nonEmpty(speedSeries(rows, session.started_at)),
    altitude: nonEmpty(altitudeSeries(rows, session.started_at)),
    route: routePoints(rows, session.started_at),
    gaitBands,
    efforts,
    gradientProfile,
    climbs,
    hrSpeed,
    recovery,
    zones,
    quality,
    summary,
    gaitFromCache: cached !== null,
  };
}
