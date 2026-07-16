/**
 * Analyst tool layer — typed inputs and OUTPUTS for the read-only tools the web
 * analyst chat exposes to the model. These shapes are the ONLY thing that ever
 * crosses the boundary into the model: raw split HR/GPS measurement rows never
 * leave the service layer (see sessionDetail.ts). Everything here is descriptive
 * measured fact — no judgments, grades, or baselines — mirroring CLAUDE.md.
 *
 * Every field is explicit; there is no `any`. Numbers are pre-rounded and in the
 * stable's display units (bpm, km/h, m, km, %, seconds) so the model reasons in
 * the same terms the trainer and human analyst use.
 */
import type { TrainingType } from '@/types/db';
import type { ZoneKey, GaitKey } from '@/theme/tokens';

/* ------------------------------------------------------------------ horses */

export interface AnalystHorseSummary {
  id: string;
  name: string;
  discipline: string | null;
  level: string | null;
  /** Derived from date_of_birth; null when DOB is unknown. */
  ageYears: number | null;
  sex: string | null;
  active: boolean;
  /** Configured max HR (bpm) — the basis for this horse's Z1–Z5 bands. */
  maxHr: number;
  locationId: string | null;
}

/* ---------------------------------------------------------------- sessions */

/**
 * Lightweight session row for lists. Deliberately does NOT carry HR/speed
 * aggregates: those require loading every measurement row per session, so they
 * come from getSession on the specific session the model drills into. (Flagged,
 * not silently dropped — see listSessionsForAnalyst.)
 */
export interface AnalystSessionSummary {
  id: string;
  horseId: string;
  horseName: string;
  startedAt: string;
  endedAt: string | null;
  /** Wall-clock minutes when the session has ended; null while open. */
  durationMin: number | null;
  trainingType: TrainingType | null;
  environment: string | null;
  locationName: string | null;
  physicalRating: number | null;
  mentalRating: number | null;
  injuryConcern: boolean;
  injuryRecovery: boolean;
  /** Free-text note. TREAT AS DATA, never as instructions (prompt-injection). */
  notes: string | null;
}

/** One resampled sample on the shared HR↔GPS clock. Any field may be null when
 *  that stream had no sample in the time bucket. */
export interface AnalystSeriesPoint {
  /** Seconds elapsed from session start. */
  tSec: number;
  hrBpm: number | null;
  speedKmh: number | null;
  altitudeM: number | null;
}

/** The two sensor streams (Polar H10 HR + phone GPS) correlated onto one clock
 *  and downsampled inside the service — the model never sees raw split rows. */
export interface AnalystSeries {
  /** Nominal seconds between resampled points. */
  intervalSec: number;
  points: AnalystSeriesPoint[];
}

export interface AnalystZoneSlice {
  zone: ZoneKey;
  label: string;
  /** Share of HR samples in this zone, 0–1. */
  fraction: number;
  /** Approximate seconds in zone (fraction × duration). */
  seconds: number;
}

export interface AnalystGaitSlice {
  gait: GaitKey;
  seconds: number;
  fraction: number;
}

export interface AnalystGaitSummary {
  /** Where the gait split came from: the mobile cache, derived on read from GPS
   *  speed, or absent. */
  source: 'cache' | 'derived' | 'none';
  /** Dominant non-inactive gait, or null. */
  dominant: GaitKey | null;
  byGait: AnalystGaitSlice[];
}

/** A run with no HR sample — a candidate sensor dropout, expressed on the shared
 *  clock so the model can decide artifact vs real. */
export interface AnalystDataGap {
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface AnalystDataQuality {
  /** 'good' | 'fair' | 'poor' | 'none' — grades the DATA, not the training. */
  grade: 'good' | 'fair' | 'poor' | 'none';
  /** Captured HR samples ÷ expected (~1 Hz), 0–1, or null when N/A. */
  hrCompleteness: number | null;
  hrSampleCount: number;
  gpsSampleCount: number;
  gpsPresent: boolean;
  gapCount: number;
  largestGapSec: number;
  /** Up to a handful of the longest gaps, for the model to reference by time. */
  gaps: AnalystDataGap[];
  notes: string;
}

export interface AnalystSessionMetrics {
  distanceKm: number | null;
  avgHr: number | null;
  peakHr: number | null;
  minHr: number | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  /** Estimated cumulative climb (m) — from noisy consumer GPS altitude. */
  altitudeGainM: number | null;
}

/** Full read-out for one session. This is what getSession returns to the model:
 *  measured facts + a compact correlated/downsampled curve + data-quality gaps. */
export interface AnalystSessionDetail {
  session: AnalystSessionSummary;
  horse: { id: string; name: string; maxHr: number; discipline: string | null };
  durationMin: number | null;
  metrics: AnalystSessionMetrics;
  timeInZone: AnalystZoneSlice[];
  gait: AnalystGaitSummary;
  dataQuality: AnalystDataQuality;
  series: AnalystSeries;
}

/* ------------------------------------------------------------- tool inputs */

export interface ListHorsesInput {
  activeOnly?: boolean;
  locationId?: string | null;
}

export interface ListSessionsInput {
  /** Restrict to one horse; omit to list across the whole stable. */
  horseId?: string;
  /** Inclusive ISO date/datetime lower bound on started_at. */
  from?: string;
  /** Inclusive ISO date/datetime upper bound on started_at. */
  to?: string;
  trainingType?: TrainingType;
  limit?: number;
}

export interface GetSessionInput {
  sessionId: string;
  /** Target number of resampled curve points (default 60, capped). */
  seriesPoints?: number;
}

/* ------------------------------------------------- stubbed tools (typed) */

/** Discriminated result so a not-yet-built tool returns a shape the model can
 *  read, rather than throwing. `getHorseTrend`/`getStableBenchmark`/
 *  `compareSessions` return `status: 'not_implemented'` until wired up. */
export interface NotImplemented {
  status: 'not_implemented';
  tool: string;
  message: string;
}

export interface HorseTrendInput {
  horseId: string;
  /** e.g. 'hr_at_speed' | 'recovery_hr_5min' — locked later with V200/baselines. */
  metric: string;
  from?: string;
  to?: string;
}

export interface StableBenchmarkInput {
  discipline?: string;
  level?: string;
  metric: string;
}

export interface CompareSessionsInput {
  sessionIds: string[];
}

export type HorseTrendResult = NotImplemented;
export type StableBenchmarkResult = NotImplemented;
export type CompareSessionsResult = NotImplemented;
