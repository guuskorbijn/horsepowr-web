import { cn } from '@/lib/cn';

/**
 * HorsePowr mark — a pulse waveform inside a rounded blue tile (a heartbeat that
 * doubles as wordplay on "horsepower"). The pulse keeps round line caps — that
 * softness is the brand. Rebuilt as inline SVG (the asset files live in the RN
 * repo only; we do not import across repos).
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="HorsePowr"
      className={className}
    >
      <rect width="48" height="48" rx="12" fill="#0058A2" />
      <path
        d="M9 24 h7 l3 -9 l5 18 l3 -11 l2 4 h10"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark size={28} />
      <span className="font-display text-[18px] font-semibold tracking-tight">
        <span className="text-text-primary">Horse</span>
        <span className="text-primary">Powr</span>
      </span>
    </span>
  );
}
