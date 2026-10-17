import { PULSE_VIEWBOX, pulsePathData } from '@/components/brand/pulseGeometry';

/**
 * The loading indicator, shared in spirit with the mobile app.
 *
 * Replaces a generic spinning Loader2 — the same gap the mobile audit found:
 * the most frequently seen piece of UI in the product carried no brand at all.
 * A dot runs along the HorsePowr pulse, from the same geometry the app uses,
 * so the two products are drawing one shape rather than two that resemble each
 * other.
 *
 * `animateMotion` follows the path itself, which means the dot cannot drift
 * off the line no matter how the waveform is edited — the same guarantee the
 * React Native version gets from interpolating over the same point array.
 *
 * Reduced motion is honoured in CSS rather than JS: the dot is hidden and the
 * line is drawn at full strength, so the indicator still reads as "something
 * is happening" through presence instead of movement.
 */
export function BrandLoader({
  width = 88,
  className,
  label,
}: {
  width?: number;
  className?: string;
  label?: string;
}) {
  const height = width * (PULSE_VIEWBOX.height / PULSE_VIEWBOX.width);
  const pathId = 'hp-pulse-path';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${PULSE_VIEWBOX.width} ${PULSE_VIEWBOX.height}`}
      className={className}
      role="progressbar"
      aria-label={label ?? 'Loading'}
    >
      <path
        id={pathId}
        d={pulsePathData()}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-25 motion-reduce:opacity-90"
      />
      <circle r={3.2} fill="currentColor" className="motion-reduce:hidden">
        <animateMotion dur="1.4s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
    </svg>
  );
}
