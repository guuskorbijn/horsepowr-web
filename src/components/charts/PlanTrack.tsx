'use client';

import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { useElementSize } from '@/hooks/useElementSize';
import type { Domain } from '@/services/chartMath';
import type { TimelineSegment } from '@/services/calendar/blockTimeline';

/**
 * The PLAN on the session's clock: each planned block as a band under the
 * charts, on the same zoomable time axis. Work bouts are solid, recovery and
 * steady parts lighter, so "where should the intervals have been" reads at a
 * glance against the heart-rate curve above. Planned time from the start of
 * the recording — it shows the plan, it does not claim the rider followed it.
 */

const MARGIN = { left: 44, right: 16 };
const HEIGHT = 30;

export function PlanTrack({
  segments,
  startMs,
  xWindow,
  labelOf,
}: {
  segments: readonly TimelineSegment[];
  startMs: number;
  xWindow: Domain;
  labelOf: (s: TimelineSegment) => string;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const x = useMemo(() => scaleLinear().domain(xWindow).range([0, innerW]), [xWindow, innerW]);

  return (
    <div ref={ref} className="w-full" style={{ height: HEIGHT }}>
      {width > 0 ? (
        <svg width={width} height={HEIGHT} role="img" aria-label="Planned blocks over time">
          <g transform={`translate(${MARGIN.left},0)`}>
            {segments.map((s, i) => {
              const x1 = Math.max(0, x(startMs + s.startSec * 1000));
              const x2 = Math.min(innerW, x(startMs + s.endSec * 1000));
              const w = x2 - x1;
              if (w <= 0.5) return null;
              const work = s.kind === 'work';
              return (
                <g key={i}>
                  <rect
                    x={x1}
                    y={work ? 3 : 9}
                    width={w}
                    height={work ? HEIGHT - 6 : HEIGHT - 18}
                    rx={4}
                    fill={work ? 'var(--color-accent)' : 'var(--color-primary)'}
                    opacity={work ? 0.85 : s.kind === 'recovery' ? 0.25 : 0.4}
                  >
                    <title>{labelOf(s)}</title>
                  </rect>
                  {w > 70 ? (
                    <text
                      x={x1 + 6}
                      y={HEIGHT / 2 + 4}
                      fontSize={11}
                      fill={work ? 'var(--color-on-accent)' : 'var(--color-text-secondary)'}
                    >
                      {labelOf(s)}
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
