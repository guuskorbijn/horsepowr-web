'use client';

import { useMemo, useState } from 'react';
import { scaleLinear, scaleTime } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { useElementSize } from '@/hooks/useElementSize';
import type { TrendMetric, TrendSeries } from '@/services/trendService';

const MARGIN = { top: 10, right: 16, bottom: 28, left: 48 };

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface Plotted {
  label: string;
  color: string;
  path: string;
  dots: Array<{ x: number; y: number; t: number; v: number }>;
}

export function TrendChart({
  series,
  metric,
  unit,
  format,
  height = 260,
}: {
  series: TrendSeries[];
  metric: TrendMetric;
  unit: string;
  format: (v: number) => string;
  height?: number;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<{ x: number; y: number; label: string; t: number; v: number } | null>(
    null,
  );

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const { xScale, yScale, plotted, empty } = useMemo(() => {
    const ts: number[] = [];
    const vs: number[] = [];
    for (const s of series) {
      for (const p of s.points) {
        const v = p.values[metric];
        if (v === null) continue;
        ts.push(p.t);
        vs.push(v);
      }
    }
    if (ts.length === 0) {
      return { xScale: null, yScale: null, plotted: [] as Plotted[], empty: true };
    }
    const xMin = Math.min(...ts);
    const xMax = Math.max(...ts);
    const yMax = Math.max(...vs);
    const x = scaleTime()
      .domain([new Date(xMin === xMax ? xMin - 86400000 : xMin), new Date(xMax === xMin ? xMax + 86400000 : xMax)])
      .range([0, innerW]);
    const y = scaleLinear().domain([0, yMax * 1.1 || 1]).range([innerH, 0]).nice();

    const plottedSeries: Plotted[] = series.map((s) => {
      const valid = s.points
        .map((p) => ({ t: p.t, v: p.values[metric] }))
        .filter((p): p is { t: number; v: number } => p.v !== null)
        .sort((a, b) => a.t - b.t);
      const dots = valid.map((p) => ({ x: x(new Date(p.t)), y: y(p.v), t: p.t, v: p.v }));
      const path =
        d3line<{ t: number; v: number }>()
          .x((p) => x(new Date(p.t)))
          .y((p) => y(p.v))(valid) ?? '';
      return { label: s.label, color: s.color, path, dots };
    });
    return { xScale: x, yScale: y, plotted: plottedSeries, empty: false };
  }, [series, metric, innerW, innerH]);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && !empty && xScale && yScale ? (
        <svg width={width} height={height} role="img" aria-label={`${metric} over time`}>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {yScale.ticks(4).map((t) => (
              <g key={t} transform={`translate(0,${yScale(t)})`}>
                <line x1={0} x2={innerW} stroke="var(--color-line)" strokeWidth={1} />
                <text x={-8} y={3} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[10px] tabular">
                  {format(t)}
                </text>
              </g>
            ))}
            {xScale.ticks(Math.max(2, Math.floor(innerW / 80))).map((d) => (
              <text
                key={+d}
                x={xScale(d)}
                y={innerH + 18}
                textAnchor="middle"
                className="fill-[var(--color-text-tertiary)] text-[10px]"
              >
                {fmtDate(+d)}
              </text>
            ))}
            {plotted.map((s) => (
              <g key={s.label}>
                <path d={s.path} fill="none" stroke={s.color} strokeWidth={1.8} />
                {s.dots.map((dot, i) => (
                  <circle
                    key={i}
                    cx={dot.x}
                    cy={dot.y}
                    r={3.5}
                    fill={s.color}
                    stroke="var(--color-surface)"
                    strokeWidth={1.5}
                    onMouseEnter={() =>
                      setHover({ x: dot.x, y: dot.y, label: s.label, t: dot.t, v: dot.v })
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </g>
            ))}
          </g>
        </svg>
      ) : empty ? (
        <div className="flex h-full items-center justify-center text-[14px] text-text-secondary">
          No measured values for this metric yet.
        </div>
      ) : null}

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-raised)]"
          style={{
            left: Math.min(hover.x + MARGIN.left + 8, Math.max(0, width - 140)),
            top: hover.y,
          }}
        >
          <div className="font-medium text-text-primary">{hover.label}</div>
          <div className="tabular text-text-secondary">{fmtDate(hover.t)}</div>
          <div className="tabular font-medium text-text-primary">
            {format(hover.v)} {unit}
          </div>
        </div>
      ) : null}
    </div>
  );
}
