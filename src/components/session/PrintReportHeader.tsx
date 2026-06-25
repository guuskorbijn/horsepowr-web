import {
  formatBpm,
  formatDistanceKm,
  formatDurationShort,
  formatSpeedKmh,
} from '@/services/format';
import { TRAINING_TYPE_LABELS } from '@/services/labels';
import { formatDateTime } from '@/services/format';
import type { SessionView } from '@/services/sessionViewService';

/**
 * Print-only report header (W18) — turns the printed page into a deliberate,
 * analyst-grade handout: who/when, the headline measured metrics, and the
 * V-index values up top. Descriptive only; hidden on screen.
 */
export function PrintReportHeader({ view }: { view: SessionView }) {
  const { session, horse, metrics, hrSpeed } = view;

  const facts: Array<{ label: string; value: string }> = [
    { label: 'Duration', value: formatDurationShort(metrics.durationMs) },
    { label: 'Distance', value: metrics.distanceM === null ? '—' : formatDistanceKm(metrics.distanceM) },
    { label: 'Avg HR', value: formatBpm(metrics.avgHr) },
    { label: 'Peak HR', value: formatBpm(metrics.peakHr) },
    { label: 'Avg speed', value: metrics.avgSpeedMs === null ? '—' : formatSpeedKmh(metrics.avgSpeedMs) },
    { label: 'Max speed', value: metrics.maxSpeedMs === null ? '—' : formatSpeedKmh(metrics.maxSpeedMs) },
  ];

  return (
    <div className="print-only mb-4 border-b border-line pb-4">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-[22px] font-semibold text-text-primary">
          {horse.name} — session report
        </h1>
        <span className="text-[13px] text-text-secondary">{formatDateTime(session.started_at)}</span>
      </div>
      <div className="mt-1 text-[12px] text-text-secondary">
        {session.training_type ? TRAINING_TYPE_LABELS[session.training_type] : 'Session'}
        {session.location_name ? ` · ${session.location_name}` : ''}
        {horse.discipline ? ` · ${horse.discipline}` : ''}
      </div>

      <div className="mt-3 grid grid-cols-6 gap-3">
        {facts.map((f) => (
          <div key={f.label}>
            <div className="text-[10px] uppercase tracking-wide text-text-tertiary">{f.label}</div>
            <div className="tabular text-[15px] font-semibold text-text-primary">{f.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-6">
        {hrSpeed.vIndices.map((v) => (
          <div key={v.hr}>
            <div className="text-[10px] uppercase tracking-wide text-text-tertiary">Speed at HR {v.hr}</div>
            <div className="tabular text-[15px] font-semibold text-text-primary">
              {v.reached && v.speedKmh !== null ? `${v.speedKmh.toFixed(1)} km/h` : 'not reached'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
