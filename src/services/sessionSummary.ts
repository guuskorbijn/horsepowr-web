/**
 * Deterministic session summary — the DESCRIPTIVE fallback used when the AI
 * summary Edge Function isn't deployed or fails. It states measured facts only:
 * duration, HR aggregates, distance/speed, dominant HR zone and estimated gait.
 * It NEVER grades, advises, predicts, or compares to a baseline. The reused AI
 * function is held to the exact same rule.
 */
import {
  formatBpm,
  formatDistanceKm,
  formatDurationShort,
  formatSpeedKmh,
} from '@/services/format';
import { GAIT_LABELS } from '@/services/labels';
import type { HorseRow } from '@/types/db';
import type { GaitBand, SessionMetrics } from '@/types/view';
import type { ZoneShare } from '@/services/hrZone';

export interface SessionSummary {
  source: 'ai' | 'fallback';
  lines: string[];
}

function dominantZone(zones: ZoneShare[]): ZoneShare | null {
  let best: ZoneShare | null = null;
  for (const z of zones) {
    if (z.count > 0 && (!best || z.fraction > best.fraction)) best = z;
  }
  return best;
}

function dominantGait(bands: GaitBand[]): string | null {
  const totals = new Map<string, number>();
  for (const b of bands) {
    if (b.gait === 'inactive') continue;
    totals.set(b.gait, (totals.get(b.gait) ?? 0) + (b.endTs - b.startTs));
  }
  let bestGait: string | null = null;
  let bestMs = 0;
  for (const [gait, ms] of totals) {
    if (ms > bestMs) {
      bestMs = ms;
      bestGait = gait;
    }
  }
  return bestGait;
}

export function buildDeterministicSummary(
  horse: HorseRow,
  metrics: SessionMetrics,
  zones: ZoneShare[],
  gaitBands: GaitBand[],
): SessionSummary {
  const lines: string[] = [];
  const name = horse.name;

  lines.push(`${name} recorded a ${formatDurationShort(metrics.durationMs)} session.`);

  if (metrics.avgHr !== null) {
    const peak = metrics.peakHr !== null ? `, peaking at ${formatBpm(metrics.peakHr)}` : '';
    lines.push(`Average heart rate ${formatBpm(metrics.avgHr)}${peak}.`);
  }

  if (metrics.distanceM !== null && metrics.avgSpeedMs !== null) {
    lines.push(
      `Covered ${formatDistanceKm(metrics.distanceM)} at an average ${formatSpeedKmh(metrics.avgSpeedMs)}.`,
    );
  }

  const zone = dominantZone(zones);
  if (zone) {
    lines.push(
      `Most heart-rate time was in ${zone.zone.toUpperCase()} ${zone.label} (${Math.round(zone.fraction * 100)}%).`,
    );
  }

  const gait = dominantGait(gaitBands);
  if (gait) {
    lines.push(`Estimated gait was mostly ${GAIT_LABELS[gait as keyof typeof GAIT_LABELS]} (from GPS speed).`);
  }

  return { source: 'fallback', lines };
}
