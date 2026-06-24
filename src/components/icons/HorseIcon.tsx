/**
 * Custom horse glyph — Lucide has no horse, and the design system calls for a
 * small custom set (matching the 24px grid, 2px stroke, round caps/joins) only
 * for horse/sensor concepts. Single-colour, inherits `currentColor`.
 */
export function HorseIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 21c-.5-4 1-7 3.5-8.5C7 11 5.5 9 6 6.5L8.5 8l1.5-2 2 2 3-2c1.5 1 2.5 3 2.5 5.5 0 1.5-.6 3-1.7 4.2" />
      <path d="M16.8 15.7c.7 1.5 1 3.4.7 5.3" />
      <path d="M9 21h8" />
      <path d="M6 6.5 4 5" />
    </svg>
  );
}
