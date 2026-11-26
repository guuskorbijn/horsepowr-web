/** True when the user asked the OS for less motion. Safe where matchMedia is missing (tests, old browsers). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : true;
}
