'use client';

import { useCallback, useMemo, useRef, type PointerEvent, type WheelEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { useElementSize } from '@/hooks/useElementSize';
import { downsample, DISPLAY_POINT_TARGET } from '@/services/measurementService';
import {
  clampWindow,
  formatElapsed,
  nearestPoint,
  pointsInWindow,
  yDomainOf,
  type Domain,
} from '@/services/chartMath';
import type { ChartSeries } from '@/types/view';
import type { ZoneValueBand } from '@/services/hrZone';

const MARGIN = { top: 10, right: 16, bottom: 24, left: 44 };
const MIN_SPAN_MS = 5000; // don't allow zooming tighter than 5s

export interface CrosshairReadout {
  t: number;
  values: Array<{ key: string; label: string; value: number; unit: string; color: string }>;
}

export function TimeSeriesChart({
  series,
  xWindow,
  fullDomain,
  onWindowChange,
  hoverT,
  onHover,
  height = 180,
  zoneBands,
  valueFormat = (v) => `${Math.round(v)}`,
  ariaLabel,
}: {
  series: ChartSeries[];
  xWindow: Domain;
  fullDomain: Domain;
  onWindowChange: (w: Domain) => void;
  hoverT: number | null;
  onHover: (t: number | null) => void;
  height?: number;
  zoneBands?: ZoneValueBand[];
  valueFormat?: (v: number) => string;
  ariaLabel?: string;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const dragRef = useRef<{ startX: number; startWindow: Domain } | null>(null);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const xScale = useMemo(
    () => scaleLinear().domain(xWindow).range([0, innerW]),
    [xWindow, innerW],
  );

  const yDomain = useMemo(() => {
    const base = yDomainOf(series, xWindow);
    // Keep zone backdrop visible even if HR doesn't span all zones.
    if (zoneBands && zoneBands.length > 0) {
      const top = zoneBands[zoneBands.length - 1]?.highBpm ?? base[1];
      return [Math.min(base[0], zoneBands[0]?.lowBpm ?? base[0]), Math.max(base[1], top * 0.6)] as Domain;
    }
    return base;
  }, [series, xWindow, zoneBands]);

  const yScale = useMemo(
    () => scaleLinear().domain(yDomain).range([innerH, 0]).nice(),
    [yDomain, innerH],
  );

  // Re-window + downsample each series to the visible slice (deep zoom shows
  // more detail because we re-sample from the full-resolution input).
  const renderedSeries = useMemo(() => {
    return series.map((s) => {
      const windowed = pointsInWindow(s.points, xWindow);
      const pts = downsample(windowed, DISPLAY_POINT_TARGET);
      const path = d3line<{ t: number; v: number }>()
        .x((p) => xScale(p.t))
        .y((p) => yScale(p.v))(pts);
      return { key: s.key, color: s.color, path: path ?? '' };
    });
  }, [series, xWindow, xScale, yScale]);

  const xTicks = useMemo(() => xScale.ticks(Math.max(2, Math.floor(innerW / 90))), [xScale, innerW]);
  const yTicks = useMemo(() => yScale.ticks(4), [yScale]);

  const readout: CrosshairReadout | null = useMemo(() => {
    if (hoverT === null) return null;
    const values = series
      .map((s) => {
        const p = nearestPoint(s.points, hoverT);
        if (!p) return null;
        return { key: s.key, label: s.label, value: p.v, unit: s.unit, color: s.color };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
    if (values.length === 0) return null;
    return { t: hoverT, values };
  }, [hoverT, series]);

  const toElapsed = useCallback(
    (clientX: number, rect: DOMRect): number => {
      const x = clientX - rect.left - MARGIN.left;
      return xScale.invert(Math.max(0, Math.min(innerW, x)));
    },
    [xScale, innerW],
  );

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (dragRef.current) {
      const dt = toElapsed(e.clientX, rect) - toElapsed(dragRef.current.startX, rect);
      const [a, b] = dragRef.current.startWindow;
      onWindowChange(clampWindow([a - dt, b - dt], fullDomain));
      return;
    }
    onHover(toElapsed(e.clientX, rect));
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startWindow: xWindow };
  };

  const endDrag = (e: PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  };

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorT = toElapsed(e.clientX, rect);
    const [a, b] = xWindow;
    const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2; // out / in
    const newSpan = Math.max(MIN_SPAN_MS, (b - a) * factor);
    const ratio = (cursorT - a) / (b - a || 1);
    const next: Domain = [cursorT - newSpan * ratio, cursorT + newSpan * (1 - ratio)];
    onWindowChange(clampWindow(next, fullDomain));
  };

  const hoverX = hoverT !== null ? xScale(hoverT) : null;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          className="touch-none"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerUp={endDrag}
          onPointerLeave={(e) => {
            endDrag(e);
            onHover(null);
          }}
          onWheel={onWheel}
          onDoubleClick={() => onWindowChange(fullDomain)}
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* HR zone backdrop */}
            {zoneBands?.map((band) => {
              const yTop = yScale(Math.min(band.highBpm, yDomain[1]));
              const yBot = yScale(Math.max(band.lowBpm, yDomain[0]));
              const h = Math.max(0, yBot - yTop);
              if (h <= 0) return null;
              return (
                <rect
                  key={band.zone}
                  x={0}
                  y={yTop}
                  width={innerW}
                  height={h}
                  fill={band.color}
                  opacity={0.08}
                />
              );
            })}

            {/* Y gridlines + labels */}
            {yTicks.map((t) => (
              <g key={t} transform={`translate(0,${yScale(t)})`}>
                <line x1={0} x2={innerW} stroke="var(--color-line)" strokeWidth={1} />
                <text x={-8} y={3} textAnchor="end" className="fill-[var(--color-text-tertiary)] text-[10px] tabular">
                  {valueFormat(t)}
                </text>
              </g>
            ))}

            {/* X ticks */}
            {xTicks.map((t) => (
              <text
                key={t}
                x={xScale(t)}
                y={innerH + 16}
                textAnchor="middle"
                className="fill-[var(--color-text-tertiary)] text-[10px] tabular"
              >
                {formatElapsed(t)}
              </text>
            ))}

            {/* Series lines */}
            {renderedSeries.map((s) => (
              <path key={s.key} d={s.path} fill="none" stroke={s.color} strokeWidth={1.6} />
            ))}

            {/* Crosshair */}
            {hoverX !== null && hoverX >= 0 && hoverX <= innerW ? (
              <g>
                <line x1={hoverX} x2={hoverX} y1={0} y2={innerH} stroke="var(--color-line-strong)" strokeWidth={1} />
                {readout?.values.map((v) => {
                  const p = nearestPoint(
                    series.find((s) => s.key === v.key)?.points ?? [],
                    readout.t,
                  );
                  if (!p) return null;
                  return (
                    <circle key={v.key} cx={hoverX} cy={yScale(p.v)} r={3.5} fill={v.color} stroke="var(--color-surface)" strokeWidth={1.5} />
                  );
                })}
              </g>
            ) : null}
          </g>
        </svg>
      ) : null}

      {/* Tooltip */}
      {readout && hoverX !== null ? (
        <div
          className="pointer-events-none absolute top-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-raised)]"
          style={{
            left: Math.min(Math.max(hoverX + MARGIN.left + 8, 0), Math.max(0, width - 130)),
          }}
        >
          <div className="tabular mb-0.5 font-medium text-text-secondary">{formatElapsed(readout.t)}</div>
          {readout.values.map((v) => (
            <div key={v.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: v.color }} />
              <span className="text-text-secondary">{v.label}</span>
              <span className="tabular ml-auto font-medium text-text-primary">
                {valueFormat(v.value)} {v.unit}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
