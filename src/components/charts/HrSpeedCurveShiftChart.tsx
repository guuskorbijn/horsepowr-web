'use client';

import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { useElementSize } from '@/hooks/useElementSize';
import { zoneValueBands } from '@/services/hrZone';
import type { SessionVIndex } from '@/services/vIndexTrendService';

const MARGIN = { top: 12, right: 16, bottom: 34, left: 44 };

/**
 * The per-session fitted HR–speed lines, stacked and faded oldest -> newest, so
 * the analyst can SEE the relationship move. No conclusion is drawn — just the
 * curves. Lines fade from faint (oldest) to solid primary (newest).
 */
export function HrSpeedCurveShiftChart({
  trend,
  maxHr,
  height = 300,
}: {
  trend: SessionVIndex[];
  maxHr: number;
  height?: number;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const zoneBands = useMemo(() => zoneValueBands(maxHr), [maxHr]);

  const withFit = useMemo(() => trend.filter((s) => s.fit !== null), [trend]);

  const model = useMemo(() => {
    if (withFit.length === 0) return null;
    let maxSpeed = 10;
    let maxHrSeen = 120;
    let minHrSeen = 80;
    for (const s of withFit) {
      const f = s.fit!;
      maxSpeed = Math.max(maxSpeed, f.domainKmh[1]);
      const y0 = f.intercept + f.slope * f.domainKmh[0];
      const y1 = f.intercept + f.slope * f.domainKmh[1];
      maxHrSeen = Math.max(maxHrSeen, y0, y1);
      minHrSeen = Math.min(minHrSeen, y0, y1);
    }
    const x = scaleLinear().domain([0, maxSpeed * 1.05]).range([0, innerW]);
    const y = scaleLinear()
      .domain([Math.max(0, minHrSeen - 8), maxHrSeen + 8])
      .range([innerH, 0])
      .nice();
    const lines = withFit.map((s, i) => {
      const f = s.fit!;
      const [x0, x1] = f.domainKmh;
      const opacity = withFit.length === 1 ? 1 : 0.22 + (0.78 * i) / (withFit.length - 1);
      const isNewest = i === withFit.length - 1;
      return {
        path: `M ${x(x0)} ${y(f.intercept + f.slope * x0)} L ${x(x1)} ${y(f.intercept + f.slope * x1)}`,
        opacity,
        width: isNewest ? 2.4 : 1.4,
      };
    });
    return { x, y, yDomain: y.domain() as [number, number], lines };
  }, [withFit, innerW, innerH]);

  if (withFit.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[14px] text-text-secondary">
        Not enough HR–speed data to draw fitted curves in this range.
      </div>
    );
  }

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 && model ? (
        <svg width={width} height={height} role="img" aria-label="HR–speed fitted curves oldest to newest">
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {zoneBands.map((band) => {
              const yTop = model.y(Math.min(band.highBpm, model.yDomain[1]));
              const yBot = model.y(Math.max(band.lowBpm, model.yDomain[0]));
              const h = Math.max(0, yBot - yTop);
              if (h <= 0) return null;
              return <rect key={band.zone} x={0} y={yTop} width={innerW} height={h} fill={band.color} opacity={0.07} />;
            })}
            {model.y.ticks(5).map((t) => (
              <g key={t} transform={`translate(0,${model.y(t)})`}>
                <line x1={0} x2={innerW} stroke="var(--color-line)" strokeWidth={1} />
                <text x={-8} y={3} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[10px] tabular">
                  {Math.round(t)}
                </text>
              </g>
            ))}
            {model.x.ticks(Math.max(2, Math.floor(innerW / 70))).map((t) => (
              <text key={t} x={model.x(t)} y={innerH + 16} textAnchor="middle" className="fill-[var(--color-text-tertiary)] text-[10px] tabular">
                {t}
              </text>
            ))}
            <text x={innerW} y={innerH + 30} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[10px]">
              speed (km/h)
            </text>
            {model.lines.map((l, i) => (
              <path key={i} d={l.path} fill="none" stroke="var(--color-primary)" strokeWidth={l.width} opacity={l.opacity} />
            ))}
          </g>
        </svg>
      ) : null}
    </div>
  );
}
