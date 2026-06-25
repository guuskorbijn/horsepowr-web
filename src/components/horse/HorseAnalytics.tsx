'use client';

import { useEffect, useRef, useState } from 'react';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { HorseFitnessTrend } from '@/components/horse/HorseFitnessTrend';
import { WeeklyVolumeCard } from '@/components/horse/WeeklyVolumeCard';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { listSessionsForHorse } from '@/data/sessionRepository';
import { getMeasurements } from '@/data/measurementRepository';
import { buildVIndexTrend, type SessionVIndex } from '@/services/vIndexTrendService';
import { buildWeeklyVolume, type WeekVolume } from '@/services/weeklyVolumeService';

// Cap the raw-row pull: these views need paired HR/speed rows, so we fetch the
// most recent sessions only (client-side, mirroring the Trends view's approach).
const RECENT_SESSION_LIMIT = 24;

interface Loaded {
  trend: SessionVIndex[];
  weeks: WeekVolume[];
}

/**
 * Loads a horse's recent sessions + measurement rows ONCE, then derives both the
 * V-index fitness trend (W13) and the weekly volume (W16) from the same data —
 * no double fetch. All math is client-side over existing rows.
 */
export function HorseAnalytics({ horseId, maxHr }: { horseId: string; maxHr: number }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);

  useEffect(() => {
    const t = ++token.current;
    // State updates only after the first await (react-hooks/set-state-in-effect).
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
        setData({
          trend: buildVIndexTrend(inputs),
          weeks: buildWeeklyVolume(inputs, maxHr),
        });
        setError(null);
      } catch {
        if (token.current === t) setError('Could not load this horse’s history.');
      } finally {
        if (token.current === t) setLoading(false);
      }
    })();
  }, [horseId, maxHr]);

  if (loading) return <LoadingState label="Loading HR–speed history…" />;
  if (error) return <ErrorState description={error} />;
  if (!data || data.trend.length === 0) return null;

  return (
    <>
      <HorseFitnessTrend trend={data.trend} maxHr={maxHr} />
      <WeeklyVolumeCard weeks={data.weeks} />
    </>
  );
}
