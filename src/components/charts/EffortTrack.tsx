'use client';

import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { useElementSize } from '@/hooks/useElementSize';
import type { Domain } from '@/services/chartMath';
import type { Effort } from '@/types/view';

// Keep margins aligned with TimeSeriesChart so bands line up under the traces.
const MARGIN = { left: 44, right: 16 };
const HEIGHT = 26;

// Coral accent for work bouts — deliberately distinct from the gait palette so
// the two overlays never read as the same scale. Recovery is a muted outline.
const WORK_FILL = 'var(--color-accent)';

export function EffortTrack({ efforts, xWindow }: { efforts: Effort[]; xWindow: Domain }) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const xScale = useMemo(
    () => scaleLinear().domain(xWindow).range([0, innerW]),
    [xWindow, innerW],
  );

  return (
    <div ref={ref} className="w-full" style={{ height: HEIGHT }}>
      {width > 0 ? (
        <svg width={width} height={HEIGHT} role="img" aria-label="Detected efforts over time">
          <g transform={`translate(${MARGIN.left},0)`}>
            {/* Baseline so recovery stretches read as a track, not a gap. */}
            <line
              x1={0}
              x2={innerW}
              y1={HEIGHT / 2}
              y2={HEIGHT / 2}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            {efforts.map((e, i) => {
              const x1 = Math.max(0, xScale(e.startTs));
              const x2 = Math.min(innerW, xScale(e.endTs));
              const w = x2 - x1;
              if (w <= 0.5) return null;
              if (e.kind === 'recovery') {
                return (
                  <rect
                    key={`r-${e.startTs}-${i}`}
                    x={x1}
                    y={HEIGHT / 2 - 1.5}
                    width={w}
                    height={3}
                    rx={1.5}
                    fill="var(--color-line-strong)"
                  >
                    <title>Recovery</title>
                  </rect>
                );
              }
              return (
                <g key={`w-${e.startTs}-${i}`}>
                  <rect
                    x={x1}
                    y={4}
                    width={w}
                    height={HEIGHT - 8}
                    rx={3}
                    fill={WORK_FILL}
                    opacity={0.9}
                  >
                    <title>{`Effort ${e.workIndex}`}</title>
                  </rect>
                  {w > 26 ? (
                    <text
                      x={x1 + w / 2}
                      y={HEIGHT / 2 + 3}
                      textAnchor="middle"
                      className="fill-white text-[9px] font-semibold"
                    >
                      {e.workIndex}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      ) : null}
    </div>
  );
}

export function EffortLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: WORK_FILL }} />
        Work bout
      </span>
      <span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
        <span className="inline-block h-[3px] w-3.5 rounded-sm bg-line-strong" />
        Recovery
      </span>
      <span className="text-[12px] text-text-tertiary">
        · detected from HR/speed, analyst-validated
      </span>
    </div>
  );
}
