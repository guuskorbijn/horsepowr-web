/**
 * Effort / interval detection thresholds — ANALYST-PENDING PLACEHOLDERS. Mirrors
 * the RN gait-threshold convention (named constants, overridable, validated by
 * the analyst at Lips — never baked in as truth).
 *
 * A "work" bout is detected when measured HR rises into the working range and
 * ends when it falls back; enter/exit differ to give hysteresis (no flicker on a
 * HR that hovers near one line). Thresholds are fractions of the horse's own
 * max HR so they scale per animal, exactly like the HR zones (max_hr=240).
 *
 * This detects EXECUTED effort from the data. It does NOT judge whether the
 * prescribed effort was correct — that reading is the analyst's.
 */
export interface EffortThresholds {
  /** Enter a work bout at/above this fraction of the horse's max HR. */
  workEnterFrac: number;
  /** Fall back to recovery below this fraction (must be < workEnterFrac). */
  workExitFrac: number;
  /** Minimum work-bout duration (ms); shorter bouts merge into recovery. */
  minWorkMs: number;
  /** Minimum recovery-gap duration (ms); shorter dips bridge two work bouts. */
  minRecoveryMs: number;
}

export const DEFAULT_EFFORT_THRESHOLDS: EffortThresholds = {
  workEnterFrac: 0.75, // ~Z3/Z4 boundary on the per-horse zone model
  workExitFrac: 0.7, // ~Z3 lower bound — the hysteresis dead-zone
  minWorkMs: 20_000,
  minRecoveryMs: 15_000,
};

/**
 * Per-discipline overrides, keyed by a normalised discipline string. Empty for
 * now — the analyst calibrates these at Lips. `effortThresholdsFor` falls back
 * to the default for any unknown discipline, so adding one is a one-line change.
 */
export const EFFORT_THRESHOLDS_BY_DISCIPLINE: Readonly<
  Record<string, Partial<EffortThresholds>>
> = {};

export function effortThresholdsFor(discipline: string | null): EffortThresholds {
  if (!discipline) return DEFAULT_EFFORT_THRESHOLDS;
  const override = EFFORT_THRESHOLDS_BY_DISCIPLINE[discipline.trim().toLowerCase()];
  return override ? { ...DEFAULT_EFFORT_THRESHOLDS, ...override } : DEFAULT_EFFORT_THRESHOLDS;
}
