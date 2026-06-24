/**
 * Comparison service — builds overlaid series + a side-by-side metric table for
 * 2+ sessions of the same horse, aligned on elapsed time. Descriptive only:
 * it overlays measured traces and lists measured numbers; it never declares one
 * session better, improving, or concerning.
 */
import { computeSessionMetrics } from '@/services/sessionMetrics';
import {
  altitudeSeries,
  hrSeries,
  speedSeries,
} from '@/services/measurementService';
import { formatDate } from '@/services/format';
import type { MeasurementRow, SessionRow } from '@/types/db';
import type { ChartSeries, SessionMetrics } from '@/types/view';

/** Colour-blind-safe, visually distinct series hues. Always paired with a text
 *  label in the legend (never colour alone). */
export const SERIES_PALETTE: readonly string[] = [
  '#0058A2', // blue
  '#FF7A59', // coral
  '#1FA971', // green
  '#7C5CC4', // violet
  '#F2A20C', // amber
  '#2E7DD1', // info blue
];

export interface ComparisonInput {
  session: SessionRow;
  rows: MeasurementRow[];
}

export interface ComparisonColumn {
  session: SessionRow;
  label: string;
  color: string;
  metrics: SessionMetrics;
}

export interface Comparison {
  columns: ComparisonColumn[];
  hr: ChartSeries[];
  speed: ChartSeries[];
  altitude: ChartSeries[];
}

function colorFor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length] ?? '#0058A2';
}

export function buildComparison(inputs: ComparisonInput[]): Comparison {
  const columns: ComparisonColumn[] = [];
  const hr: ChartSeries[] = [];
  const speed: ChartSeries[] = [];
  const altitude: ChartSeries[] = [];

  inputs.forEach(({ session, rows }, i) => {
    const color = colorFor(i);
    const label = formatDate(session.started_at);
    columns.push({ session, label, color, metrics: computeSessionMetrics(session, rows) });

    const decorate = (s: ChartSeries): ChartSeries => ({
      ...s,
      key: `${s.kind}-${session.id}`,
      label,
      color,
    });

    const h = hrSeries(rows, session.started_at);
    if (h.points.length > 0) hr.push(decorate(h));
    const sp = speedSeries(rows, session.started_at);
    if (sp.points.length > 0) speed.push(decorate(sp));
    const al = altitudeSeries(rows, session.started_at);
    if (al.points.length > 0) altitude.push(decorate(al));
  });

  return { columns, hr, speed, altitude };
}
