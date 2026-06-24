import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import {
  formatBpm,
  formatDistanceKm,
  formatDurationShort,
  formatSpeedKmh,
} from '@/services/format';
import type { ComparisonColumn } from '@/services/compareService';
import type { SessionMetrics } from '@/types/view';

interface MetricRow {
  label: string;
  get: (m: SessionMetrics) => string;
}

const ROWS: MetricRow[] = [
  { label: 'Duration', get: (m) => formatDurationShort(m.durationMs) },
  { label: 'Distance', get: (m) => (m.distanceM === null ? '—' : formatDistanceKm(m.distanceM)) },
  { label: 'Avg HR', get: (m) => formatBpm(m.avgHr) },
  { label: 'Peak HR', get: (m) => formatBpm(m.peakHr) },
  { label: 'Avg speed', get: (m) => (m.avgSpeedMs === null ? '—' : formatSpeedKmh(m.avgSpeedMs)) },
  { label: 'Max speed', get: (m) => (m.maxSpeedMs === null ? '—' : formatSpeedKmh(m.maxSpeedMs)) },
  {
    label: 'Altitude gain',
    get: (m) => (m.altitudeGainM === null ? '—' : `${Math.round(m.altitudeGainM)} m`),
  },
];

export function ComparisonTable({ columns }: { columns: ComparisonColumn[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Side by side" subtitle="The measured numbers for each session." />
      <CardBody className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              <th className="py-2 pr-4 text-left font-medium text-text-secondary">Metric</th>
              {columns.map((c) => (
                <th key={c.session.id} className="py-2 pl-4 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                    <span className="font-medium text-text-primary">{c.label}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <td className="py-2 pr-4 text-text-secondary">{row.label}</td>
                {columns.map((c) => (
                  <td key={c.session.id} className="tabular py-2 pl-4 text-right font-medium text-text-primary">
                    {row.get(c.metrics)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
