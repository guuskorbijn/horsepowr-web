/**
 * The smallest logger that keeps "no silent catches" honest.
 *
 * The RN app has a Logger abstraction; this repo had none, because until now
 * every failure path ended in a visible error state. The mirrored calendar
 * modules have paths that deliberately do NOT surface — a single malformed
 * targets blob costs one event its target rather than breaking the agenda —
 * and those must still leave a trace.
 */
export const log = {
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[horsepowr] ${message}`, context ?? '');
  },
  error(message: string, context?: Record<string, unknown>): void {
    console.error(`[horsepowr] ${message}`, context ?? '');
  },
  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') return;
    console.debug(`[horsepowr] ${message}`, context ?? '');
  },
};
