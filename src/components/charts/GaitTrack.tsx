'use client';

import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { useElementSize } from '@/hooks/useElementSize';
import { gaitColors } from '@/theme/tokens';
import { GAIT_LABELS } from '@/services/labels';
import type { Domain } from '@/services/chartMath';
import type { GaitBand } from '@/types/view';

// Keep the left/right margins aligned with TimeSeriesChart so bands line up.
const MARGIN = { left: 44, right: 16 };
const HEIGHT = 26;

export function GaitTrack({
  bands,
  xWindow,
}: {
  bands: GaitBand[];
  xWindow: Domain;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const xScale = useMemo(
    () => scaleLinear().domain(xWindow).range([0, innerW]),
    [xWindow, innerW],
  );

  return (
    <div ref={ref} className="w-full" style={{ height: HEIGHT }}>
      {width > 0 ? (
        <svg width={width} height={HEIGHT} role="img" aria-label="Estimated gait over time">
          <g transform={`translate(${MARGIN.left},0)`}>
            {bands.map((band, i) => {
              const x1 = Math.max(0, xScale(band.startTs));
              const x2 = Math.min(innerW, xScale(band.endTs));
              const w = x2 - x1;
              if (w <= 0.5) return null;
              return (
                <g key={`${band.startTs}-${i}`}>
                  <rect
                    x={x1}
                    y={4}
                    width={w}
                    height={HEIGHT - 8}
                    rx={3}
                    fill={gaitColors[band.gait]}
                    opacity={0.85}
                  >
                    <title>{`${GAIT_LABELS[band.gait]}`}</title>
                  </rect>
                  {w > 44 ? (
                    <text
                      x={x1 + w / 2}
                      y={HEIGHT / 2 + 3}
                      textAnchor="middle"
                      className="fill-white text-[9px] font-medium"
                    >
                      {GAIT_LABELS[band.gait]}
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

export function GaitLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {(Object.keys(GAIT_LABELS) as Array<keyof typeof GAIT_LABELS>).map((g) => (
        <span key={g} className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: gaitColors[g] }} />
          {GAIT_LABELS[g]}
        </span>
      ))}
      <span className="text-[12px] text-text-tertiary">· estimated from GPS speed</span>
    </div>
  );
}
