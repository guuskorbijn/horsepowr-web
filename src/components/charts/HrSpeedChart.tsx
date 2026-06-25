'use client';

import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { useElementSize } from '@/hooks/useElementSize';
import { zoneValueBands } from '@/services/hrZone';
import type { HrSpeedAnalysis } from '@/services/hrSpeedService';

const MARGIN = { top: 12, right: 16, bottom: 34, left: 44 };

/**
 * HR (y) vs speed (x) scatter with the fitted line, HR-zone shading on the HR
 * axis, and a marker where the fit crosses each V-index threshold. Pure render
 * of measured values + the documented fit — no labels are evaluative.
 */
export function HrSpeedChart({
  analysis,
  maxHr,
  height = 300,
}: {
  analysis: HrSpeedAnalysis;
  maxHr: number;
  height?: number;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const zoneBands = useMemo(() => zoneValueBands(maxHr), [maxHr]);

  const model = useMemo(() => {
    const { points, fit, vIndices } = analysis;
    const speeds = points.map((p) => p.speedKmh);
    const hrs = points.map((p) => p.hr);
    const maxSpeed = Math.max(10, ...speeds);
    const hrLo = Math.min(...hrs, fit ? fit.intercept + fit.slope * fit.domainKmh[0] : Infinity);
    const hrHi = Math.max(...hrs, ...vIndices.filter((v) => v.reached).map((v) => v.hr));
    const xDomain: [number, number] = [0, maxSpeed * 1.05];
    const yDomain: [number, number] = [
      Math.max(0, Math.min(hrLo, 60) - 5),
      Math.max(hrHi, 120) + 8,
    ];
    const x = scaleLinear().domain(xDomain).range([0, innerW]);
    const y = scaleLinear().domain(yDomain).range([innerH, 0]).nice();

    let linePath: string | null = null;
    if (fit) {
      const [x0, x1] = fit.domainKmh;
      const y0 = fit.intercept + fit.slope * x0;
      const y1 = fit.intercept + fit.slope * x1;
      linePath = `M ${x(x0)} ${y(y0)} L ${x(x1)} ${y(y1)}`;
    }

    return { x, y, xDomain, yDomain, linePath };
  }, [analysis, innerW, innerH]);

  const { x, y, yDomain, linePath } = model;

  if (analysis.points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[14px] text-text-secondary">
        This session has no paired heart-rate and speed samples to plot.
      </div>
    );
  }

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label="Heart rate versus speed">
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* HR-zone shading on the HR (y) axis. */}
            {zoneBands.map((band) => {
              const yTop = y(Math.min(band.highBpm, yDomain[1]));
              const yBot = y(Math.max(band.lowBpm, yDomain[0]));
              const h = Math.max(0, yBot - yTop);
              if (h <= 0) return null;
              return (
                <rect key={band.zone} x={0} y={yTop} width={innerW} height={h} fill={band.color} opacity={0.08} />
              );
            })}

            {/* Y grid + labels (HR). */}
            {y.ticks(5).map((t) => (
              <g key={`y${t}`} transform={`translate(0,${y(t)})`}>
                <line x1={0} x2={innerW} stroke="var(--color-line)" strokeWidth={1} />
                <text x={-8} y={3} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[10px] tabular">
                  {Math.round(t)}
                </text>
              </g>
            ))}

            {/* X ticks (speed). */}
            {x.ticks(Math.max(2, Math.floor(innerW / 70))).map((t) => (
              <text
                key={`x${t}`}
                x={x(t)}
                y={innerH + 16}
                textAnchor="middle"
                className="fill-[var(--color-text-tertiary)] text-[10px] tabular"
              >
                {t}
              </text>
            ))}
            <text
              x={innerW}
              y={innerH + 30}
              textAnchor="end"
              className="fill-[var(--color-text-tertiary)] text-[10px]"
            >
              speed (km/h)
            </text>

            {/* Scatter. */}
            {analysis.points.map((p, i) => (
              <circle key={i} cx={x(p.speedKmh)} cy={y(p.hr)} r={2} fill="var(--color-z2)" opacity={0.4} />
            ))}

            {/* Fitted line. */}
            {linePath ? (
              <path d={linePath} fill="none" stroke="var(--color-text-primary)" strokeWidth={2} strokeDasharray="1 0" />
            ) : null}

            {/* V-index crossings. */}
            {analysis.vIndices
              .filter((v) => v.reached && v.speedKmh !== null)
              .map((v) => {
                const cx = x(v.speedKmh!);
                const cy = y(v.hr);
                return (
                  <g key={`v${v.hr}`}>
                    <line x1={cx} x2={cx} y1={cy} y2={innerH} stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="3 3" />
                    <circle cx={cx} cy={cy} r={4} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={1.5} />
                    <text x={cx} y={cy - 8} textAnchor="middle" className="fill-[var(--color-text-primary)] text-[10px] font-semibold tabular">
                      V{v.hr}
                    </text>
                  </g>
                );
              })}
          </g>
        </svg>
      ) : null}
    </div>
  );
}
