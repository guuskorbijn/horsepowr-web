'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileUp } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/FormControls';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useActivityImport, type ImportChoices } from '@/hooks/useActivityImport';
import { formatDistanceKm, formatDuration } from '@/services/format';
import { getZone } from '@/services/hrZone';
import { ACCEPTED_EXTENSIONS } from '@/services/import/importLimits';
import type { ImportPreview } from '@/services/import/importService';
import { TRAINING_TYPES } from '@/types/db';

interface HorseOption {
  id: string;
  name: string;
  maxHr: number;
}

function fill(template: string, values: Record<string, number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-text-tertiary">{label}</dt>
      <dd className="text-[15px] font-medium tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}

function PreviewStats({ preview, maxHr }: { preview: ImportPreview; maxHr: number | null }) {
  const { t } = useTranslation();
  // An HR is shown with its Z label once a horse (and so a max HR) is known.
  const hr = (bpm: number | null): string =>
    bpm === null ? '—' : maxHr === null ? `${bpm} bpm` : `${bpm} bpm · ${getZone(bpm, maxHr).toUpperCase()}`;
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label={t('import.stat.start')} value={preview.startedAt.slice(0, 16).replace('T', ' ')} />
      <Stat label={t('import.stat.duration')} value={formatDuration(preview.durationSec * 1000)} />
      <Stat label={t('import.stat.distance')} value={preview.distanceM === null ? '—' : formatDistanceKm(preview.distanceM)} />
      <Stat label={t('import.stat.avgHr')} value={hr(preview.avgHr)} />
      <Stat label={t('import.stat.peakHr')} value={hr(preview.peakHr)} />
      <Stat label={t('import.stat.peakSpeed')} value={preview.peakSpeedKmh === null ? '—' : `${preview.peakSpeedKmh} km/h`} />
      <Stat label={t('import.stat.hrSamples')} value={String(preview.hrSampleCount)} />
      <Stat label={t('import.stat.gpsSamples')} value={String(preview.gpsSampleCount)} />
      <Stat label={t('import.stat.rrIntervals')} value={String(preview.rrIntervalCount)} />
      <Stat label={t('import.stat.quality')} value={t(`import.quality.${preview.qualityGrade}`)} />
      <Stat label={t('import.stat.format')} value={preview.format.toUpperCase()} />
    </dl>
  );
}

/**
 * Upload -> preview -> confirm. Renders only; the hook owns the state and
 * the requests. The coral button is the one action on this screen and only
 * appears once there is something to confirm.
 */
export function ImportFlow({ horses }: { horses: readonly HorseOption[] }) {
  const { t } = useTranslation();
  const { phase, file, choose, confirm, reset } = useActivityImport();
  const [choices, setChoices] = useState<ImportChoices>({
    horseId: '',
    trainingType: '',
    environment: '',
    locationName: '',
  });
  const set = (patch: Partial<ImportChoices>): void => setChoices((current) => ({ ...current, ...patch }));
  const maxHr = horses.find((h) => h.id === choices.horseId)?.maxHr ?? null;

  if (phase.kind === 'done') {
    return (
      <Card>
        <CardBody className="space-y-4">
          <p role="status" className="text-[15px] text-text-primary">
            {t(`import.done.${phase.outcome}`)}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/sessions/${phase.sessionId}`}
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-[15px] font-medium text-on-primary hover:bg-primary-hover"
            >
              {t('import.openSession')}
            </Link>
            <Button type="button" variant="secondary" size="md" onClick={reset}>
              {t('import.importAnother')}
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  const preview = phase.kind === 'previewed' || phase.kind === 'committing' ? phase.preview : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <Field label={t('import.fileLabel')} htmlFor="import-file" hint={t('import.fileHint')}>
            <input
              id="import-file"
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
              disabled={phase.kind === 'previewing' || phase.kind === 'committing'}
              className="block min-h-11 w-full text-[14px] text-text-secondary file:mr-3 file:min-h-11 file:rounded-md file:border file:border-line-strong file:bg-transparent file:px-4 file:text-[14px] file:font-medium file:text-text-primary hover:file:bg-surface-muted"
            />
          </Field>
          {phase.kind === 'previewing' ? (
            <p role="status" className="mt-3 flex items-center gap-2 text-[14px] text-text-secondary">
              <FileUp size={16} /> {t('import.reading')}
            </p>
          ) : null}
          {phase.kind === 'error' ? (
            <p role="alert" className="mt-3 rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[14px] text-[var(--pill-warning-text)]">
              {t(`import.error.${phase.code}`)}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {preview !== null ? (
        <Card>
          <CardHeader title={t('import.previewTitle')} subtitle={t('import.previewHint')} />
          <CardBody className="space-y-6">
            <PreviewStats preview={preview} maxHr={maxHr} />

            {preview.warnings.length > 0 ? (
              <div>
                <h3 className="mb-2 text-[13px] font-medium text-text-primary">{t('import.warningsTitle')}</h3>
                <ul className="list-disc space-y-1 pl-5 text-[14px] text-text-secondary">
                  {preview.warnings.map((w) => (
                    <li key={w.code}>{fill(t(`import.warning.${w.code}`), { count: w.count, seconds: w.seconds })}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('import.horseLabel')} htmlFor="import-horse">
                <Select id="import-horse" value={choices.horseId} onChange={(e) => set({ horseId: e.target.value })}>
                  <option value="">{t('import.horsePlaceholder')}</option>
                  {horses.map((horse) => (
                    <option key={horse.id} value={horse.id}>
                      {horse.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('import.trainingTypeLabel')} htmlFor="import-type" hint={t('import.optional')}>
                <Select id="import-type" value={choices.trainingType} onChange={(e) => set({ trainingType: e.target.value })}>
                  <option value="">{t('import.trainingTypeNone')}</option>
                  {TRAINING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`import.trainingType.${type}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('import.environmentLabel')} htmlFor="import-environment" hint={t('import.optional')}>
                <Input id="import-environment" maxLength={120} value={choices.environment} onChange={(e) => set({ environment: e.target.value })} />
              </Field>
              <Field label={t('import.locationLabel')} htmlFor="import-location" hint={t('import.optional')}>
                <Input id="import-location" maxLength={120} value={choices.locationName} onChange={(e) => set({ locationName: e.target.value })} />
              </Field>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="accent"
                size="md"
                disabled={choices.horseId === '' || phase.kind === 'committing' || file === null}
                onClick={() => confirm(choices)}
              >
                {phase.kind === 'committing' ? t('import.importing') : t('import.confirm')}
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={reset} disabled={phase.kind === 'committing'}>
                {t('import.chooseAnother')}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
