'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Field } from '@/components/ui/Input';
import { Select, Textarea, Toggle } from '@/components/ui/FormControls';
import { StatusPill } from '@/components/ui/StatusPill';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import {
  createHealthRecord,
  softDeleteHealthRecord,
  updateHealthRecord,
  type HealthRecordInput,
} from '@/data/healthRecordRepository';
import { createEvent } from '@/data/calendarRepository';
import { useTranslation } from '@/i18n/LocaleProvider';
import { formatCalendarDate } from '@/services/format';
import { expiringRecords } from '@/services/health/healthReminders';
import { reminderEventInput, REMINDER_LEAD_DAYS } from '@/services/health/healthReminderEvent';
import { HEALTH_RECORD_KINDS, type HealthRecordKind, type HealthRecordRow } from '@/types/db';
import { log } from '@/lib/log';

/**
 * Health notes for one horse: what the stable wants to remember, written by
 * the stable and shown exactly as written. A vaccination can carry an expiry;
 * when it is close, the record is marked here, on the dashboard and on the
 * phone — dates only, never advice.
 */

interface Draft {
  kind: HealthRecordKind;
  occurredOn: string;
  title: string;
  body: string;
  validUntil: string;
  addReminder: boolean;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toDraft(r: HealthRecordRow | null): Draft {
  return r === null
    ? { kind: 'vaccination', occurredOn: todayKey(), title: '', body: '', validUntil: '', addReminder: true }
    : {
        kind: r.kind,
        occurredOn: r.occurred_on,
        title: r.title,
        body: r.body ?? '',
        validUntil: r.valid_until ?? '',
        addReminder: false,
      };
}

export function HorseHealthCard({
  horseId,
  horseName,
  orgId,
  userId,
  canEdit,
  records,
}: {
  horseId: string;
  horseName: string;
  orgId: string;
  userId: string;
  canEdit: boolean;
  records: readonly HealthRecordRow[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [editing, setEditing] = useState<HealthRecordRow | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reminders = new Map(expiringRecords(records, todayKey()).map((r) => [r.recordId, r]));

  const open = (record: HealthRecordRow | null): void => {
    setDraft(toDraft(record));
    setError(null);
    setEditing(record ?? 'new');
  };

  const rangeInvalid = draft.validUntil !== '' && draft.validUntil < draft.occurredOn;
  const invalid = draft.title.trim() === '' || draft.occurredOn === '' || rangeInvalid;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (invalid || editing === null) return;
    setBusy(true);
    setError(null);
    const input: HealthRecordInput = {
      kind: draft.kind,
      occurred_on: draft.occurredOn,
      title: draft.title.trim(),
      body: draft.body.trim() === '' ? null : draft.body.trim(),
      valid_until: draft.validUntil === '' ? null : draft.validUntil,
    };
    try {
      const supa = getBrowserSupabase();
      if (editing === 'new') await createHealthRecord(supa, { orgId, userId, horseId }, input);
      else await updateHealthRecord(supa, editing.id, input);
      // The reminder goes through the agenda, so assignment, push and the
      // phone's offline copy all work for it without a second mechanism.
      if (draft.addReminder && input.valid_until !== null) {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await createEvent(
          supa,
          reminderEventInput({
            horseId,
            horseName,
            title: input.title,
            validUntil: input.valid_until,
            timeZone: zone,
            titleTemplate: t('health.reminderEventTitle'),
          }),
          { orgId, userId },
        );
      }
      setEditing(null);
      router.refresh();
    } catch (err) {
      log.error('health: save failed', { error: err instanceof Error ? err.message : String(err) });
      setError(t('health.errorSave'));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(): Promise<void> {
    if (editing === null || editing === 'new') return;
    setBusy(true);
    try {
      await softDeleteHealthRecord(getBrowserSupabase(), editing.id);
      setEditing(null);
      router.refresh();
    } catch (err) {
      log.error('health: delete failed', { error: err instanceof Error ? err.message : String(err) });
      setError(t('health.errorSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('health.title')}
        subtitle={t('health.subtitle')}
        action={
          canEdit ? (
            <Button size="sm" variant="secondary" onClick={() => open(null)}>
              <Plus size={14} /> {t('health.add')}
            </Button>
          ) : undefined
        }
      />
      <CardBody>
        {records.length === 0 ? (
          <p className="text-[14px] text-text-secondary">{t('health.empty')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {records.map((record) => {
              const reminder = reminders.get(record.id);
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => open(record)}
                    className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-left enabled:hover:bg-surface-muted"
                  >
                    <span className="w-24 shrink-0 text-[12px] tabular-nums text-text-tertiary">
                      {formatCalendarDate(record.occurred_on)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-text-primary">{record.title}</span>
                      <span className="block text-[12px] text-text-secondary">
                        {t(`health.kind.${record.kind}`)}
                        {record.valid_until !== null
                          ? ` · ${t('health.validUntil')} ${formatCalendarDate(record.valid_until)}`
                          : ''}
                      </span>
                      {record.body !== null ? (
                        <span className="mt-0.5 block whitespace-pre-line text-[13px] text-text-secondary">
                          {record.body}
                        </span>
                      ) : null}
                    </span>
                    {reminder !== undefined ? (
                      <StatusPill tone="warning">
                        {reminder.state === 'expired'
                          ? t('health.expired')
                          : t('health.expiresIn').replace('{days}', String(reminder.daysLeft))}
                      </StatusPill>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('health.addTitle') : t('health.editTitle')}
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('health.kindLabel')} htmlFor="health-kind">
              <Select
                id="health-kind"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as HealthRecordKind })}
              >
                {HEALTH_RECORD_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`health.kind.${kind}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('health.dateLabel')} htmlFor="health-date">
              <Input
                id="health-date"
                type="date"
                value={draft.occurredOn}
                onChange={(e) => setDraft({ ...draft, occurredOn: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t('health.titleLabel')} htmlFor="health-title">
            <Input
              id="health-title"
              placeholder={t('health.titlePlaceholder')}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>
          <Field label={t('health.bodyLabel')} htmlFor="health-body">
            <Textarea
              id="health-body"
              rows={3}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </Field>
          <Field
            label={t('health.validUntilLabel')}
            htmlFor="health-valid"
            hint={rangeInvalid ? t('health.errorRange') : t('health.validUntilHint')}
          >
            <Input
              id="health-valid"
              type="date"
              value={draft.validUntil}
              onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })}
            />
          </Field>
          {draft.validUntil !== '' ? (
            <Toggle
              checked={draft.addReminder}
              onChange={(addReminder) => setDraft({ ...draft, addReminder })}
              label={t('health.addReminder').replace('{days}', String(REMINDER_LEAD_DAYS))}
            />
          ) : null}
          {error !== null ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}
          <div className="flex items-center justify-between gap-2 pt-1">
            {editing !== null && editing !== 'new' ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => void onDelete()} disabled={busy}>
                {t('health.delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={busy || invalid}>
                {busy ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
