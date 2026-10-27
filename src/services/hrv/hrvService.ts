/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit cc497bd, do not edit here.
 *
 * Source: horsepowr/src/services/hrv/hrvService.ts
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

/**
 * Heart-rate variability from the RR intervals the H10 already sends.
 *
 * PURE. Every session ever recorded has these intervals sitting in
 * `measurements.rr_ms` and nothing has ever read them, so this is retroactive
 * from the day it ships.
 *
 * WHAT IS AND IS NOT CLAIMED HERE
 *
 * rMSSD and SDNN are arithmetic over beat-to-beat intervals: measured
 * quantities in milliseconds, exactly like a distance in metres. This module
 * produces numbers and a coverage figure. No score, no readiness, no
 * "recovered / not recovered", nothing a vet would call a finding. That is a
 * decision for a human holding the horse, not for a function.
 *
 * WHY THE ARTEFACT FILTER IS NOT OPTIONAL
 *
 * A chest strap on a moving horse drops beats and picks up movement noise. A
 * missed beat shows up as one interval roughly twice its neighbours; a
 * double-counted one as two halves. Feeding those straight into rMSSD
 * manufactures variability the horse never produced — and rMSSD squares the
 * differences, so one bad interval can dominate a window. A filtered figure
 * beside an honest coverage percentage is worth something; an unfiltered one
 * is worse than nothing, because it looks identical.
 *
 * CALIBRATION IS STILL OPEN
 *
 * `PLAUSIBLE_RR_MS` brackets roughly 20–300 bpm, spanning a resting horse and
 * a galloping one with room to spare. Like the gait speed bands in
 * `src/constants/gait.ts` these are defensible defaults, not analyst-approved
 * values, and they sit in one place so narrowing them is a one-line change.
 */

/** RR intervals outside this range are not heartbeats. Milliseconds. */
export const PLAUSIBLE_RR_MS = { min: 200, max: 3000 } as const;

/**
 * How far an interval may differ from the previous accepted one. 0.2 = 20%.
 *
 * Consecutive beats do not jump by more than this outside an arrhythmia, so a
 * bigger step is a dropped or doubled beat far more often than a real one.
 * Being wrong is cheap and symmetric: a rejected real beat lowers coverage,
 * and coverage is reported.
 */
export const MAX_RELATIVE_STEP = 0.2;

/** Below this, a variability figure is not worth reporting. */
export const MIN_BEATS_FOR_HRV = 20;

export interface RrFilterResult {
  kept: number[];
  rejected: number;
  /** Share of the input that survived, 0..1. Null when there was no input. */
  coverage: number | null;
}

/**
 * Drops implausible and non-consecutive-looking intervals.
 *
 * The first interval has no predecessor, so it is judged on the plausibility
 * range alone. Each later one is compared with the last ACCEPTED interval
 * rather than the last raw one, so a single artefact cannot drag the
 * reference along and reject the good beats behind it.
 */
export function filterRrArtefacts(intervals: readonly number[]): RrFilterResult {
  const kept: number[] = [];
  let rejected = 0;
  let reference: number | null = null;

  for (const interval of intervals) {
    const plausible =
      Number.isFinite(interval) &&
      interval >= PLAUSIBLE_RR_MS.min &&
      interval <= PLAUSIBLE_RR_MS.max;
    if (!plausible) {
      rejected += 1;
      continue;
    }
    if (reference !== null) {
      const step = Math.abs(interval - reference) / reference;
      if (step > MAX_RELATIVE_STEP) {
        rejected += 1;
        continue;
      }
    }
    kept.push(interval);
    reference = interval;
  }

  const total = kept.length + rejected;
  return { kept, rejected, coverage: total === 0 ? null : kept.length / total };
}

/**
 * Root mean square of successive differences, in milliseconds.
 *
 * Null below `MIN_BEATS_FOR_HRV`: rMSSD over a handful of beats is a number
 * without a meaning, and showing one invites a comparison it cannot support.
 */
export function rmssd(
  intervals: readonly number[],
  minBeats: number = MIN_BEATS_FOR_HRV,
): number | null {
  if (intervals.length < minBeats) return null;
  let sumSquares = 0;
  for (let i = 1; i < intervals.length; i += 1) {
    const diff = (intervals[i] ?? 0) - (intervals[i - 1] ?? 0);
    sumSquares += diff * diff;
  }
  const pairs = intervals.length - 1;
  if (pairs <= 0) return null;
  return Math.sqrt(sumSquares / pairs);
}

/** Standard deviation of the intervals, in milliseconds. */
export function sdnn(
  intervals: readonly number[],
  minBeats: number = MIN_BEATS_FOR_HRV,
): number | null {
  if (intervals.length < minBeats) return null;
  const mean = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
  const variance =
    intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
  return Math.sqrt(variance);
}

