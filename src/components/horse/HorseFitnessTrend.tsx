'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/FormControls';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { VIndexTrendChart } from '@/components/charts/VIndexTrendChart';
import { HrSpeedCurveShiftChart } from '@/components/charts/HrSpeedCurveShiftChart';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { listSessionsForHorse } from '@/data/sessionRepository';
import { getMeasurements } from '@/data/measurementRepository';
import {
  buildVIndexTrend,
  filterTrend,
  vTrendPoints,
  type SessionVIndex,
} from '@/services/vIndexTrendService';
import { V_INDEX_THRESHOLDS, type VIndexThreshold } from '@/constants/hrSpeed';
import { TRAINING_TYPE_LABELS } from '@/services/labels';
import { cn } from '@/lib/cn';
import type { TrainingType } from '@/types/db';

// Cap the raw-row pull: V-index needs paired HR/speed rows, so we fetch the most
// recent sessions only (client-side, mirroring the Trends view's approach).
const RECENT_SESSION_LIMIT = 24;

export function HorseFitnessTrend({ horseId, maxHr }: { horseId: string; maxHr: number }) {
  const [trend, setTrend] = useState<SessionVIndex[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<VIndexThreshold>(200);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [trainingType, setTrainingType] = useState<TrainingType | ''>('');
  const token = useRef(0);

  useEffect(() => {
    const t = ++token.current;
    // All state updates happen after the first await so we never setState
    // synchronously during the effect (react-hooks/set-state-in-effect).
    (async () => {
      try {
        const supa = getBrowserSupabase();
        const sessions = await listSessionsForHorse(supa, horseId, {
          finishedOnly: true,
          limit: RECENT_SESSION_LIMIT,
        });
        const inputs = await Promise.all(
          sessions.map(async (session) => ({ session, rows: await getMeasurements(supa, session.id) })),
        );
        if (token.current !== t) return;
        setTrend(buildVIndexTrend(inputs));
        setError(null);
      } catch {
        if (token.current === t) setError('Could not load this horse’s sessions.');
      } finally {
        if (token.current === t) setLoading(false);
      }
    })();
  }, [horseId]);

  const filtered = useMemo(() => {
    if (!trend) return [];
    return filterTrend(trend, {
      fromMs: from ? new Date(from).getTime() : null,
      toMs: to ? new Date(`${to}T23:59:59`).getTime() : null,
      trainingType: trainingType || null,
    });
  }, [trend, from, to, trainingType]);

  const points = useMemo(() => vTrendPoints(filtered, threshold), [filtered, threshold]);

  if (loading) return <LoadingState label="Loading HR–speed history…" />;
  if (error) return <ErrorState description={error} />;
  if (!trend || trend.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Fitness signal — HR vs speed over time"
        subtitle="Each point is the speed at the chosen heart rate for that session. The curves show the HR–speed relationship across sessions."
      />
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            {V_INDEX_THRESHOLDS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setThreshold(h)}
                aria-pressed={threshold === h}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors',
                  threshold === h
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-line text-text-secondary hover:bg-surface-muted',
                )}
              >
                V{h}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-text-tertiary">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-text-tertiary">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-text-tertiary">
            Training type
            <Select
              value={trainingType}
              onChange={(e) => setTrainingType(e.target.value as TrainingType | '')}
              className="h-9 w-44 text-[13px]"
            >
              <option value="">All</option>
              {(Object.keys(TRAINING_TYPE_LABELS) as TrainingType[]).map((tt) => (
                <option key={tt} value={tt}>
                  {TRAINING_TYPE_LABELS[tt]}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div>
          <div className="mb-1 text-[13px] font-medium text-text-primary">Speed at HR {threshold} per session (km/h)</div>
          <VIndexTrendChart points={points} threshold={threshold} />
        </div>

        <div className="border-t border-line pt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px] font-medium text-text-primary">HR–speed curves, oldest → newest</span>
            <span className="text-[12px] text-text-tertiary">faint = older · solid = most recent</span>
          </div>
          <HrSpeedCurveShiftChart trend={filtered} maxHr={maxHr} />
        </div>
      </CardBody>
    </Card>
  );
}
