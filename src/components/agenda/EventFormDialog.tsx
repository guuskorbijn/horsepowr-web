'use client';

import { useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Select, Textarea, Toggle } from '@/components/ui/FormControls';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import {
  createEvent,
  updateEvent,
  upsertOverride,
} from '@/data/calendarRepository';
import {
  formEndToUtc,
  formStartToUtc,
  formTargets,
  formValuesToWriteInput,
} from '@/services/calendar/eventFormMapper';
import { changedEventFields } from '@/services/calendar/changedFields';
import { notifyCalendarChange } from '@/services/notifications/notifyCalendarChange';
import { RECURRENCE_PRESETS } from '@/services/calendar/recurrenceService';
import { KNOWN_TIME_ZONES } from '@/services/time/timezone';
import { useTranslation } from '@/i18n/LocaleProvider';
import { log } from '@/lib/log';
import { TRAINING_TYPE_LABELS } from '@/services/labels';
import { CALENDAR_EVENT_TYPES } from '@/types/calendar';
import { TRAINING_TYPES, type TrainingType } from '@/types/db';
import type { CalendarEventFormValues } from '@/types/calendarForm';
import type { CalendarEventType } from '@/types/calendar';
import type { HorseRow, LocationRow, ProfileRow } from '@/types/db';

/**
 * Create / edit an agenda item, with the same fields the mobile form has.
 *
 * Two things are worth knowing before changing this.
 *
 * It edits WALL-CLOCK values in the event's own zone and never a UTC instant,
 * so an appointment in Mexico City stays at 09:00 Mexico City no matter where
 * it is edited from. `eventFormMapper` does the conversion.
 *
 * When the item is one occurrence of a recurring series, saving asks which
 * scope the change applies to, and there are exactly two: this occurrence, or
 * the whole series. "This and all following" would mean splitting the master
 * into two series with an UNTIL, which doubles what a user has to reason about
 * for a case nobody has asked for. That limit matches mobile.
 */

export type SaveScope = 'series' | 'occurrence';

function parseIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

