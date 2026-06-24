/**
 * CSV assembly — pure string builders (no DOM). Hand-rolled (no papaparse needed
 * for this shape). Exports measured facts for the analyst: raw measurement rows
 * and a session summary. Descriptive only.
 */
import {
  formatBpm,
  formatDistanceKm,
  formatDurationShort,
  formatSpeedKmh,
} from '@/services/format';
import type { MeasurementRow } from '@/types/db';
import type { SessionView } from '@/services/sessionViewService';

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toRow(cells: Array<string | number | null>): string {
  return cells
    .map((c) => (c === null || c === undefined ? '' : escapeCell(String(c))))
    .join(',');
}

/** Raw measurement rows, one line per sample. HR and GPS share the timestamp. */
export function measurementsToCsv(rows: MeasurementRow[], startedAt: string): string {
  const startMs = new Date(startedAt).getTime();
  const header = toRow([
    'timestamp',
    'elapsed_ms',
    'hr_bpm',
    'rr_ms',
    'speed_ms',
    'altitude_m',
    'lat',
    'lng',
  ]);
  const lines = rows.map((r) =>
    toRow([
      r.timestamp,
      new Date(r.timestamp).getTime() - startMs,
      r.hr_bpm,
      r.rr_ms ? r.rr_ms.join(';') : '',
      r.speed_ms,
      r.altitude_m,
      r.lat,
      r.lng,
    ]),
  );
  return [header, ...lines].join('\n');
}

/** One-section session summary: metric,value pairs. */
export function sessionSummaryToCsv(view: SessionView): string {
  const m = view.metrics;
  const rows: Array<[string, string]> = [
    ['horse', view.horse.name],
    ['discipline', view.horse.discipline ?? ''],
    ['started_at', view.session.started_at],
    ['ended_at', view.session.ended_at ?? ''],
    ['duration', formatDurationShort(m.durationMs)],
    ['distance', m.distanceM === null ? '' : formatDistanceKm(m.distanceM)],
    ['avg_hr', formatBpm(m.avgHr)],
    ['peak_hr', formatBpm(m.peakHr)],
    ['min_hr', formatBpm(m.minHr)],
    ['avg_speed', m.avgSpeedMs === null ? '' : formatSpeedKmh(m.avgSpeedMs)],
    ['max_speed', m.maxSpeedMs === null ? '' : formatSpeedKmh(m.maxSpeedMs)],
    ['altitude_gain_m', m.altitudeGainM === null ? '' : String(Math.round(m.altitudeGainM))],
    ['hr_samples', String(m.hrSampleCount)],
    ['gps_samples', String(m.gpsSampleCount)],
    ['recording_quality', view.quality.grade],
    ['training_type', view.session.training_type ?? ''],
    ['environment', view.session.environment ?? ''],
    ['location_name', view.session.location_name ?? ''],
    ['physical_rating', view.session.physical_rating === null ? '' : String(view.session.physical_rating)],
    ['mental_rating', view.session.mental_rating === null ? '' : String(view.session.mental_rating)],
    ['injury_concern', String(view.session.injury_concern)],
    ['injury_recovery', String(view.session.injury_recovery)],
    ['notes', view.session.notes ?? ''],
  ];
  const header = toRow(['metric', 'value']);
  return [header, ...rows.map((r) => toRow(r))].join('\n');
}

/** A filesystem-safe slug for download names. */
export function exportSlug(name: string, isoDate: string): string {
  const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const date = isoDate.slice(0, 10);
  return `${safe || 'session'}-${date}`;
}
