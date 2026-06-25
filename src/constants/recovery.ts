/**
 * Recovery-descent parameters. The recovery curve is a MEASURED FACT — how far
 * HR fell after the last effort. We deliberately stop at stating the numbers:
 * NO recovery score, NO Better/Normal label (that is the competitor's normative
 * feature — not copied). The analyst interprets the descent.
 */

/** Seconds after the last effort at which we report the measured HR drop. */
export const RECOVERY_MARKS_SEC = [60, 300, 600] as const;
export type RecoveryMarkSec = (typeof RECOVERY_MARKS_SEC)[number];

/** A measured HR sample must fall within this window (ms) of a mark to count;
 *  otherwise that mark is reported honestly as "not recorded". */
export const RECOVERY_MARK_TOLERANCE_MS = 20_000;
