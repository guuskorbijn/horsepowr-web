'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { LoadingState } from '@/components/ui/states';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import {
  getEvent,
  softDeleteEvent,
  updateEvent,
  upsertOverride,
} from '@/data/calendarRepository';
import { notifyCalendarChange } from '@/services/notifications/notifyCalendarChange';
import { ruleToPreset } from '@/services/calendar/recurrenceService';
import { civilDayKey } from '@/services/time/civilDate';
import {
  formatZonedTime,
  utcToZonedCivil,
  zoneShortLabel,
} from '@/services/time/timezone';
import { useTranslation } from '@/i18n/LocaleProvider';
import { log } from '@/lib/log';
import { TRAINING_TYPE_LABELS } from '@/services/labels';
import { asTrainingType } from '@/types/db';
import { cn } from '@/lib/cn';
import type { CalendarEvent, EventOccurrence } from '@/types/calendar';

/**
 * One agenda item, read-only, with the actions that act on it.
 *
 * Read and edit are separate on purpose, the same split the phone makes: the
 * thing you do most often with an agenda item is look at it, and a form is a
 * poor way to read. The actions are also genuinely different in kind —
 * cancelling keeps the item on the agenda struck through, deleting takes it
 * off — and that distinction gets lost at the bottom of a form.
 *
 * "Start session" is absent, and that is the scope wall rather than an
 * omission: capture lives in the mobile app.
 */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="w-32 shrink-0 text-[13px] text-text-secondary">{label}</span>
      <span className="min-w-0 flex-1 text-[14px] text-text-primary">{children}</span>
    </div>
  );
}

