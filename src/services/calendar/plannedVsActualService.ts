/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit cc497bd, do not edit here.
 *
 * Source: horsepowr/src/services/calendar/plannedVsActualService.ts
 *
 * CLAUDE.md forbids importing the RN repo as a build dependency, and Vercel
 * builds this repo alone, so shared domain logic is copied rather than linked.
 * The copy is deliberate and checked: `npm run check:mirror` fails when this
 * file and its source have drifted, so the duplication is visible instead of
 * silent. Fix a bug in the mobile repo and re-run the mirror; never patch here.
 *
 * These modules are PURE on purpose — that is what makes them safe to mirror.
 * Anything touching Supabase, storage or React stays on its own side.
 */

import { getZone, zoneValueBands, type ZoneKey } from '@/services/hrZone';
import type { Measurement } from '@/types/measurement';
import type { TrainingTargets } from '@/services/calendar/trainingTargets';

/**
 * Planned versus measured — PURE, no I/O, no clock.
 *
 * Descriptive only. It returns numbers side by side and nothing else: no
 * rating, no verdict, no "good"/"bad" field, nothing a screen could colour
 * green or red. That is a product constraint, not a stylistic one (see
 * REQUIREMENTS §1: this product does not interpret data, a human analyst does).
 *
 * Two definitions are fixed here deliberately, and both are counter-intuitive
 * enough to be worth stating before the code:
 *
 * 1. THE TARGET RANGE IS INCLUSIVE AT BOTH ENDS.
 *    `inside <=> hrMinBpm <= bpm <= hrMaxBpm`. A human who writes "150-170"
 *    means 170 counts. This is deliberately DIFFERENT from `getZone`, which
 *    uses half-open `[low, high)` bands: those partition a continuum and must
 *    not double-count, whereas a target is a single human-authored interval.
 *    Do not "fix" the asymmetry.
 *
 * 2. THE PERCENTAGE IS OF COVERED TIME, NOT OF SESSION DURATION.
 *    Dwell is measured between consecutive HR samples and attributed to the
 *    EARLIER sample — the same convention `utils/sessionStats.computeStats`
 *    already uses, so there is exactly one dwell model in this codebase. But a
 *    BLE dropout would then attribute twenty minutes of silence to whatever the
 *    heart rate happened to be before the sensor dropped. So an interval longer
 *    than MAX_ATTRIBUTED_GAP_MS counts as UNCOVERED and is attributed to
 *    nothing. `insidePct` is therefore a share of `coveredMs`, and
 *    `coveragePct` is reported alongside it so the UI can say what the number
 *    is based on rather than hiding the gap.
 */

/**
 * Longest sample interval still attributed to a band.
 *
 * Aligned with `FAIR_MAX_GAP_MS` in utils/recordingQuality so "a gap worth
 * mentioning" and "a gap too big to attribute" are the same size — two
 * different thresholds for the same physical event would be impossible to
 * explain to a trainer.
 */
export const MAX_ATTRIBUTED_GAP_MS = 10_000;

export interface PlannedVsActualDuration {
  /** From the snapshot. Null when the plan said nothing about duration. */
  plannedMs: number | null;
  /** Wall-clock length of the recorded session. */
  measuredMs: number;
  /** measured - planned. Signed, never judged. Null without a plan. */
  deltaMs: number | null;
}

export interface PlannedVsActualHr {
  targetMinBpm: number | null;
  targetMaxBpm: number | null;
  /** Mean of every non-null HR sample. Null when there were none. */
  measuredAvgBpm: number | null;
  measuredPeakBpm: number | null;
  insideMs: number;
  belowMs: number;
  aboveMs: number;
  /** insideMs + belowMs + aboveMs. Excludes gaps too long to attribute. */
  coveredMs: number;
  /**
   * Share of COVERED time inside/below/above the target. Null when nothing
   * could be attributed at all — "unknown" is not the same as "zero", and a
   * single-sample session must not read as 0% inside target.
   */
  insidePct: number | null;
  belowPct: number | null;
  abovePct: number | null;
  /**
   * The HR zones the target range spans, as context for the numbers. Present
   * so the UI can always pair a heart rate with a Z label (DESIGN_SYSTEM §11),
   * never as an assessment of the target.
   */
  targetZones: ZoneKey[];
}

