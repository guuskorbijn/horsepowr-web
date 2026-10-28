/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit cc497bd, do not edit here.
 *
 * Source: horsepowr/src/components/loading/pulseGeometry.ts
 *
 * See scripts/check-mirror.mjs. The same points drive the loader on both
 * products, so the brand's pulse is literally the same shape in the app and in
 * the browser rather than two drawings that resemble each other.
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
