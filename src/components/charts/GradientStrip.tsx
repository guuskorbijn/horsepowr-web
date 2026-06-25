'use client';

import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { area as d3area, line as d3line } from 'd3-shape';
import { useElementSize } from '@/hooks/useElementSize';
import { pointsInWindow, type Domain } from '@/services/chartMath';
import type { GradientPoint } from '@/services/gradientService';

// Margins aligned with TimeSeriesChart so the strip lines up under the traces.
const MARGIN = { left: 44, right: 16 };
const HEIGHT = 70;

/**
 * Gradient over the shared time axis — an ESTIMATE from smoothed GPS altitude.
 * Uphill fills above the zero line, downhill below. Aligned with the session
 * charts on the same elapsed clock. The caveat lives in the title tooltip.
 */
export function GradientStrip({
  profile,
  xWindow,
}: {
  profile: GradientPoint[];
  xWindow: Domain;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - 8;

  const model = useMemo(() => {
    const pts = pointsInWindow(
      profile.map((p) => ({ t: p.t, v: p.gradient * 100 })),
      xWindow,
    );
    if (pts.length === 0) return null;
    const x = scaleLinear().domain(xWindow).range([0, innerW]);
    const maxAbs = Math.max(2, ...pts.map((p) => Math.abs(p.v)));
    const y = scaleLinear().domain([-maxAbs, maxAbs]).range([innerH, 0]);
    const areaPath =
      d3area<{ t: number; v: number }>()
        .x((p) => x(p.t))
        .y0(y(0))
        .y1((p) => y(p.v))(pts) ?? '';
    const linePath =
      d3line<{ t: number; v: number }>().x((p) => x(p.t)).y((p) => y(p.v))(pts) ?? '';
    return { x, y, areaPath, linePath, maxAbs };
  }, [profile, xWindow, innerW, innerH]);

  return (
    <div ref={ref} className="w-full" style={{ height: HEIGHT }}>
      {width > 0 && model ? (
        <svg width={width} height={HEIGHT} role="img" aria-label="Estimated gradient over time">
          <title>Gradient is an estimate from GPS altitude (noisy); smoothed before display.</title>
          <g transform={`translate(${MARGIN.left},4)`}>
            <line x1={0} x2={innerW} y1={model.y(0)} y2={model.y(0)} stroke="var(--color-line-strong)" strokeWidth={1} />
            <path d={model.areaPath} fill="var(--color-gait-canter)" opacity={0.18} />
            <path d={model.linePath} fill="none" stroke="var(--color-gait-canter)" strokeWidth={1.4} />
            <text x={-8} y={model.y(model.maxAbs) + 3} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[9px] tabular">
              +{Math.round(model.maxAbs)}%
            </text>
            <text x={-8} y={model.y(-model.maxAbs) + 3} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[9px] tabular">
              −{Math.round(model.maxAbs)}%
            </text>
          </g>
        </svg>
      ) : null}
    </div>
  );
}
