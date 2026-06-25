/**
 * Gradient estimation parameters — ANALYST-PENDING PLACEHOLDERS. Consumer-GPS
 * altitude is noisy (REQUIREMENTS §8.4), so gradient is always an ESTIMATE,
 * smoothed before it is differentiated and presented with an "estimate" caveat,
 * never as a measured truth. Confirm the smoothing window with the Lips analyst.
 */
export interface GradientParams {
  /** Moving-average window (samples) applied to altitude before differentiating. */
  altitudeSmoothWindow: number;
  /** Minimum horizontal step (m) between two points to compute a gradient — below
   *  this, GPS jitter dominates and the segment inherits the previous gradient. */
  minStepM: number;
  /** A point counts toward "climb" metres only once cumulative rise exceeds this
   *  (m), filtering altitude flutter from inflating the climb total. */
  minClimbStepM: number;
  /** Enter a "climb" run when the estimated gradient rises to/above this (rise/run). */
  climbEnterGradient: number;
  /** Leave a climb run when the gradient falls below this (hysteresis: < enter). */
  climbExitGradient: number;
  /** Discard detected climbs shorter than this horizontal distance (m). */
  minClimbDistanceM: number;
}

export const DEFAULT_GRADIENT_PARAMS: GradientParams = {
  altitudeSmoothWindow: 5,
  minStepM: 3,
  minClimbStepM: 0.4,
  climbEnterGradient: 0.03, // ~3%
  climbExitGradient: 0.01, // ~1%
  minClimbDistanceM: 30,
};
