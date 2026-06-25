/**
 * HR–speed relationship & V-index parameters — ANALYST-PENDING PLACEHOLDERS.
 *
 * The core descriptive fitness signal: at a given speed, a fitter horse shows a
 * lower HR. V200 is the speed at which HR reaches 200 bpm (V170/V180 likewise).
 * These are MEASURED VALUES read off a fitted line — never a grade. The analyst
 * validates the fit method and these thresholds at Lips; they are named
 * constants so recalibration is a one-line change, mirroring the gait/max_hr
 * convention in the RN project.
 */

/** HR thresholds (bpm) whose crossing speed we report. Order = display order. */
export const V_INDEX_THRESHOLDS = [170, 180, 200] as const;
export type VIndexThreshold = (typeof V_INDEX_THRESHOLDS)[number];

export interface HrSpeedParams {
  /** Pair an HR sample with a speed sample only within this gap (ms). HR and GPS
   *  are separate rows correlated by timestamp, so they rarely share an exact ts. */
  pairToleranceMs: number;
  /** Only fit over locomotion: drop the standing/walk cluster below this speed
   *  (km/h) so the flat low-speed mass doesn't dominate the aerobic slope. */
  minFitSpeedKmh: number;
  /** Need at least this many paired points to attempt a fit. */
  minFitPoints: number;
  /** Cap the rendered scatter to this many points (strided downsample). */
  maxScatterPoints: number;
}

export const DEFAULT_HR_SPEED_PARAMS: HrSpeedParams = {
  pairToleranceMs: 2500,
  minFitSpeedKmh: 10,
  minFitPoints: 12,
  maxScatterPoints: 600,
};
