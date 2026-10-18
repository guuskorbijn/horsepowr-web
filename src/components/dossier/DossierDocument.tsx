'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { useTranslation } from '@/i18n/LocaleProvider';
import {
  DOSSIER_DISCLOSURE,
  dossierToCsv,
  type Dossier,
} from '@/services/dossier/dossierService';
import { exportSlug } from '@/services/csvExport';

/**
 * The printable training record.
 *
 * Printed rather than rendered to PDF by a library: a browser's own print
 * dialog produces a PDF on every platform people actually use, and adding a
 * PDF dependency to ship one page would be the opposite of keeping the tree
 * lean. `print:` utilities strip the chrome so what comes out is the
 * document, not a screenshot of the app.
 *
 * The disclosure block is not small print at the bottom. It sits under the
 * totals, in normal type, because the thing most likely to be misread in a
 * training record is what it does NOT say.
 */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DossierDocument({
  dossier,
  horseId,
}: {
  dossier: Dossier;
  horseId: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();

  function setRange(key: 'from' | 'to', value: string): void {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`/horses/${horseId}/dossier?${next.toString()}`);
  }

  function downloadCsv(): void {
    const blob = new Blob([dossierToCsv(dossier)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportSlug(dossier.horseName, dossier.range.from)}-record.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const { totals } = dossier;
  const hours = Math.floor(totals.recordedMinutes / 60);
  const minutes = totals.recordedMinutes % 60;
  const partial =
    totals.detailedSessions > 0 && totals.detailedSessions < totals.sessions;

  return (
    <div className="space-y-6">
      {/* Controls. Gone from the printed page. */}
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <Link
          href={`/horses/${horseId}`}
          className="inline-flex items-center gap-1.5 text-[14px] text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {dossier.horseName}
        </Link>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('dossier.from')} htmlFor="dossier-from">
            <Input
              id="dossier-from"
              type="date"
              defaultValue={dossier.range.from}
              onChange={(e) => setRange('from', e.target.value)}
            />
          </Field>
          <Field label={t('dossier.to')} htmlFor="dossier-to">
            <Input
              id="dossier-to"
              type="date"
              defaultValue={dossier.range.to}
              onChange={(e) => setRange('to', e.target.value)}
            />
          </Field>
          <Button type="button" variant="secondary" size="md" onClick={downloadCsv}>
            <Download size={16} />
            {t('dossier.csv')}
          </Button>
          <Button type="button" size="md" onClick={() => window.print()}>
            <Printer size={16} />
            {t('dossier.print')}
          </Button>
        </div>
      </div>

      <article className="space-y-6 rounded-xl border border-line bg-surface p-8 print:rounded-none print:border-0 print:p-0">
        <header className="space-y-1 border-b border-line pb-4">
          <h1 className="font-display text-[26px] font-semibold text-text-primary">
            {t('dossier.heading')} — {dossier.horseName}
          </h1>
          <p className="text-[14px] text-text-secondary">
            {dossier.stableName ? `${dossier.stableName} · ` : ''}
            {fmtDate(`${dossier.range.from}T00:00:00Z`)} –{' '}
            {fmtDate(`${dossier.range.to}T00:00:00Z`)}
          </p>
          <p className="text-[12px] text-text-tertiary">
            {t('dossier.generated')} {fmtDate(dossier.generatedAt)}
          </p>
        </header>

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: t('dossier.totals.sessions'), value: String(totals.sessions) },
            {
              label: t('dossier.totals.recorded'),
              value: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
            },
            {
              label: t('dossier.totals.distance'),
              value: totals.distanceKm === null ? '—' : `${totals.distanceKm} km`,
            },
            {
              label: t('dossier.totals.peakHr'),
              value: totals.peakHr === null ? '—' : `${totals.peakHr} bpm`,
            },
          ].map((tile) => (
            <div key={tile.label}>
              <div className="text-[12px] text-text-tertiary">{tile.label}</div>
              <div className="tabular font-display text-[22px] font-semibold text-text-primary">
                {tile.value}
              </div>
            </div>
          ))}
        </section>

        {partial ? (
          <p className="rounded-md border border-line bg-surface-sunken px-4 py-3 text-[13px] text-text-secondary">
            {t('dossier.partial')
              .replace('{detailed}', String(totals.detailedSessions))
              .replace('{total}', String(totals.sessions))}
          </p>
        ) : null}

        <section>
          <h2 className="mb-2 font-display text-[16px] font-medium text-text-primary">
            {t('dossier.sessionsHeading')}
          </h2>
          {dossier.sessions.length === 0 ? (
            <p className="text-[14px] text-text-secondary">{t('dossier.noSessions')}</p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['date', 'type', 'duration', 'distance', 'avgHr', 'peakHr'].map(
                    (key) => (
                      <th
                        key={key}
                        className="border-b border-line px-2 py-1.5 text-left font-medium text-text-tertiary last:text-right"
                      >
                        {t(`dossier.columns.${key}`)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {dossier.sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="border-b border-line px-2 py-1.5 text-text-primary">
                      {fmtDate(session.startedAt)}{' '}
                      <span className="text-text-tertiary">
                        {fmtTime(session.startedAt)}
                      </span>
                    </td>
                    <td className="border-b border-line px-2 py-1.5 text-text-secondary">
                      {session.trainingType ?? '—'}
                    </td>
                    <td className="tabular border-b border-line px-2 py-1.5 text-text-primary">
                      {Math.round(session.metrics.durationMs / 60_000)} min
                    </td>
                    <td className="tabular border-b border-line px-2 py-1.5 text-text-primary">
                      {session.metrics.distanceM === null
                        ? '—'
                        : `${(session.metrics.distanceM / 1000).toFixed(1)} km`}
                    </td>
                    <td className="tabular border-b border-line px-2 py-1.5 text-text-primary">
                      {session.metrics.avgHr ?? '—'}
                    </td>
                    <td className="tabular border-b border-line px-2 py-1.5 text-right text-text-primary">
                      {session.metrics.peakHr ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="space-y-1.5 border-t border-line pt-4">
          <h2 className="font-display text-[14px] font-medium text-text-primary">
            {t('dossier.scopeHeading')}
          </h2>
          <ul className="space-y-1 text-[12px] leading-5 text-text-secondary">
            {DOSSIER_DISCLOSURE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}