/** The shape this module needs from a measurement row. */
export interface RrSample {
  timestamp: string;
  rr_ms: number[] | null;
}

export interface HrvWindow {
  from: string;
  to: string;
}

export interface HrvResult {
  rmssdMs: number | null;
  sdnnMs: number | null;
  /** Mean interval over the window — heart rate, expressed the other way up. */
  meanRrMs: number | null;
  beats: number;
  coverage: number | null;
  window: HrvWindow | null;
}

const EMPTY: HrvResult = {
  rmssdMs: null,
  sdnnMs: null,
  meanRrMs: null,
  beats: 0,
  coverage: null,
  window: null,
};

/**
 * HRV over an explicit time window.
 *
 * Rows are selected on their timestamp and every interval they carry is
 * pooled in order. One BLE notification can carry several intervals, which is
 * why the arrays are flattened rather than sampled.
 */
export function hrvForWindow(
  samples: readonly RrSample[],
  window: HrvWindow,
): HrvResult {
  const fromMs = Date.parse(window.from);
  const toMs = Date.parse(window.to);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs <= fromMs) return EMPTY;

  const raw: number[] = [];
  for (const sample of samples) {
    if (sample.rr_ms === null || sample.rr_ms.length === 0) continue;
    const ms = Date.parse(sample.timestamp);
    if (Number.isNaN(ms) || ms < fromMs || ms > toMs) continue;
    raw.push(...sample.rr_ms);
  }
  if (raw.length === 0) return { ...EMPTY, window };

  const filtered = filterRrArtefacts(raw);
  const mean =
    filtered.kept.length === 0
      ? null
      : filtered.kept.reduce((sum, v) => sum + v, 0) / filtered.kept.length;

  return {
    rmssdMs: rmssd(filtered.kept),
    sdnnMs: sdnn(filtered.kept),
    meanRrMs: mean,
    beats: filtered.kept.length,
    coverage: filtered.coverage,
    window,
  };
}

/** The shape the window picker needs. */
export interface HrSample {
  timestamp: string;
  hr_bpm: number | null;
}

/** Default length of the window HRV is read over. */
export const DEFAULT_HRV_WINDOW_MS = 3 * 60_000;

/**
 * The quietest stretch of a session: the contiguous window of `windowMs` with
 * the lowest mean heart rate.
 *
 * Picking the window by DATA rather than by position is what makes the figure
 * comparable between sessions. "The first three minutes" would be a warm-up
 * on one day and a horse standing still on another; "the calmest three
 * minutes" is the same kind of moment every time.
 *
 * It is still only a definition, not a physiological resting state, which is
 * why the result carries its window — the reader can see WHEN it was taken
 * and disagree.
 */
export function calmestWindow(
  samples: readonly HrSample[],
  windowMs: number = DEFAULT_HRV_WINDOW_MS,
): HrvWindow | null {
  const points = samples
    .flatMap((sample) => {
      const ms = Date.parse(sample.timestamp);
      return sample.hr_bpm === null || Number.isNaN(ms)
        ? []
        : [{ ms, hr: sample.hr_bpm }];
    })
    .sort((a, b) => a.ms - b.ms);
  if (points.length === 0) return null;

  const span = (points[points.length - 1]?.ms ?? 0) - (points[0]?.ms ?? 0);
  // A session shorter than one window still has a calmest window: itself.
  if (span <= windowMs) {
    return {
      from: new Date(points[0]?.ms ?? 0).toISOString(),
      to: new Date(points[points.length - 1]?.ms ?? 0).toISOString(),
    };
  }

  let best: { from: number; to: number; mean: number } | null = null;
  let start = 0;
  let sum = 0;
  for (let end = 0; end < points.length; end += 1) {
    sum += points[end]?.hr ?? 0;
    while ((points[end]?.ms ?? 0) - (points[start]?.ms ?? 0) > windowMs) {
      sum -= points[start]?.hr ?? 0;
      start += 1;
    }
    const count = end - start + 1;
    // Only full-length windows compete, so a two-sample sliver at the end
    // cannot win on a mean taken from almost nothing.
    if ((points[end]?.ms ?? 0) - (points[start]?.ms ?? 0) < windowMs) continue;
    const mean = sum / count;
    if (best === null || mean < best.mean) {
      best = { from: points[start]?.ms ?? 0, to: points[end]?.ms ?? 0, mean };
    }
  }
  if (best === null) return null;
  return {
    from: new Date(best.from).toISOString(),
    to: new Date(best.to).toISOString(),
  };
}

/** HRV over the calmest window of a session. */
export function sessionHrv(
  samples: readonly (RrSample & HrSample)[],
  windowMs: number = DEFAULT_HRV_WINDOW_MS,
): HrvResult {
  const window = calmestWindow(samples, windowMs);
  if (window === null) return EMPTY;
  return hrvForWindow(samples, window);
}
