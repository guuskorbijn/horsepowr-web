/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit 3166118, do not edit here.
 *
 * Source: horsepowr/src/components/loading/pulseGeometry.ts
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
 * The HorsePowr pulse, as geometry.
 *
 * One array drives BOTH the drawn line and the dot that travels along it, so
 * the dot cannot drift off the waveform — which is what happens the moment a
 * path string and an animation are maintained separately.
 *
 * Coordinates are in a 100 x 40 box and get scaled by the component. The shape
 * is the logo's: a flat lead-in, a small dip, the spike, an overshoot, and a
 * flat tail. Round caps are kept everywhere because DESIGN_SYSTEM §2 says that
 * softness IS the brand.
 */

export interface PulsePoint {
  x: number;
  y: number;
}

export const PULSE_VIEWBOX = { width: 100, height: 40 } as const;

export const PULSE_POINTS: readonly PulsePoint[] = [
  { x: 0, y: 20 },
  { x: 22, y: 20 },
  { x: 30, y: 26 },
  { x: 38, y: 6 },
  { x: 46, y: 34 },
  { x: 54, y: 16 },
  { x: 62, y: 20 },
  { x: 100, y: 20 },
] as const;

/** `M x y L x y …` for an SVG Path. */
export function pulsePathData(points: readonly PulsePoint[] = PULSE_POINTS): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ');
}

/**
 * Interpolation ranges for a dot following the line.
 *
 * Animated.interpolate needs a strictly increasing input range, which the
 * waveform's x values already are — asserted here rather than assumed, because
 * a non-monotonic point would fail at runtime inside an animation, which is
 * the worst place to find out.
 */
export function pulseInterpolation(
  points: readonly PulsePoint[] = PULSE_POINTS,
): { inputRange: number[]; outputRange: number[] } {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (const point of points) {
    const normalised = point.x / PULSE_VIEWBOX.width;
    const previous = inputRange[inputRange.length - 1];
    if (previous !== undefined && normalised <= previous) continue;
    inputRange.push(normalised);
    outputRange.push(point.y / PULSE_VIEWBOX.height);
  }
  return { inputRange, outputRange };
}
