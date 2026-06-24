'use client';

import { useMemo, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useOrg } from '@/components/shell/OrgContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/states';
import { TrendChart } from '@/components/charts/TrendChart';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { listSessionsForHorse } from '@/data/sessionRepository';
import { getMeasurements } from '@/data/measurementRepository';
import {
  buildHorseTrend,
  TREND_METRICS,
  type TrendMetric,
  type TrendSeries,
} from '@/services/trendService';
import { SERIES_PALETTE } from '@/services/compareService';
import { cn } from '@/lib/cn';
import type { HorseRow } from '@/types/db';

type Mode = 'horse' | 'location';

async function loadHorseSeries(
  horse: HorseRow,
  color: string,
): Promise<TrendSeries | null> {
  const supa = getBrowserSupabase();
  const sessions = await listSessionsForHorse(supa, horse.id, { finishedOnly: true });
  if (sessions.length === 0) return null;
  const inputs = await Promise.all(
    sessions.map(async (session) => ({ session, rows: await getMeasurements(supa, session.id) })),
  );
  return buildHorseTrend(inputs, horse.name, color);
}

export function TrendsView({ horses }: { horses: HorseRow[] }) {
  const { selectedLocationId, locations } = useOrg();
  const [mode, setMode] = useState<Mode>('horse');
  const [metric, setMetric] = useState<TrendMetric>('avgHr');
  const [horseId, setHorseId] = useState('');
  const [series, setSeries] = useState<TrendSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const token = useRef(0);

  const visibleHorses = useMemo(
    () =>
      selectedLocationId ? horses.filter((h) => h.location_id === selectedLocationId) : horses,
    [horses, selectedLocationId],
  );

  const metricDef = TREND_METRICS.find((m) => m.key === metric) ?? TREND_METRICS[0]!;
  const locationLabel = selectedLocationId
    ? (locations.find((l) => l.id === selectedLocationId)?.name ?? 'location')
    : 'all locations';

  function reset() {
    setSeries([]);
    setLoaded(null);
    setError(null);
  }

  async function loadForHorse(id: string) {
    const t = ++token.current;
    setHorseId(id);
    reset();
    if (!id) return;
    const horse = horses.find((h) => h.id === id);
    if (!horse) return;
    setLoading(true);
    try {
      const s = await loadHorseSeries(horse, SERIES_PALETTE[0]!);
      if (token.current !== t) return;
      setSeries(s ? [s] : []);
      setLoaded(horse.name);
    } catch {
      if (token.current === t) setError('Could not load this horse’s sessions.');
    } finally {
      if (token.current === t) setLoading(false);
    }
  }

  async function loadForLocation() {
    const t = ++token.current;
    reset();
    setLoading(true);
    try {
      const built = await Promise.all(
        visibleHorses.map((h, i) => loadHorseSeries(h, SERIES_PALETTE[i % SERIES_PALETTE.length]!)),
      );
      if (token.current !== t) return;
      setSeries(built.filter((s): s is TrendSeries => s !== null));
      setLoaded(locationLabel);
    } catch {
      if (token.current === t) setError('Could not load trends for this location.');
    } finally {
      if (token.current === t) setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    reset();
    setHorseId('');
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="What to plot"
          subtitle="Descriptive trends — the measured numbers over time. No grades, no baselines."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={mode === 'horse' ? 'secondary' : 'ghost'} size="sm" onClick={() => switchMode('horse')}>
              Per horse
            </Button>
            <Button
              variant={mode === 'location' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => switchMode('location')}
            >
              Cross-horse ({locationLabel})
            </Button>
          </div>

          {mode === 'horse' ? (
            <div className="max-w-sm">
              <Select aria-label="Horse" value={horseId} onChange={(e) => loadForHorse(e.target.value)}>
                <option value="">Select a horse…</option>
                {visibleHorses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={loadForLocation} disabled={loading || visibleHorses.length === 0}>
                Load trends
              </Button>
              <span className="text-[13px] text-text-tertiary">
                {visibleHorses.length} {visibleHorses.length === 1 ? 'horse' : 'horses'} in {locationLabel}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {TREND_METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                aria-pressed={metric === m.key}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors',
                  metric === m.key
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-line text-text-secondary hover:bg-surface-muted',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <LoadingState label="Loading sessions…" />
      ) : error ? (
        <ErrorState description={error} />
      ) : series.length > 0 ? (
        <Card>
          <CardHeader
            title={`${metricDef.label} over time`}
            subtitle={loaded ? `${loaded} · per session` : undefined}
          />
          <CardBody className="space-y-4">
            {series.length > 1 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {series.map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            ) : null}
            <TrendChart
              series={series}
              metric={metric}
              unit={metricDef.unit}
              format={(v) => (metricDef.unit === 'bpm' || metricDef.unit === 'min' ? `${Math.round(v)}` : v.toFixed(1))}
            />
          </CardBody>
        </Card>
      ) : (
        <EmptyState
          icon={<TrendingUp size={28} />}
          title="Nothing plotted yet"
          description={
            mode === 'horse'
              ? 'Pick a horse to plot its sessions over time.'
              : 'Load the current location to compare horses on one metric.'
          }
        />
      )}
    </div>
  );
}