export function EventFormDialog({
  open,
  onClose,
  initialValues,
  eventId,
  occurrenceStart,
  isSeries,
  orgId,
  userId,
  horses,
  locations,
  assignees,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialValues: CalendarEventFormValues;
  /** Null when creating. */
  eventId: string | null;
  /** The occurrence's ORIGINAL start, when editing one instance of a series. */
  occurrenceStart: string | null;
  isSeries: boolean;
  orgId: string;
  userId: string;
  horses: readonly HorseRow[];
  locations: readonly LocationRow[];
  assignees: readonly ProfileRow[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<CalendarEventFormValues>(initialValues);
  const [scope, setScope] = useState<SaveScope>(
    occurrenceStart !== null ? 'occurrence' : 'series',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CalendarEventFormValues>(
    key: K,
    value: CalendarEventFormValues[K],
  ): void => setValues((prev) => ({ ...prev, [key]: value }));

  const isTraining = values.type === 'training';
  const asksScope = eventId !== null && isSeries && occurrenceStart !== null;

  /**
   * One occurrence only: written as an override keyed by the occurrence's
   * ORIGINAL start, so the master's rule is never rewritten and the rest of
   * the series is untouched. Only the fields an override can carry are sent —
   * type, horse and recurrence belong to the series by definition.
   */
  async function saveOccurrence(id: string, original: string): Promise<void> {
    const startsAt = formStartToUtc(values);
    if (startsAt === null) throw new Error(t('agenda.form.errorInvalidDate'));
    await upsertOverride(getBrowserSupabase(), id, original, {
      cancelled: false,
      starts_at: startsAt,
      ends_at: formEndToUtc(values, startsAt),
      title: values.title.trim(),
      notes: values.notes,
      assignee_id: values.assigneeId,
      status: null,
      targets: formTargets(values),
    });
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // What changed is computed BEFORE the write, against the values the
      // form opened with, because afterwards there is nothing left to compare.
      const changed =
        eventId === null
          ? values.assigneeId !== null
            ? ['assignee_id']
            : []
          : changedEventFields(initialValues, values);

      if (eventId !== null && scope === 'occurrence' && occurrenceStart !== null) {
        await saveOccurrence(eventId, occurrenceStart);
        await notifyCalendarChange({
          eventId,
          changedFields: changed,
          occurrenceStart,
          previousAssigneeId: initialValues.assigneeId,
        });
      } else {
        const input = formValuesToWriteInput(values);
        if (input === null) throw new Error(t('agenda.form.errorInvalidDate'));
        const supa = getBrowserSupabase();
        const saved =
          eventId === null
            ? await createEvent(supa, input, { orgId, userId })
            : await updateEvent(supa, eventId, input);
        await notifyCalendarChange({
          eventId: saved.id,
          changedFields: changed,
          previousAssigneeId: eventId === null ? null : initialValues.assigneeId,
          previousStartsAt: eventId === null ? null : formStartToUtc(initialValues),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      log.error('agenda: save failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : t('agenda.form.errorSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={eventId === null ? t('agenda.form.createTitle') : t('agenda.form.editTitle')}
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('agenda.form.typeLabel')} htmlFor="event-type">
            <Select
              id="event-type"
              value={values.type}
              disabled={scope === 'occurrence'}
              onChange={(e) => set('type', e.target.value as CalendarEventType)}
            >
              {CALENDAR_EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`agenda.type.${type}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('agenda.form.horseLabel')} htmlFor="event-horse">
            <Select
              id="event-horse"
              value={values.horseId ?? ''}
              disabled={scope === 'occurrence'}
              onChange={(e) => set('horseId', e.target.value || null)}
            >
              <option value="">{t('agenda.wholeStable')}</option>
              {horses.map((horse) => (
                <option key={horse.id} value={horse.id}>
                  {horse.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={t('agenda.form.titleLabel')} htmlFor="event-title">
          <Input
            id="event-title"
            required
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={t('agenda.form.titlePlaceholder')}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t('agenda.form.dayLabel')} htmlFor="event-day">
            <Input
              id="event-day"
              type="date"
              required
              value={values.dayKey}
              onChange={(e) => set('dayKey', e.target.value)}
            />
          </Field>
          <Field label={t('agenda.form.startLabel')} htmlFor="event-start">
            <Input
              id="event-start"
              type="time"
              value={values.startTime}
              disabled={values.allDay}
              onChange={(e) => set('startTime', e.target.value)}
            />
          </Field>
          <Field
            label={t('agenda.form.durationLabel')}
            htmlFor="event-duration"
            hint={t('agenda.form.durationHint')}
          >
            <Input
              id="event-duration"
              type="number"
              min={1}
              max={1440}
              value={values.durationMin ?? ''}
              onChange={(e) => set('durationMin', parseIntOrNull(e.target.value))}
            />
          </Field>
        </div>

        <Toggle
          label={t('agenda.form.allDayLabel')}
          checked={values.allDay}
          onChange={(checked) => set('allDay', checked)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t('agenda.form.timeZoneLabel')}
            htmlFor="event-zone"
            hint={t('agenda.form.timeZoneHint')}
          >
            <Select
              id="event-zone"
              value={values.timeZone}
              disabled={scope === 'occurrence'}
              onChange={(e) => set('timeZone', e.target.value)}
            >
              {(KNOWN_TIME_ZONES as readonly string[]).includes(values.timeZone)
                ? null
                : <option value={values.timeZone}>{values.timeZone}</option>}
              {KNOWN_TIME_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('agenda.form.assigneeLabel')} htmlFor="event-assignee">
            <Select
              id="event-assignee"
              value={values.assigneeId ?? ''}
              onChange={(e) => set('assigneeId', e.target.value || null)}
            >
              <option value="">{t('common.unassigned')}</option>
              {assignees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name ?? person.email ?? person.id}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('agenda.form.locationLabel')} htmlFor="event-location">
            <Select
              id="event-location"
              value={values.locationId ?? ''}
              disabled={scope === 'occurrence'}
              onChange={(e) => set('locationId', e.target.value || null)}
            >
              <option value="">{t('common.unassigned')}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('agenda.form.repeatLabel')} htmlFor="event-repeat">
            <Select
              id="event-repeat"
              value={values.recurrencePreset}
              disabled={scope === 'occurrence' || values.recurrencePreset === 'custom'}
              onChange={(e) =>
                set(
                  'recurrencePreset',
                  e.target.value as CalendarEventFormValues['recurrencePreset'],
                )
              }
            >
              {/* A pattern the presets cannot express stays selected and
                  locked, so saving can never silently flatten it. */}
              {values.recurrencePreset === 'custom' ? (
                <option value="custom">{t('agenda.recurrence.custom')}</option>
              ) : null}
              {RECURRENCE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {t(`agenda.recurrence.${preset}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {isTraining ? (
          <div className="space-y-4 rounded-lg border border-line bg-surface-muted p-4">
            <p className="text-[13px] font-medium text-text-primary">
              {t('agenda.form.trainingSection')}
            </p>
            <Field
              label={t('agenda.form.trainingTypeLabel')}
              htmlFor="event-training-type"
            >
              <Select
                id="event-training-type"
                value={values.trainingType ?? ''}
                onChange={(e) =>
                  set('trainingType', (e.target.value || null) as TrainingType | null)
                }
              >
                <option value="">{t('common.unassigned')}</option>
                {TRAINING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TRAINING_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t('agenda.form.targetHrMinLabel')} htmlFor="event-hr-min">
                <Input
                  id="event-hr-min"
                  type="number"
                  min={20}
                  max={300}
                  value={values.targetHrMinBpm ?? ''}
                  onChange={(e) =>
                    set('targetHrMinBpm', parseIntOrNull(e.target.value))
                  }
                />
              </Field>
              <Field label={t('agenda.form.targetHrMaxLabel')} htmlFor="event-hr-max">
                <Input
                  id="event-hr-max"
                  type="number"
                  min={20}
                  max={300}
                  value={values.targetHrMaxBpm ?? ''}
                  onChange={(e) =>
                    set('targetHrMaxBpm', parseIntOrNull(e.target.value))
                  }
                />
              </Field>
              <Field
                label={t('agenda.form.targetDurationLabel')}
                htmlFor="event-target-duration"
              >
                <Input
                  id="event-target-duration"
                  type="number"
                  min={1}
                  max={600}
                  value={values.targetDurationMin ?? ''}
                  onChange={(e) =>
                    set('targetDurationMin', parseIntOrNull(e.target.value))
                  }
                />
              </Field>
            </div>
          </div>
        ) : null}

        <Field label={t('agenda.form.notesLabel')} htmlFor="event-notes">
          <Textarea
            id="event-notes"
            rows={3}
            value={values.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || null)}
          />
        </Field>

        {asksScope ? (
          <fieldset className="space-y-2 rounded-lg border border-line p-4">
            <legend className="px-1 text-[13px] font-medium text-text-primary">
              {t('agenda.scope.title')}
            </legend>
            {(['occurrence', 'series'] as const).map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 text-[14px] text-text-secondary"
              >
                <input
                  type="radio"
                  name="save-scope"
                  value={option}
                  checked={scope === option}
                  onChange={() => setScope(option)}
                />
                {option === 'occurrence'
                  ? t('agenda.scope.thisOccurrence')
                  : t('agenda.scope.allOccurrences')}
              </label>
            ))}
          </fieldset>
        ) : null}

        {error ? (
          <p className="rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[13px] text-[var(--pill-warning-text)]">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={busy || values.title.trim() === ''}>
            {busy ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
