/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit 3166118, do not edit here.
 *
 * Source: horsepowr/src/constants/motion.ts
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
 * Motion tokens.
 *
 * DESIGN_SYSTEM §10 asks for "purposeful, quick — 150-250ms, ease-out", and
 * before these existed the codebase had 120, 200, 220 and 1800 hard-coded
 * across four screens with no shared meaning. Naming them is what makes
 * "consistent" checkable rather than aspirational.
 *
 * `breath` and `travel` are the two long ones, and they are long on purpose:
 * they belong to things that loop while you wait or while you ride, where a
 * 200ms cycle would be a strobe rather than a heartbeat.
 */
export const motion = {
  /** A control acknowledging a touch. Barely perceptible, never skippable. */
  instant: 120,
  /** The default: entrances, expansions, state changes. */
  quick: 180,
  /** Larger surfaces — sheets, screen-level reveals. */
  calm: 240,
  /** One cycle of the live heart-rate ring. */
  breath: 1800,
  /** One cycle of a loading indicator travelling across. */
  travel: 1400,
  /** One cycle of a skeleton shimmer. */
  shimmer: 1200,
} as const;

/**
 * Easing names, resolved to real curves in components/motion/useMotion.
 * Kept as names here so this file stays free of react-native imports.
 */
export const easingName = {
  /** Entrances and most state changes (DESIGN_SYSTEM §10). */
  entrance: 'out',
  /** Exits. */
  exit: 'in',
  /** Looping motion, so the loop has no visible seam. */
  loop: 'inOut',
} as const;

export type EasingName = (typeof easingName)[keyof typeof easingName];