export interface PlannedVsActualCoverage {
  coveredMs: number;
  durationMs: number;
  /** coveredMs / durationMs as a percentage, clamped to 0-100. */
  coveragePct: number;
  /** Time in sample gaps too long to attribute to any band. */
  uncountedGapMs: number;
  /** Number of such gaps. */
  uncountedGapCount: number;
}

/**
 * Why there is no heart-rate comparison, when there is none.
 *
 * Two very different situations collapse into `hr: null`, and a card that
 * cannot tell them apart says the wrong thing: a session recorded without a
 * sensor against a plan that DID specify 150-170 would be reported as "this
 * plan had no heart-rate target". Making the reason explicit is the only way
 * the UI can be honest about which one happened.
 */
export type HrOmittedReason = 'no-target' | 'no-data';

export interface PlannedVsActual {
  duration: PlannedVsActualDuration;
  /** Null when the plan had no HR target, or the session captured no HR. */
  hr: PlannedVsActualHr | null;
  /** Set exactly when `hr` is null; null otherwise. */
  hrOmittedReason: HrOmittedReason | null;
  coverage: PlannedVsActualCoverage;
}

export interface PlannedVsActualInput {
  /** Targets as at session start — from the snapshot, never read live. */
  targets: TrainingTargets | null;
  /** Planned duration in whole minutes, from the snapshot. */
  plannedDurationMin: number | null;
  /** Every measurement row for the session; GPS-only rows are ignored here. */
  measurements: readonly Measurement[];
  startedAt: string;
  /** Null for a session that never finalised; then no comparison is possible. */
  endedAt: string | null;
  /** The horse's max HR, for the Z labels only. */
  maxHr: number;
  /** Override for tests. */
  maxAttributedGapMs?: number;
}

function tsMs(m: Measurement): number {
  return new Date(m.timestamp).getTime();
}

/** HR rows only, chronological, with unparseable timestamps dropped. */
function hrSamples(measurements: readonly Measurement[]): Measurement[] {
  return measurements
    .filter((m) => m.hr_bpm !== null && !Number.isNaN(tsMs(m)))
    .sort((a, b) => tsMs(a) - tsMs(b));
}

type Band = 'inside' | 'below' | 'above';

/**
 * Which side of the target a heart rate falls on.
 *
 * Inclusive at both ends (see the module comment). A one-sided target is
 * honoured on the side it specifies and unbounded on the other.
 */
export function classifyAgainstTarget(
  bpm: number,
  minBpm: number | null,
  maxBpm: number | null,
): Band {
  if (minBpm !== null && bpm < minBpm) return 'below';
  if (maxBpm !== null && bpm > maxBpm) return 'above';
  return 'inside';
}

/** The zones a target range touches, for Z-label context. */
export function targetZoneSpan(
  minBpm: number | null,
  maxBpm: number | null,
  maxHr: number,
): ZoneKey[] {
  if (minBpm === null && maxBpm === null) return [];
  const low = minBpm ?? maxBpm;
  const high = maxBpm ?? minBpm;
  if (low === null || high === null) return [];

  const span: ZoneKey[] = [];
  for (const band of zoneValueBands(maxHr)) {
    // A band belongs to the span when it overlaps the target interval at all.
    if (band.lowBpm <= high && band.highBpm >= low) span.push(band.zone);
  }
  // Fall back to the zone the single edge lands in, for a target narrower than
  // any band's resolution.
  if (span.length === 0) span.push(getZone(low, maxHr));
  return span;
}

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return (part / whole) * 100;
}

