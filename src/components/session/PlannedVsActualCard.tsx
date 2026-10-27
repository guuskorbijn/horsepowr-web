'use client';

import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useTranslation } from '@/i18n/LocaleProvider';
import { formatHrRange, formatZoneSpan } from '@/services/calendar/agendaService';
import { getZone } from '@/services/hrZone';
import type { PlannedComparison } from '@/services/calendar/plannedComparison';

/**
 * Planned next to measured.
 *
 * DESCRIPTIVE ONLY, and that shapes every visual decision: no green, no red,
 * no arrows, no "on target" badge — every number is in the same neutral ink.
 * A duration delta keeps its sign and nothing else. Heart rates always carry
 * their Z label. Data-quality gaps are stated next to the percentages they
 * affect, never hidden. Mirrors the mobile card's rules.
 */

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Signed, never judged: "+4:12" and "−6:30" read the same way. */
function formatDelta(ms: number): string {
  return `${ms >= 0 ? '+' : '−'}${formatDuration(Math.abs(ms))}`;
}

function formatPct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function Row({ label, planned, measured }: { label: string; planned: string; measured: string }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-2 pr-4 text-left text-[13px] font-medium text-text-secondary">
        {label}
      </th>
      <td className="py-2 pr-4 text-[14px] tabular-nums text-text-primary">{planned}</td>
      <td className="py-2 text-[14px] tabular-nums text-text-primary">{measured}</td>
    </tr>
  );
}

export function PlannedVsActualCard({ planned, maxHr }: { planned: PlannedComparison; maxHr: number }) {
  const { t } = useTranslation();
  if (planned.kind === 'unplanned') return null;

  const header = (
    <CardHeader
      title={t('plannedVsActual.title')}
      action={
        <Link
          href="/agenda"
          className="no-print inline-flex min-h-11 items-center rounded-md px-3 text-[13px] font-medium text-primary hover:bg-surface-muted"
        >
          {t('plannedVsActual.openAgenda')}
        </Link>
      }
    />
  );

  if (planned.kind === 'linked-without-snapshot') {
    return (
      <Card>
        {header}
        <CardBody>
          <p className="text-[14px] text-text-secondary">{t('plannedVsActual.linkedWithoutSnapshot')}</p>
        </CardBody>
      </Card>
    );
  }

  const { duration, hr, hrOmittedReason, coverage } = planned.comparison;
  const notes: string[] = [];
  if (hrOmittedReason === 'no-target') notes.push(t('plannedVsActual.noTarget'));
  if (hrOmittedReason === 'no-data') notes.push(t('plannedVsActual.noHrData'));
  if (hr !== null && hr.insidePct === null) notes.push(t('plannedVsActual.notEnoughHrData'));
  if (hr !== null && hr.insidePct !== null) {
    notes.push(t('plannedVsActual.coverageNote').replace('{pct}', String(Math.round(coverage.coveragePct))));
    notes.push(t('plannedVsActual.boundaryNote'));
  }
  if (coverage.uncountedGapCount > 0) {
    notes.push(
      t('plannedVsActual.gapNote')
        .replace('{count}', String(coverage.uncountedGapCount))
        .replace('{duration}', formatDuration(coverage.uncountedGapMs)),
    );
  }

  const range = hr === null ? null : formatHrRange(hr.targetMinBpm, hr.targetMaxBpm);
  const zones = hr === null ? '' : formatZoneSpan(hr.targetZones);

  return (
    <Card>
      {header}
      <CardBody className="space-y-3">
        <table className="w-full">
          <thead>
            <tr>
              <td />
              <th scope="col" className="pb-1 text-left text-[12px] font-medium text-text-tertiary">
                {t('plannedVsActual.plannedColumn')}
              </th>
              <th scope="col" className="pb-1 text-left text-[12px] font-medium text-text-tertiary">
                {t('plannedVsActual.measuredColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            <Row
              label={t('plannedVsActual.durationRow')}
              planned={duration.plannedMs === null ? '—' : formatDuration(duration.plannedMs)}
              measured={
                duration.deltaMs === null
                  ? formatDuration(duration.measuredMs)
                  : `${formatDuration(duration.measuredMs)} (${formatDelta(duration.deltaMs)})`
              }
            />
            {hr !== null ? (
              <>
                <Row
                  label={t('plannedVsActual.targetRangeRow')}
                  planned={range === null ? '—' : `${range} · ${zones}`}
                  measured="—"
                />
                <Row
                  label={t('plannedVsActual.avgHrRow')}
                  planned="—"
                  measured={
                    hr.measuredAvgBpm === null
                      ? '—'
                      : `${hr.measuredAvgBpm} bpm · ${getZone(hr.measuredAvgBpm, maxHr).toUpperCase()}`
                  }
                />
                <Row label={t('plannedVsActual.insideRow')} planned="—" measured={formatPct(hr.insidePct)} />
                <Row label={t('plannedVsActual.belowRow')} planned="—" measured={formatPct(hr.belowPct)} />
                <Row label={t('plannedVsActual.aboveRow')} planned="—" measured={formatPct(hr.abovePct)} />
              </>
            ) : null}
          </tbody>
        </table>
        {notes.map((note) => (
          <p key={note} className="text-[13px] text-text-secondary">
            {note}
          </p>
        ))}
        <p className="text-[12px] text-text-tertiary">{t('plannedVsActual.noVerdictNote')}</p>
      </CardBody>
    </Card>
  );
}
