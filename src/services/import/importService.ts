import { computeSessionMetrics, haversineMetres } from '@/services/sessionMetrics';
import { assessRecordingQuality, type QualityGrade } from '@/services/recordingQuality';
import { detectHrGaps } from '@/services/analyst/streamCorrelation';
import {
  MAX_PLAUSIBLE_SPEED_MS,
  MAX_SAMPLES_PER_STREAM,
  MAX_VALID_HR_BPM,
  MIN_VALID_HR_BPM,
} from '@/services/import/importLimits';
import {
  ImportError,
  type ActivityFormat,
  type ImportWarning,
  type ParsedActivity,
  type ParsedGpsSample,
  type ParsedHrSample,
} from '@/services/import/types';
import type { MeasurementRow, SessionRow } from '@/types/db';

/**
 * From a parsed file to what the trainer previews and what gets written —
 * PURE: no I/O, no clock, ids come from an injected function.
 *
 * The rows produced here are ordinary measurement rows in the canonical
 * storage model (CLAUDE.md): HR and GPS as SEPARATE rows, one per sample,
 * correlated by timestamp, timestamps in UTC as the file gave them. Nothing
 * marks them as imported, so every chart, export and analyst tool reads an
 * imported ride through exactly the same path as a recorded one.
 */

export interface NormalisedActivity {
  format: ActivityFormat;
  startedAt: string;
  endedAt: string;
  hr: ParsedHrSample[];
  gps: ParsedGpsSample[];
  sport: string | null;
  warnings: ImportWarning[];
}

const tsMs = (iso: string): number => Date.parse(iso);

/** Sorted by time, one sample per timestamp (the first wins), count of the rest. */
function sortAndDedupe<T extends { timestamp: string }>(samples: readonly T[]): { kept: T[]; dropped: number } {
  const sorted = [...samples].sort((a, b) => tsMs(a.timestamp) - tsMs(b.timestamp));
  const kept: T[] = [];
  let dropped = 0;
  for (const sample of sorted) {
    if (kept.length > 0 && kept[kept.length - 1]?.timestamp === sample.timestamp) dropped += 1;
    else kept.push(sample);
  }
  return { kept, dropped };
}

/**
 * Fills speed where the file has none (GPX never does), from the distance
 * between neighbouring fixes over their time difference. A derived speed
 * faster than a horse can run is GPS noise and stays null rather than
 * becoming a "peak speed".
 */
export function deriveMissingSpeeds(gps: readonly ParsedGpsSample[]): { samples: ParsedGpsSample[]; derived: number } {
  let derived = 0;
  const samples = gps.map((sample, i) => {
    if (sample.speedMs !== null) return sample;
    const prev = gps[i - 1] ?? sample;
    const next = gps[i + 1] ?? sample;
    const dtSec = (tsMs(next.timestamp) - tsMs(prev.timestamp)) / 1000;
    if (prev === next || dtSec <= 0) return sample;
    const speed = haversineMetres(prev.lat, prev.lng, next.lat, next.lng) / dtSec;
    if (!Number.isFinite(speed) || speed > MAX_PLAUSIBLE_SPEED_MS) return sample;
    derived += 1;
    return { ...sample, speedMs: Math.round(speed * 100) / 100 };
  });
  return { samples, derived };
}

/**
 * Validates and orders what a parser produced. Implausible values are
 * dropped and COUNTED (a warning, never silence); a file with no usable
 * sample at all, or more samples than a day at 1 Hz allows, is refused.
 */
export function normaliseActivity(parsed: ParsedActivity): NormalisedActivity {
  const warnings: ImportWarning[] = [...parsed.warnings];
  if (parsed.hr.length > MAX_SAMPLES_PER_STREAM || parsed.gps.length > MAX_SAMPLES_PER_STREAM) {
    throw new ImportError('too-many-samples');
  }

  let invalid = 0;
  const validHr = parsed.hr.filter((s) => {
    const ok = Number.isFinite(s.bpm) && s.bpm >= MIN_VALID_HR_BPM && s.bpm <= MAX_VALID_HR_BPM;
    if (!ok) invalid += 1;
    return ok;
  });
  const validGps = parsed.gps.filter((s) => {
    const ok =
      Number.isFinite(s.lat) && Number.isFinite(s.lng) &&
      Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180 &&
      // (0,0) is a receiver with no fix, not a stable in the Gulf of Guinea.
      !(s.lat === 0 && s.lng === 0);
    if (!ok) invalid += 1;
    return ok;
  });

  const hr = sortAndDedupe(validHr);
  const gpsSorted = sortAndDedupe(
    validGps.map((s) => ({
      ...s,
      speedMs: s.speedMs !== null && Number.isFinite(s.speedMs) && s.speedMs >= 0 ? s.speedMs : null,
      altitudeM: s.altitudeM !== null && Number.isFinite(s.altitudeM) ? s.altitudeM : null,
    })),
  );
  const gps = deriveMissingSpeeds(gpsSorted.kept);

  if (hr.kept.length === 0 && gps.samples.length === 0) throw new ImportError('no-samples');

  if (invalid > 0) warnings.push({ code: 'invalid-samples-dropped', count: invalid });
  const duplicates = hr.dropped + gpsSorted.dropped;
  if (duplicates > 0) warnings.push({ code: 'duplicate-timestamps-dropped', count: duplicates });
  if (hr.kept.length === 0) warnings.push({ code: 'no-hr' });
  if (gps.samples.length === 0) warnings.push({ code: 'no-gps' });
  if (gps.derived > 0) warnings.push({ code: 'speed-derived', count: gps.derived });

  const times = [...hr.kept, ...gps.samples].map((s) => tsMs(s.timestamp));
  const first = Math.min(...times);
  const last = Math.max(...times);
  // A declared start AFTER the first sample would hide data before it.
  const declared = tsMs(parsed.startedAt);
  const start = Number.isNaN(declared) ? first : Math.min(declared, first);

  return {
    format: parsed.format,
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(last).toISOString(),
    hr: hr.kept,
    gps: gps.samples,
    sport: parsed.sport,
    warnings,
  };
}