export function comparePlannedVsActual(
  input: PlannedVsActualInput,
): PlannedVsActual {
  const {
    targets,
    plannedDurationMin,
    measurements,
    startedAt,
    endedAt,
    maxHr,
    maxAttributedGapMs = MAX_ATTRIBUTED_GAP_MS,
  } = input;

  const startMs = new Date(startedAt).getTime();
  const endMs = endedAt === null ? startMs : new Date(endedAt).getTime();
  const durationMs = Number.isNaN(startMs) || Number.isNaN(endMs)
    ? 0
    : Math.max(0, endMs - startMs);

  const plannedMs =
    plannedDurationMin === null ? null : plannedDurationMin * 60_000;

  const duration: PlannedVsActualDuration = {
    plannedMs,
    measuredMs: durationMs,
    deltaMs: plannedMs === null ? null : durationMs - plannedMs,
  };

  const samples = hrSamples(measurements);

  // Dwell accounting. The loop stops one short because an interval needs a
  // following sample to have a length — the same reason computeStats does.
  const dwell: Record<Band, number> = { inside: 0, below: 0, above: 0 };
  let uncountedGapMs = 0;
  let uncountedGapCount = 0;

  const minBpm = targets?.hrMinBpm ?? null;
  const maxBpm = targets?.hrMaxBpm ?? null;
  const hasTarget = minBpm !== null || maxBpm !== null;

  for (let i = 0; i < samples.length - 1; i++) {
    const current = samples[i];
    const next = samples[i + 1];
    if (!current || !next) continue;
    const intervalMs = Math.max(0, tsMs(next) - tsMs(current));
    if (intervalMs > maxAttributedGapMs) {
      uncountedGapMs += intervalMs;
      uncountedGapCount += 1;
      continue;
    }
    if (!hasTarget) continue;
    const bpm = current.hr_bpm;
    if (bpm === null) continue;
    dwell[classifyAgainstTarget(bpm, minBpm, maxBpm)] += intervalMs;
  }

  const coveredMs = dwell.inside + dwell.below + dwell.above;

  const coverage: PlannedVsActualCoverage = {
    coveredMs,
    durationMs,
    coveragePct:
      durationMs <= 0 ? 0 : Math.min(100, Math.max(0, (coveredMs / durationMs) * 100)),
    uncountedGapMs,
    uncountedGapCount,
  };

  // No target, or no heart rate at all: duration-only comparison. Returning
  // null rather than a zeroed object keeps "there was nothing to compare"
  // distinguishable from "nothing was inside the target" — and the reason
  // keeps "the plan asked for nothing" distinguishable from "the sensor
  // recorded nothing", which are different facts about the session.
  if (!hasTarget) {
    return { duration, hr: null, hrOmittedReason: 'no-target', coverage };
  }
  if (samples.length === 0) {
    return { duration, hr: null, hrOmittedReason: 'no-data', coverage };
  }

  const bpms = samples
    .map((m) => m.hr_bpm)
    .filter((v): v is number => v !== null);

  const hr: PlannedVsActualHr = {
    targetMinBpm: minBpm,
    targetMaxBpm: maxBpm,
    measuredAvgBpm:
      bpms.length === 0
        ? null
        : Math.round(bpms.reduce((sum, v) => sum + v, 0) / bpms.length),
    measuredPeakBpm: bpms.length === 0 ? null : Math.max(...bpms),
    insideMs: dwell.inside,
    belowMs: dwell.below,
    aboveMs: dwell.above,
    coveredMs,
    insidePct: pct(dwell.inside, coveredMs),
    belowPct: pct(dwell.below, coveredMs),
    abovePct: pct(dwell.above, coveredMs),
    targetZones: targetZoneSpan(minBpm, maxBpm, maxHr),
  };

  return { duration, hr, hrOmittedReason: null, coverage };
}
