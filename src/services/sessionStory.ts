import type { SessionMetrics } from '@/types/view';
import type { PlannedComparison } from '@/services/calendar/plannedComparison';

/**
 * The one-line headline of a session: "45 min · 3.2 km · avg 142 bpm ·
 * 2 of 2 intervals at 165–175". PURE; returns parts, the page joins them
 * with the translator. Facts only — what was recorded and, when there was a
 * plan, how many planned bouts the heart rate shows. No verdict.
 */
export type StoryPart =
  | { kind: 'duration'; minutes: number }
  | { kind: 'distance'; km: string }
  | { kind: 'avgHr'; bpm: number }
  | { kind: 'peakHr'; bpm: number }
  | { kind: 'bouts'; measured: number; planned: number; range: string | null };

export function sessionStory(metrics: SessionMetrics, planned: PlannedComparison): StoryPart[] {
  const parts: StoryPart[] = [{ kind: 'duration', minutes: Math.round(metrics.durationMs / 60_000) }];
  if (metrics.distanceM !== null && metrics.distanceM > 50) {
    parts.push({ kind: 'distance', km: (metrics.distanceM / 1000).toFixed(1) });
  }
  if (metrics.avgHr !== null) parts.push({ kind: 'avgHr', bpm: Math.round(metrics.avgHr) });
  if (metrics.peakHr !== null) parts.push({ kind: 'peakHr', bpm: Math.round(metrics.peakHr) });
  if (planned.kind === 'compared') {
    for (const block of planned.comparison.blocks) {
      if (block.plannedBouts === null) continue;
      const range =
        block.targetMinBpm !== null && block.targetMaxBpm !== null
          ? `${block.targetMinBpm}–${block.targetMaxBpm}`
          : null;
      parts.push({ kind: 'bouts', measured: block.measuredBouts ?? 0, planned: block.plannedBouts, range });
    }
  }
  return parts;
}

export function storyText(parts: readonly StoryPart[], t: (key: string) => string): string {
  return parts
    .map((p) => {
      switch (p.kind) {
        case 'duration':
          return `${p.minutes} min`;
        case 'distance':
          return `${p.km} km`;
        case 'avgHr':
          return t('session.storyAvg').replace('{bpm}', String(p.bpm));
        case 'peakHr':
          return t('session.storyPeak').replace('{bpm}', String(p.bpm));
        case 'bouts':
          return t(p.range === null ? 'session.storyBoutsNoRange' : 'session.storyBouts')
            .replace('{measured}', String(p.measured))
            .replace('{planned}', String(p.planned))
            .replace('{range}', p.range ?? '');
      }
    })
    .join(' · ');
}
