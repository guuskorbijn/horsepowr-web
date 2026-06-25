'use client';

import { useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { useElementSize } from '@/hooks/useElementSize';
import { ZONE_LEGEND, weekZoneTotalMin, type WeekVolume } from '@/services/weeklyVolumeService';
import type { ZoneKey } from '@/theme/tokens';

const MARGIN = { top: 12, right: 16, bottom: 28, left: 40 };
const ZONE_ORDER: readonly ZoneKey[] = ['z1', 'z2', 'z3', 'z4', 'z5'];

function weekLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Stacked Z1–Z5 minutes per week. Measured time only — no load framing. */
export function WeeklyVolumeChart({ weeks, height = 240 }: { weeks: WeekVolume[]; height?: number }) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<{ x: number; y: number; zone: ZoneKey; min: number; week: number } | null>(
    null,
  );

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const model = useMemo(() => {
    if (weeks.length === 0) return null;
    const x = scaleBand<number>().domain(weeks.map((w) => w.weekStartMs)).range([0, innerW]).padding(0.25);
    const maxTotal = Math.max(1, ...weeks.map(weekZoneTotalMin));
    const y = scaleLinear().domain([0, maxTotal * 1.1]).range([innerH, 0]).nice();
    return { x, y };
  }, [weeks, innerW, innerH]);

  if (weeks.length === 0 || !model) {
    return (
      <div className="flex h-32 items-center justify-center text-[14px] text-text-secondary">
        No measured weekly volume yet.
      </div>
    );
  }

  const { x, y } = model;
  const colorOf = (zone: ZoneKey) => ZONE_LEGEND.find((z) => z.zone === zone)!.color;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label="Measured weekly minutes in each HR zone">
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x1={0} x2={innerW} stroke="var(--color-line)" strokeWidth={1} />
                <text x={-8} y={3} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[10px] tabular">
                  {Math.round(t)}
                </text>
              </g>
            ))}
            {weeks.map((w) => {
              const bx = x(w.weekStartMs) ?? 0;
              const bw = x.bandwidth();
              let yCursor = 0;
              return (
                <g key={w.weekStartMs}>
                  {ZONE_ORDER.map((zone) => {
                    const min = w.zoneMinutes[zone];
                    if (min <= 0) return null;
                    const h = innerH - y(min);
                    const yTop = y(yCursor + min);
                    yCursor += min;
                    return (
                      <rect
                        key={zone}
                        x={bx}
                        y={yTop}
                        width={bw}
                        height={h}
                        fill={colorOf(zone)}
                        onMouseEnter={() => setHover({ x: bx + bw / 2, y: yTop, zone, min, week: w.weekStartMs })}
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  })}
                  <text x={bx + bw / 2} y={innerH + 16} textAnchor="middle" className="fill-[var(--color-text-tertiary)] text-[10px]">
                    {weekLabel(w.weekStartMs)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      ) : null}

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-raised)]"
          style={{ left: Math.min(hover.x + MARGIN.left, Math.max(0, width - 150)), top: Math.max(0, hover.y) }}
        >
          <div className="tabular text-text-secondary">week of {weekLabel(hover.week)}</div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: colorOf(hover.zone) }} />
            <span className="text-text-secondary">{hover.zone.toUpperCase()}</span>
            <span className="tabular ml-auto font-medium text-text-primary">{Math.round(hover.min)} min</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