/** Deterministic id for one row; the caller supplies uuid v5 (server) or a stub (tests). */
export type RowIdFor = (kind: 'hr' | 'gps', index: number) => string;

/** HR rows and GPS rows, separate, in time order with ties broken HR first. */
export function buildMeasurementRows(
  activity: NormalisedActivity,
  sessionId: string,
  idFor: RowIdFor,
): MeasurementRow[] {
  const hrRows: MeasurementRow[] = activity.hr.map((s, i) => ({
    id: idFor('hr', i),
    session_id: sessionId,
    timestamp: s.timestamp,
    hr_bpm: Math.round(s.bpm),
    rr_ms: s.rrMs !== null && s.rrMs.length > 0 ? s.rrMs : null,
    speed_ms: null,
    altitude_m: null,
    lat: null,
    lng: null,
  }));
  const gpsRows: MeasurementRow[] = activity.gps.map((s, i) => ({
    id: idFor('gps', i),
    session_id: sessionId,
    timestamp: s.timestamp,
    hr_bpm: null,
    rr_ms: null,
    speed_ms: s.speedMs,
    altitude_m: s.altitudeM,
    lat: s.lat,
    lng: s.lng,
  }));
  return [...hrRows, ...gpsRows].sort(
    (a, b) => tsMs(a.timestamp) - tsMs(b.timestamp) || (a.hr_bpm === null ? 1 : 0) - (b.hr_bpm === null ? 1 : 0),
  );
}

/** What the trainer sees before confirming. Measured facts only. */
export interface ImportPreview {
  format: ActivityFormat;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  distanceM: number | null;
  avgHr: number | null;
  peakHr: number | null;
  /** km/h, one decimal. */
  peakSpeedKmh: number | null;
  hrSampleCount: number;
  gpsSampleCount: number;
  rrIntervalCount: number;
  /** Recording-quality grade of the DATA, the same one recorded sessions get. */
  qualityGrade: QualityGrade;
  hrGapCount: number;
  largestHrGapSec: number;
  sport: string | null;
  warnings: ImportWarning[];
}

/** A session row as it would be stored, for the shared metric functions. */
function draftSession(activity: NormalisedActivity): SessionRow {
  return {
    id: 'preview',
    horse_id: 'preview',
    started_at: activity.startedAt,
    ended_at: activity.endedAt,
    notes: null,
    synced: true,
    created_at: activity.startedAt,
    training_type: null,
    environment: null,
    location_name: null,
    physical_rating: null,
    mental_rating: null,
    injury_concern: false,
    injury_recovery: false,
  };
}

export function buildImportPreview(activity: NormalisedActivity): ImportPreview {
  const rows = buildMeasurementRows(activity, 'preview', (kind, i) => `${kind}-${i}`);
  const metrics = computeSessionMetrics(draftSession(activity), rows);
  const quality = assessRecordingQuality(metrics);
  const gaps = detectHrGaps(rows, activity.startedAt);

  const warnings = [...activity.warnings];
  if (gaps.gapCount > 0) warnings.push({ code: 'hr-gaps', count: gaps.gapCount, seconds: gaps.largestGapSec });

  return {
    format: activity.format,
    startedAt: activity.startedAt,
    endedAt: activity.endedAt,
    durationSec: Math.round(metrics.durationMs / 1000),
    distanceM: metrics.distanceM === null ? null : Math.round(metrics.distanceM),
    avgHr: metrics.avgHr === null ? null : Math.round(metrics.avgHr),
    peakHr: metrics.peakHr,
    peakSpeedKmh: metrics.maxSpeedMs === null ? null : Math.round(metrics.maxSpeedMs * 36) / 10,
    hrSampleCount: metrics.hrSampleCount,
    gpsSampleCount: metrics.gpsSampleCount,
    rrIntervalCount: activity.hr.reduce((sum, s) => sum + (s.rrMs?.length ?? 0), 0),
    qualityGrade: quality.grade,
    hrGapCount: gaps.gapCount,
    largestHrGapSec: gaps.largestGapSec,
    sport: activity.sport,
    warnings,
  };
}
