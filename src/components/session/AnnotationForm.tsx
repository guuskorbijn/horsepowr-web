'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Select, Textarea, Toggle, RatingPicker } from '@/components/ui/FormControls';
import { StatusPill } from '@/components/ui/StatusPill';
import { useCan } from '@/components/shell/SessionContext';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import {
  updateSessionAnnotations,
  type SessionAnnotationInput,
} from '@/data/annotationRepository';
import { TRAINING_TYPE_LABELS, ratingLabel } from '@/services/labels';
import type { TrainingType } from '@/types/db';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const TRAINING_TYPES: TrainingType[] = ['dressage', 'cross_country', 'conditioning', 'other'];

export function AnnotationForm({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: SessionAnnotationInput;
}) {
  const canEdit = useCan('canEdit');
  const router = useRouter();
  const [form, setForm] = useState<SessionAnnotationInput>(initial);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial],
  );

  function set<K extends keyof SessionAnnotationInput>(
    key: K,
    value: SessionAnnotationInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setState('idle');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState('saving');
    setError(null);
    try {
      await updateSessionAnnotations(getBrowserSupabase(), sessionId, form);
      setState('saved');
      router.refresh();
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Could not save annotations.');
    }
  }

  if (!canEdit) {
    return <ReadOnlyAnnotations value={initial} />;
  }

  return (
    <Card as="section">
      <CardHeader title="Annotations" subtitle="Notes and structured metadata for this session." />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Training type" htmlFor="training_type">
              <Select
                id="training_type"
                value={form.training_type ?? ''}
                onChange={(e) =>
                  set('training_type', (e.target.value || null) as TrainingType | null)
                }
              >
                <option value="">Not set</option>
                {TRAINING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TRAINING_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Environment" htmlFor="environment" hint="e.g. indoor, wet, windy">
              <Input
                id="environment"
                value={form.environment ?? ''}
                onChange={(e) => set('environment', e.target.value || null)}
                placeholder="Conditions"
              />
            </Field>

            <Field label="Location name" htmlFor="location_name">
              <Input
                id="location_name"
                value={form.location_name ?? ''}
                onChange={(e) => set('location_name', e.target.value || null)}
                placeholder="Where this took place"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Physical condition" htmlFor="physical_rating" hint="Subjective 1–5">
              <RatingPicker
                ariaLabel="Physical condition"
                value={form.physical_rating}
                onChange={(v) => set('physical_rating', v)}
              />
            </Field>
            <Field label="Mental condition" htmlFor="mental_rating" hint="Subjective 1–5">
              <RatingPicker
                ariaLabel="Mental condition"
                value={form.mental_rating}
                onChange={(v) => set('mental_rating', v)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-6">
            <Toggle
              label="Injury concern noted"
              checked={form.injury_concern}
              onChange={(v) => set('injury_concern', v)}
            />
            <Toggle
              label="Injury-recovery work"
              checked={form.injury_recovery}
              onChange={(v) => set('injury_recovery', v)}
            />
          </div>

          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              placeholder="Free-text notes for this session"
            />
          </Field>

          {error ? (
            <p className="rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[13px] text-[var(--pill-warning-text)]">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!dirty || state === 'saving'}>
              {state === 'saving' ? 'Saving…' : state === 'saved' && !dirty ? 'Saved' : 'Save'}
            </Button>
            {state === 'saved' && !dirty ? (
              <span className="text-[13px] text-success">Saved</span>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ReadOnlyAnnotations({ value }: { value: SessionAnnotationInput }) {
  const rows: Array<{ label: string; value: string }> = [
    {
      label: 'Training type',
      value: value.training_type ? TRAINING_TYPE_LABELS[value.training_type] : '—',
    },
    { label: 'Environment', value: value.environment ?? '—' },
    { label: 'Location', value: value.location_name ?? '—' },
    { label: 'Physical condition', value: ratingLabel(value.physical_rating) },
    { label: 'Mental condition', value: ratingLabel(value.mental_rating) },
  ];

  return (
    <Card as="section">
      <CardHeader
        title="Annotations"
        action={
          <StatusPill tone="muted" icon={<Lock size={13} />}>
            Read-only
          </StatusPill>
        }
      />
      <CardBody className="space-y-3">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-4 border-b border-line py-1.5">
              <dt className="text-[13px] text-text-secondary">{r.label}</dt>
              <dd className="text-[13px] font-medium text-text-primary">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2">
          {value.injury_concern ? <StatusPill tone="warning">Injury concern</StatusPill> : null}
          {value.injury_recovery ? <StatusPill tone="info">Injury recovery</StatusPill> : null}
        </div>
        {value.notes ? (
          <p className="whitespace-pre-wrap text-[14px] text-text-primary">{value.notes}</p>
        ) : (
          <p className="text-[14px] text-text-tertiary">No notes for this session.</p>
        )}
      </CardBody>
    </Card>
  );
}
