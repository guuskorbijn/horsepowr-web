'use client';

import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { useElementSize } from '@/hooks/useElementSize';
import { formatElapsed } from '@/services/chartMath';
import type { RecoveryDescent } from '@/services/recoveryService';

const MARGIN = { top: 12, right: 16, bottom: 28, left: 44 };

/** HR vs time-since-effort, with measured markers at the recorded +1/+5/+10 min
 *  points. A plain plot of the measured descent — no scoring overlay. */
export function RecoveryChart({ recovery, height = 220 }: { recovery: RecoveryDescent; height?: number }) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const model = useMemo(() => {
    const pts = recovery.curve;
    if (pts.length === 0) return null;
    const maxT = Math.max(pts[pts.length - 1]!.t, 60_000);
    const hrs = pts.map((p) => p.v);
    const x = scaleLinear().domain([0, maxT]).range([0, innerW]);
    const y = scaleLinear()
      .domain([Math.min(...hrs) - 5, Math.max(recovery.peakHr, ...hrs) + 5])
      .range([innerH, 0])
      .nice();
    const path = d3line<{ t: number; v: number }>().x((p) => x(p.t)).y((p) => y(p.v))(pts) ?? '';
    return { x, y, path };
  }, [recovery, innerW, innerH]);

  if (!model) {
    return (
      <div className="flex h-32 items-center justify-center text-[14px] text-text-secondary">
        No post-effort heart-rate data was recorded.
      </div>
    );
  }

  const { x, y, path } = model;

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label="Heart-rate recovery after the last effort">
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Peak reference line. */}
            <line x1={0} x2={innerW} y1={y(recovery.peakHr)} y2={y(recovery.peakHr)} stroke="var(--color-line-strong)" strokeWidth={1} strokeDasharray="3 3" />
            <text x={innerW} y={y(recovery.peakHr) - 4} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[10px] tabular">
              peak {Math.round(recovery.peakHr)}
            </text>

            {y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x1={0} x2={innerW} stroke="var(--color-line)" strokeWidth={1} />
                <text x={-8} y={3} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[10px] tabular">
                  {Math.round(t)}
                </text>
              </g>
            ))}
            {x.ticks(Math.max(2, Math.floor(innerW / 70))).map((t) => (
              <text key={t} x={x(t)} y={innerH + 16} textAnchor="middle" className="fill-[var(--color-text-tertiary)] text-[10px] tabular">
                +{formatElapsed(t)}
              </text>
            ))}

            <path d={path} fill="none" stroke="var(--color-z2)" strokeWidth={1.8} />

            {recovery.marks
              .filter((m) => m.recorded && m.hr !== null)
              .map((m) => {
                const cx = x(m.atSec * 1000);
                const cy = y(m.hr!);
                return (
                  <g key={m.atSec}>
                    <line x1={cx} x2={cx} y1={0} y2={innerH} stroke="var(--color-line)" strokeWidth={1} />
                    <circle cx={cx} cy={cy} r={4} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={1.5} />
                  </g>
                );
              })}
          </g>
        </svg>
      ) : null}
    </div>
  );
}
