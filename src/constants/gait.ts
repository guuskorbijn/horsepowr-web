/**
 * Gait speed-band thresholds — ANALYST-PENDING PLACEHOLDERS, mirrored from the
 * RN app (src/constants/gait.ts). Gait is ESTIMATED from GPS speed, never
 * measured, and is always presented as an estimate. Confirm the bands with the
 * Lips analyst before they drive production reports.
 */
import type { GaitKey } from '@/theme/tokens';

export interface GaitThresholds {
  /** At or below this speed (m/s): Inactive / standing. */
  inactiveMax: number;
  /** Upper bound of Walk (m/s); above it is Trot. */
  walkMax: number;
  /** Upper bound of Trot (m/s); above it is Canter. */
  trotMax: number;
  /** Hysteresis dead-zone (m/s) around each boundary, stops Walk<->Trot chatter. */
  hysteresisMs: number;
  /** Minimum segment duration (ms); shorter runs merge into a neighbour. */
  minSegmentMs: number;
}

export const DEFAULT_GAIT_THRESHOLDS: GaitThresholds = {
  inactiveMax: 0.5,
  walkMax: 2.2,
  trotMax: 4.5,
  hysteresisMs: 0.4,
  minSegmentMs: 3000,
};

/** Classifies a single instantaneous speed (m/s) into a gait, no hysteresis. */
export function gaitForSpeed(speedMs: number, t = DEFAULT_GAIT_THRESHOLDS): GaitKey {
  if (speedMs <= t.inactiveMax) return 'inactive';
  if (speedMs <= t.walkMax) return 'walk';
  if (speedMs <= t.trotMax) return 'trot';
  return 'canter';
}
