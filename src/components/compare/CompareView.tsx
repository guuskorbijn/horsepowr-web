'use client';

import { useMemo, useRef, useState } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { useOrg } from '@/components/shell/OrgContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/FormControls';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/StatusPill';
import { OverlayCharts } from '@/components/charts/OverlayCharts';
import { ComparisonTable } from '@/components/compare/ComparisonTable';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { listSessionsForHorse } from '@/data/sessionRepository';
import { getMeasurements } from '@/data/measurementRepository';
import { buildComparison, type Comparison } from '@/services/compareService';
import { formatRelativeDay } from '@/services/format';
import { cn } from '@/lib/cn';
import type { HorseRow, SessionRow } from '@/types/db';

export function CompareView({ horses }: { horses: HorseRow[] }) {
  const { selectedLocationId } = useOrg();
  const visibleHorses = useMemo(
    () =>
      selectedLocationId
        ? horses.filter((h) => h.location_id === selectedLocationId)
        : horses,
    [horses, selectedLocationId],
  );

  const [horseId, setHorseId] = useState<string>('');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a stale response when the user switches horses quickly.
  const loadToken = useRef(0);

  async function selectHorse(id: string) {
    const token = ++loadToken.current;
    setHorseId(id);
    setSessions([]);
    setSelectedIds([]);
    setComparison(null);
    setError(null);
    if (!id) return;
    setSessionsLoading(true);
    try {
      const rows = await listSessionsForHorse(getBrowserSupabase(), id);
      if (loadToken.current !== token) return;
      setSessions(rows);
    } catch {
      if (loadToken.current === token) setError('Could not load this horse’s sessions.');
    } finally {
      if (loadToken.current === token) setSessionsLoading(false);
    }
  }

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setComparison(null);
  }

  async function runComparison() {
    setComparing(true);
    setError(null);
    try {
      const supa = getBrowserSupabase();
      const chosen = sessions.filter((s) => selectedIds.includes(s.id));
      const inputs = await Promise.all(
        chosen.map(async (session) => ({
          session,
          rows: await getMeasurements(supa, session.id),
        })),
      );
      setComparison(buildComparison(inputs));
    } catch {
      setError('Could not load measurements for the selected sessions.');
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Pick a horse and 2+ sessions" />
        <CardBody className="space-y-4">
          <div className="max-w-sm">
            <Select
              aria-label="Horse"
              value={horseId}
              onChange={(e) => selectHorse(e.target.value)}
            >
              <option value="">Select a horse…</option>
              {visibleHorses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </div>

          {sessionsLoading ? (
            <LoadingState label="Loading sessions…" />
          ) : horseId && sessions.length === 0 ? (
            <p className="text-[14px] text-text-secondary">This horse has no sessions yet.</p>
          ) : sessions.length > 0 ? (
            <div className="space-y-2">
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sessions.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => toggle(s.id)}
                        aria-pressed={checked}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left transition-colors',
                          checked
                            ? 'border-primary bg-primary-soft'
                            : 'border-line hover:bg-surface-muted',
                        )}
                      >
                        <span className="text-[14px] text-text-primary">
                          {formatRelativeDay(s.started_at)}
                        </span>
                        {checked ? <StatusPill tone="info">Selected</StatusPill> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={selectedIds.length < 2 || comparing}
                  onClick={runComparison}
                  className="inline-flex h-[44px] items-center justify-center rounded-md bg-primary px-4 text-[15px] font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:bg-surface-muted disabled:text-text-tertiary"
                >
                  {comparing ? 'Comparing…' : 'Compare sessions'}
                </button>
                <span className="text-[13px] text-text-tertiary">
                  {selectedIds.length} selected{selectedIds.length < 2 ? ' · pick at least 2' : ''}
                </span>
              </div>
            </div>
          ) : null}

          {error ? <ErrorState description={error} /> : null}
        </CardBody>
      </Card>

      {comparison ? (
        <>
          <ComparisonTable columns={comparison.columns} />
          <OverlayCharts
            hr={comparison.hr}
            speed={comparison.speed}
            altitude={comparison.altitude}
            legend={comparison.columns.map((c) => ({ label: c.label, color: c.color }))}
          />
        </>
      ) : !horseId ? (
        <EmptyState
          icon={<GitCompareArrows size={28} />}
          title="Pick a horse to start"
          description="Choose a horse, then select two or more of its sessions to overlay."
        />
      ) : null}
    </div>
  );
}
