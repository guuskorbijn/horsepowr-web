'use client';

import { useMemo, useState } from 'react';
import { scaleLinear, scaleTime } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { useElementSize } from '@/hooks/useElementSize';
import type { VTrendPoint } from '@/services/vIndexTrendService';

const MARGIN = { top: 12, right: 16, bottom: 28, left: 48 };

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * One point per session: the speed (km/h) at which the fit reached the chosen HR.
 * Points + connecting line over the calendar. Neutral axes — each point is a
 * measured speed, no trend judgment is drawn.
 */
export function VIndexTrendChart({
  points,
  threshold,
  height = 260,
}: {
  points: VTrendPoint[];
  threshold: number;
  height?: number;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<{ x: number; y: number; t: number; v: number } | null>(null);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const model = useMemo(() => {
    if (points.length === 0) return null;
    const ts = points.map((p) => p.t);
    const vs = points.map((p) => p.speedKmh);
    const xMin = Math.min(...ts);
    const xMax = Math.max(...ts);
    const x = scaleTime()
      .domain([
        new Date(xMin === xMax ? xMin - 86_400_000 : xMin),
        new Date(xMax === xMin ? xMax + 86_400_000 : xMax),
      ])
      .range([0, innerW]);
    const yLo = Math.max(0, Math.min(...vs) - 3);
    const yHi = Math.max(...vs) + 3;
    const y = scaleLinear().domain([yLo, yHi]).range([innerH, 0]).nice();
    const dots = points.map((p) => ({ x: x(new Date(p.t)), y: y(p.speedKmh), t: p.t, v: p.speedKmh }));
    const path = d3line<VTrendPoint>().x((p) => x(new Date(p.t))).y((p) => y(p.speedKmh))(points) ?? '';
    return { x, y, dots, path };
  }, [points, innerW, innerH]);

  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[14px] text-text-secondary">
        No session reached HR {threshold} in this range.
      </div>
    );
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && model ? (
        <svg width={width} height={height} role="img" aria-label={`Speed at HR ${threshold} over time`}>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {model.y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0,${model.y(t)})`}>
                <line x1={0} x2={innerW} stroke="var(--color-line)" strokeWidth={1} />
                <text x={-8} y={3} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[10px] tabular">
                  {t}
                </text>
              </g>
            ))}
            {model.x.ticks(Math.max(2, Math.floor(innerW / 80))).map((d) => (
              <text key={+d} x={model.x(d)} y={innerH + 18} textAnchor="middle" className="fill-[var(--color-text-tertiary)] text-[10px]">
                {fmtDate(+d)}
              </text>
            ))}
            <path d={model.path} fill="none" stroke="var(--color-primary)" strokeWidth={1.8} />
            {model.dots.map((dot, i) => (
              <circle
                key={i}
                cx={dot.x}
                cy={dot.y}
                r={4}
                fill="var(--color-primary)"
                stroke="var(--color-surface)"
                strokeWidth={1.5}
                onMouseEnter={() => setHover(dot)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
      ) : null}

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-raised)]"
          style={{ left: Math.min(hover.x + MARGIN.left + 8, Math.max(0, width - 150)), top: hover.y }}
        >
          <div className="tabular text-text-secondary">{fmtDate(hover.t)}</div>
          <div className="tabular font-medium text-text-primary">
            {hover.v.toFixed(1)} km/h at HR {threshold}
          </div>
        </div>
      ) : null}
    </div>
  );
}
