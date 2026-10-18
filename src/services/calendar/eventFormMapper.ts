import {
  presetToRule,
  ruleToPreset,
  type RecurrencePreset,
} from '@/services/calendar/recurrenceService';
import {
  TARGETS_VERSION,
  type TrainingTargets,
} from '@/services/calendar/trainingTargets';
import { civilDayKey, parseCivilDayKey } from '@/services/time/civilDate';
import { utcToZonedCivil, zonedCivilToUtcIso } from '@/services/time/timezone';
import { asTrainingType } from '@/types/db';
import type { EventWriteInput } from '@/data/calendarRepository';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar';
import type { CalendarEventFormValues } from '@/types/calendarForm';

/**
 * Translates between the form's wall-clock values and the repository's UTC
 * instants.
 *
 * PURE, and in the service layer rather than in a component, because this is
 * where the one genuinely error-prone step lives: a local date plus a local
 * time plus a zone becoming a UTC instant.
 *
 * A near-twin of the mobile file of the same name, and deliberately NOT in the
 * mirror set: the two differ in the one place that matters — mobile builds a
 * `CreateEventInput` for its offline service, this builds the snake_case row
 * the web repository writes online. Pretending they are the same file would
 * mean a check that can never pass. The LOGIC they share — DST conversion,
 * recurrence presets, the targets payload — is identical on purpose and should
 * be changed in both.
 */

function splitTime(time: string): { hour: number; minute: number } {
  const [hourPart, minutePart] = time.split(':');
  const hour = Number.parseInt(hourPart ?? '0', 10);
  const minute = Number.parseInt(minutePart ?? '0', 10);
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

/** The UTC instant a form's day + time + zone describes. */
export function formStartToUtc(values: CalendarEventFormValues): string | null {
  const civilDay = parseCivilDayKey(values.dayKey);
  if (!civilDay) return null;
  const { hour, minute } = values.allDay
    ? { hour: 0, minute: 0 }
    : splitTime(values.startTime);
  return zonedCivilToUtcIso(
    { ...civilDay, hour, minute, second: 0 },
    values.timeZone,
  );
}

/** The UTC instant the item ends at, or null when it is open-ended. */
export function formEndToUtc(
  values: CalendarEventFormValues,
  startUtc: string,
): string | null {
  if (values.durationMin === null || values.durationMin <= 0) return null;
  return new Date(
    Date.parse(startUtc) + values.durationMin * 60_000,
  ).toISOString();
}

/**
 * Builds the targets payload, or null.
 *
 * `blocks` is carried through untouched: a plan with interval structure keeps
 * it even though neither form can edit one. Dropping it on save would be
 * silent data loss.
 */
export function formTargets(
  values: CalendarEventFormValues,
): TrainingTargets | null {
  if (values.type !== 'training') return null;
  const hasRange =
    values.targetHrMinBpm !== null || values.targetHrMaxBpm !== null;
  const hasDuration = values.targetDurationMin !== null;
  const hasBlocks = values.blocks !== null && values.blocks.length > 0;
  if (!hasRange && !hasDuration && !hasBlocks) return null;

  const targets: TrainingTargets = { version: TARGETS_VERSION };
  if (values.targetHrMinBpm !== null) targets.hrMinBpm = values.targetHrMinBpm;
  if (values.targetHrMaxBpm !== null) targets.hrMaxBpm = values.targetHrMaxBpm;
  if (values.targetDurationMin !== null) {
    targets.durationMin = values.targetDurationMin;
  }
  if (hasBlocks && values.blocks) targets.blocks = values.blocks;
  return targets;
}

function formRecurrenceRule(values: CalendarEventFormValues): string | null {
  // 'custom' means "leave the stored pattern alone" — the form cannot express
  // it, so it must not be allowed to overwrite it either.
  if (values.recurrencePreset === 'custom') return values.customRecurrenceRule;
  return presetToRule(values.recurrencePreset);
}

/** Form values as a writable event row, or null when the date cannot be read. */
export function formValuesToWriteInput(
  values: CalendarEventFormValues,
): EventWriteInput | null {
  const startsAt = formStartToUtc(values);
  if (startsAt === null) return null;
  return {
    type: values.type,
    title: values.title.trim(),
    notes: values.notes,
    starts_at: startsAt,
    ends_at: formEndToUtc(values, startsAt),
    all_day: values.allDay,
    timezone: values.timeZone,
    horse_id: values.horseId,
    location_id: values.locationId,
    assignee_id: values.assigneeId,
    targets: formTargets(values),
    training_type: values.type === 'training' ? values.trainingType : null,
    recurrence_rule: formRecurrenceRule(values),
  };
}

/** Blank form, pre-filled with the day the user was looking at. */
export function emptyFormValues(
  defaults: { dayKey: string; timeZone: string; horseId?: string | null },
  type: CalendarEventType = 'training',
): CalendarEventFormValues {
  return {
    type,
    title: '',
    dayKey: defaults.dayKey,
    startTime: '09:00',
    durationMin: 45,
    allDay: false,
    timeZone: defaults.timeZone,
    horseId: defaults.horseId ?? null,
    assigneeId: null,
    locationId: null,
    notes: null,
    recurrencePreset: 'none',
    customRecurrenceRule: null,
    trainingType: null,
    targetHrMinBpm: null,
    targetHrMaxBpm: null,
    targetDurationMin: null,
    blocks: null,
  };
}

/**
 * An existing event as form values.
 *
 * Rendered in the EVENT's own zone, not the reader's: editing a Mexico
 * appointment from Breda has to show and write back Mexico's wall clock, or
 * every edit would quietly shift the appointment by the offset between them.
 */
export function eventToFormValues(
  event: CalendarEvent,
): CalendarEventFormValues {
  const civil = utcToZonedCivil(event.starts_at, event.timezone);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  const durationMin =
    event.ends_at === null
      ? null
      : Math.round(
          (Date.parse(event.ends_at) - Date.parse(event.starts_at)) / 60_000,
        );
  const preset: RecurrencePreset = ruleToPreset(event.recurrence_rule);

  return {
    type: event.type,
    title: event.title,
    dayKey: civilDayKey(civil),
    startTime: `${p2(civil.hour)}:${p2(civil.minute)}`,
    durationMin,
    allDay: event.all_day,
    timeZone: event.timezone,
    horseId: event.horse_id,
    assigneeId: event.assignee_id,
    locationId: event.location_id,
    notes: event.notes,
    recurrencePreset: preset,
    customRecurrenceRule: preset === 'custom' ? event.recurrence_rule : null,
    trainingType: asTrainingType(event.training_type),
    targetHrMinBpm: event.targets?.hrMinBpm ?? null,
    targetHrMaxBpm: event.targets?.hrMaxBpm ?? null,
    targetDurationMin: event.targets?.durationMin ?? null,
    blocks: event.targets?.blocks ?? null,
  };
}
