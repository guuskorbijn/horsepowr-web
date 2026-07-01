import { mdiHorse } from '@mdi/js';

/**
 * Horse glyph — Lucide has no horse, so per DESIGN_SYSTEM.md §6 we use the
 * Material Design Icons `horse` (the web-side equivalent of MaterialCommunityIcons
 * `horse` used on mobile). Single-colour, inherits `currentColor`.
 *
 * Props mirror the lucide-react icon API so this is a drop-in wherever a lucide
 * icon is used (e.g. the nav registry in components/shell/nav.ts).
 */
export interface HorseIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function HorseIcon({
  size = 24,
  color = 'currentColor',
  className,
}: HorseIconProps): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      className={className}
      aria-hidden="true"
    >
      <path d={mdiHorse} />
    </svg>
  );
}
