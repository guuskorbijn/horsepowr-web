/**
 * Effort service — segments a session into WORK bouts and RECOVERY from the
 * measured HR (with speed/GPS folded into each segment's stats). This is the
 * analyst's verification tool: "was the prescribed interval executed?".
 *
 * It mirrors the gait classifier's shape — a detector behind a factory, with
 * hysteresis (separate enter/exit HR) and a minimum-segment-duration merge so
 * the output is block-like, never per-second flicker. DERIVED ON READ; nothing
 * is written back to `measurements` or any new table.
 *
 * DESCRIPTIVE only: it reports what was executed (durations, HR, speed,
 * gradient). It never grades the effort or compares it to a target.
 */
import type { MeasurementRow } from '@/types/db';
import type { Effort, EffortKind } from '@/types/view';
import {
  DEFAULT_EFFORT_THRESHOLDS,
  type EffortThresholds,
} from '@/constants/effort';
import { haversineMetres } from '@/services/sessionMetrics';
import {
  buildGradientProfile,
  windowGradientStats,
  type GradientPoint,
} from '@/services/gradientService';

interface HrSample {
  t: number;
  hr: number;
}

interface RawSegment {
  kind: EffortKind;
  startTs: number;
  endTs: number;
}

function hrSamples(rows: MeasurementRow[], startMs: number): HrSample[] {
  const out: HrSample[] = [];
  for (const r of rows) {
    if (r.hr_bpm === null || !Number.isFinite(r.hr_bpm)) continue;
    out.push({ t: new Date(r.timestamp).getTime() - startMs, hr: r.hr_bpm });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Two-state HR classifier with an enter/exit hysteresis dead-zone. */
function classify(
  samples: HrSample[],
  enterBpm: number,
  exitBpm: number,
): Array<{ t: number; kind: EffortKind }> {
  const out: Array<{ t: number; kind: EffortKind }> = [];
  let state: EffortKind = 'recovery';
  for (const s of samples) {
    if (state === 'recovery' && s.hr >= enterBpm) state = 'work';
    else if (state === 'work' && s.hr < exitBpm) state = 'recovery';
    out.push({ t: s.t, kind: state });
  }
  return out;
}

function toSegments(
  classified: Array<{ t: number; kind: EffortKind }>,
  endTs: number,
): RawSegment[] {
  if (classified.length === 0) return [];
  const segs: RawSegment[] = [];
  let kind = classified[0]!.kind;
  let start = classified[0]!.t;
  for (let i = 1; i < classified.length; i++) {
    const c = classified[i]!;
    if (c.kind !== kind) {
      segs.push({ kind, startTs: start, endTs: c.t });
      kind = c.kind;
      start = c.t;
    }
  }
  segs.push({ kind, startTs: start, endTs });
  return segs;
}

/** Drops sub-minimum work/recovery runs by flipping them into their neighbour,
 *  then re-coalesces same-kind neighbours. Bridges brief HR dips and discards
 *  blips so each surviving bout is a real interval. */
function mergeShort(segs: RawSegment[], t: EffortThresholds): RawSegment[] {
  if (segs.length === 0) return segs;
  const flipped = segs.map((s) => {
    const dur = s.endTs - s.startTs;
    const tooShort =
      (s.kind === 'work' && dur < t.minWorkMs) ||
      (s.kind === 'recovery' && dur < t.minRecoveryMs);
    return tooShort ? { ...s, kind: other(s.kind) } : { ...s };
  });

  const merged: RawSegment[] = [];
  for (const seg of flipped) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind === seg.kind) prev.endTs = seg.endTs;
    else merged.push({ ...seg });
  }
  return merged;
}

function other(kind: EffortKind): EffortKind {
  return kind === 'work' ? 'recovery' : 'work';
}

/** Computes the descriptive stats for one segment from the rows it spans. */
function statsForSegment(
  seg: RawSegment,
  rows: MeasurementRow[],
  startMs: number,
  gradientProfile: GradientPoint[],
): Omit<Effort, 'kind' | 'workIndex'> {
  const hr: number[] = [];
  const speed: number[] = [];
  const gps: Array<{ lat: number; lng: number }> = [];
  for (const r of rows) {
    const t = new Date(r.timestamp).getTime() - startMs;
    if (t < seg.startTs || t > seg.endTs) continue;
    if (r.hr_bpm !== null && Number.isFinite(r.hr_bpm)) hr.push(r.hr_bpm);
    if (r.speed_ms !== null && Number.isFinite(r.speed_ms)) speed.push(r.speed_ms);
    if (r.lat !== null && r.lng !== null) gps.push({ lat: r.lat, lng: r.lng });
  }

  let distanceM: number | null = null;
  if (gps.length >= 2) {
    distanceM = 0;
    for (let i = 1; i < gps.length; i++) {
      distanceM += haversineMetres(gps[i - 1]!.lat, gps[i - 1]!.lng, gps[i]!.lat, gps[i]!.lng);
    }
  }

  const grad =
    gradientProfile.length > 0
      ? windowGradientStats(gradientProfile, seg.startTs, seg.endTs)
      : { avgGradient: null, climbM: null };

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    startTs: seg.startTs,
    endTs: seg.endTs,
    durationMs: seg.endTs - seg.startTs,
    distanceM,
    avgHr: avg(hr),
    peakHr: hr.length ? Math.max(...hr) : null,
    avgSpeedMs: avg(speed),
    maxSpeedMs: speed.length ? Math.max(...speed) : null,
    avgGradient: grad.avgGradient,
    climbM: grad.climbM,
  };
}

export interface EffortDetectionInput {
  rows: MeasurementRow[];
  startedAt: string;
  maxHr: number;
}

export interface EffortDetector {
  detect(input: EffortDetectionInput): Effort[];
}

/** Factory mirroring the gait classifier — thresholds are bound once here. */
export function createEffortDetector(
  thresholds: EffortThresholds = DEFAULT_EFFORT_THRESHOLDS,
): EffortDetector {
  return {
    detect({ rows, startedAt, maxHr }: EffortDetectionInput): Effort[] {
      const startMs = new Date(startedAt).getTime();
      const samples = hrSamples(rows, startMs);
      if (samples.length === 0) return [];

      const enterBpm = thresholds.workEnterFrac * maxHr;
      const exitBpm = thresholds.workExitFrac * maxHr;
      const endTs = samples[samples.length - 1]!.t;

      const classified = classify(samples, enterBpm, exitBpm);
      const segments = mergeShort(toSegments(classified, endTs), thresholds);
      const gradientProfile = buildGradientProfile(rows, startedAt);

      let workIndex = 0;
      return segments.map((seg) => {
        const isWork = seg.kind === 'work';
        if (isWork) workIndex += 1;
        return {
          kind: seg.kind,
          workIndex: isWork ? workIndex : null,
          ...statsForSegment(seg, rows, startMs, gradientProfile),
        };
      });
    },
  };
}

/** Convenience wrapper for callers that don't need to hold a detector. */
export function detectEfforts(
  input: EffortDetectionInput,
  thresholds: EffortThresholds = DEFAULT_EFFORT_THRESHOLDS,
): Effort[] {
  return createEffortDetector(thresholds).detect(input);
}

/** The work bouts only — what the Efforts table foregrounds. */
export function workEfforts(efforts: Effort[]): Effort[] {
  return efforts.filter((e) => e.kind === 'work');
}