export function OccurrenceDetailDialog({
  open,
  onClose,
  occurrence,
  readerTimeZone,
  horseName,
  assigneeName,
  locationName,
  canEdit,
  onEdit,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  occurrence: EventOccurrence;
  readerTimeZone: string;
  horseName: string | null;
  assigneeName: string | null;
  locationName: string | null;
  canEdit: boolean;
  /** Carries the loaded master, so the form never has to re-fetch it. */
  onEdit: (master: CalendarEvent) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The occurrence is a derived view and carries only what the week grid
  // needs. The master holds the rest — the recurrence rule, the planned
  // training type — and the edit form needs it anyway, so it is fetched once
  // here and handed on rather than fetched twice.
  const [master, setMaster] = useState<CalendarEvent | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const eventId = occurrence.event_id;

  // The dialog is mounted only while it is open, so this runs once per item
  // and has nothing to reset on the way in.
  useEffect(() => {
    if (!open) return;
    let cancelledLoad = false;
    void getEvent(getBrowserSupabase(), eventId)
      .then((row) => {
        if (!cancelledLoad) setMaster(row);
      })
      .catch((err: unknown) => {
        if (cancelledLoad) return;
        log.error('agenda: failed to read event', {
          id: eventId,
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadFailed(true);
      });
    return () => {
      cancelledLoad = true;
    };
  }, [open, eventId]);

  const cancelled = occurrence.status === 'cancelled';
  const zoneLabel = zoneShortLabel(occurrence.timezone, readerTimeZone);
  const day = civilDayKey(utcToZonedCivil(occurrence.starts_at, readerTimeZone));
  const when = `${day} · ${
    occurrence.all_day
      ? t('agenda.allDay')
      : formatZonedTime(occurrence.starts_at, readerTimeZone)
  }${zoneLabel !== null ? ` (${zoneLabel})` : ''}`;

  const trainingType = asTrainingType(master?.training_type ?? null);
  const recurrenceLabel = t(
    `agenda.recurrence.${ruleToPreset(master?.recurrence_rule ?? null)}`,
  );
  const targetLine =
    occurrence.targets === null
      ? null
      : [
          occurrence.targets.hrMinBpm != null && occurrence.targets.hrMaxBpm != null
            ? `${occurrence.targets.hrMinBpm}–${occurrence.targets.hrMaxBpm} bpm`
            : null,
          occurrence.targets.durationMin != null
            ? `${occurrence.targets.durationMin} min`
            : null,
        ]
          .filter((part): part is string => part !== null)
          .join(' · ') || null;

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
      onClose();
    } catch (err) {
      log.error('agenda: action failed', {
        key: occurrence.key,
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : t('agenda.form.errorSave'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Cancelling a recurring occurrence writes an override rather than touching
   * the master — calling off next Tuesday must not call off every Tuesday.
   */
  const cancel = (): Promise<void> =>
    run(async () => {
      const supa = getBrowserSupabase();
      if (occurrence.recurring && occurrence.original_start !== null) {
        await upsertOverride(supa, occurrence.event_id, occurrence.original_start, {
          cancelled: true,
          starts_at: null,
          ends_at: null,
          title: null,
          notes: null,
          assignee_id: null,
          status: 'cancelled',
          targets: null,
        });
      } else {
        await updateEvent(supa, occurrence.event_id, { status: 'cancelled' });
      }
      // A cancellation is the one change that can beat quiet hours, because
      // the alternative is someone driving to a stable for nothing.
      await notifyCalendarChange({
        eventId: occurrence.event_id,
        changedFields: ['status'],
        occurrenceStart: occurrence.original_start,
      });
    });

  // Deleting is reported as a status change too: the function maps a
  // tombstone to 'cancelled', because to the person holding the item the
  // difference between called off and removed is academic.
  const remove = (): Promise<void> =>
    run(async () => {
      await softDeleteEvent(getBrowserSupabase(), occurrence.event_id);
      await notifyCalendarChange({
        eventId: occurrence.event_id,
        changedFields: ['status'],
      });
    });

  return (
    <Dialog open={open} onClose={onClose} title={t('agenda.detail.title')}>
      <div className="space-y-4">
        <div className="space-y-2">
          <h3
            className={cn(
              'font-display text-[20px] font-medium text-text-primary',
              cancelled && 'line-through',
            )}
          >
            {occurrence.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="muted">{t(`agenda.type.${occurrence.type}`)}</StatusPill>
            {occurrence.status !== 'planned' ? (
              <StatusPill tone={cancelled ? 'warning' : 'success'}>
                {cancelled ? t('agenda.cancelled') : t('agenda.done')}
              </StatusPill>
            ) : null}
            {occurrence.recurring ? (
              <span className="text-[12px] text-text-tertiary">
                {t('agenda.detail.partOfSeries')}
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <Row label={t('agenda.detail.whenLabel')}>{when}</Row>
          <Row label={t('agenda.detail.horseLabel')}>
            {occurrence.horse_id !== null && horseName !== null ? (
              <Link
                href={`/horses/${occurrence.horse_id}`}
                className="text-primary hover:underline"
              >
                {horseName}
              </Link>
            ) : (
              t('agenda.wholeStable')
            )}
          </Row>
          <Row label={t('agenda.detail.assigneeLabel')}>
            {assigneeName ?? t('common.unassigned')}
          </Row>
          {locationName !== null ? (
            <Row label={t('agenda.detail.locationLabel')}>{locationName}</Row>
          ) : null}
          <Row label={t('agenda.detail.repeatLabel')}>{recurrenceLabel}</Row>
          {targetLine !== null ? (
            <Row label={t('agenda.detail.targetLabel')}>{targetLine}</Row>
          ) : null}
          {trainingType !== null ? (
            <Row label={t('agenda.detail.trainingTypeLabel')}>
              {TRAINING_TYPE_LABELS[trainingType]}
            </Row>
          ) : null}
          {occurrence.notes !== null && occurrence.notes.trim() !== '' ? (
            <Row label={t('agenda.detail.notesLabel')}>
              <span className="whitespace-pre-wrap">{occurrence.notes}</span>
            </Row>
          ) : null}
        </div>

        {loadFailed ? (
          <p className="rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[13px] text-[var(--pill-warning-text)]">
            {t('agenda.detail.loadFailed')}
          </p>
        ) : master === null ? (
          <LoadingState label={t('common.loading')} />
        ) : null}

        {error ? (
          <p className="rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[13px] text-[var(--pill-warning-text)]">
            {error}
          </p>
        ) : null}

        {canEdit ? (
          confirmingDelete ? (
            <div className="space-y-3 rounded-lg border border-line p-4">
              <p className="text-[13px] text-text-primary">
                {occurrence.recurring
                  ? t('agenda.detail.deleteSeriesWarning')
                  : t('agenda.detail.deleteWarning')}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  {t('agenda.detail.deleteConfirm')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmingDelete(true)}
              >
                {t('agenda.detail.delete')}
              </Button>
              {!cancelled ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void cancel()}
                >
                  {t('agenda.detail.cancelEvent')}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={() => master !== null && onEdit(master)}
                disabled={busy || master === null}
              >
                {t('common.edit')}
              </Button>
            </div>
          )
        ) : null}
      </div>
    </Dialog>
  );
}
