import { Clock, Route, HeartPulse, Activity, Gauge } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  formatBpm,
  formatDistanceKm,
  formatDurationShort,
  formatSpeedKmh,
} from '@/services/format';
import type { SessionMetrics } from '@/types/view';

interface Tile {
  label: string;
  value: string;
  icon: typeof Clock;
}

export function SessionMetricTiles({ metrics }: { metrics: SessionMetrics }) {
  const tiles: Tile[] = [
    { label: 'Duration', value: formatDurationShort(metrics.durationMs), icon: Clock },
    {
      label: 'Distance',
      value: metrics.distanceM === null ? '—' : formatDistanceKm(metrics.distanceM),
      icon: Route,
    },
    { label: 'Avg HR', value: formatBpm(metrics.avgHr), icon: HeartPulse },
    { label: 'Peak HR', value: formatBpm(metrics.peakHr), icon: Activity },
    {
      label: 'Avg speed',
      value: metrics.avgSpeedMs === null ? '—' : formatSpeedKmh(metrics.avgSpeedMs),
      icon: Gauge,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Card key={tile.label} className="p-4">
            <div className="flex items-center gap-1.5 text-text-tertiary">
              <Icon size={15} />
              <span className="text-[12px]">{tile.label}</span>
            </div>
            <div className="tabular mt-1 font-display text-[24px] font-semibold leading-7 text-text-primary">
              {tile.value}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
