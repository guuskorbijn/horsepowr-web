import type { RecurrencePreset } from '@/services/calendar/recurrenceService';
import type { TargetBlock } from '@/services/calendar/trainingTargets';
import type { CalendarEventType } from '@/types/calendar';
import type { TrainingType } from '@/types/db';

/**
 * What the agenda form holds while someone is filling it in.
 *
 * Wall-clock values only — a date, a time and a zone — never a UTC instant.
 * Turning those three into an instant is the one genuinely error-prone step
 * (DST), so it happens once, in `eventFormMapper`, where it is unit-testable
 * rather than scattered through a component.
 *
 * This is the same shape the mobile form uses. It lives in `types/` here
 * rather than next to the component because both the dialog and the mapper
 * need it, and a service importing a type out of a component is backwards.
 */
export interface CalendarEventFormValues {
  type: CalendarEventType;
  title: string;
  /** YYYY-MM-DD in `timeZone`. */
  dayKey: string;
  /** HH:MM in `timeZone`. Ignored when `allDay`. */
  startTime: string;
  /** Whole minutes, or null for an open-ended item. */
  durationMin: number | null;
  allDay: boolean;
  timeZone: string;
  horseId: string | null;
  assigneeId: string | null;
  locationId: string | null;
  notes: string | null;
  recurrencePreset: RecurrencePreset;
  /** Raw rule, kept when the stored pattern is not one of the presets. */
  customRecurrenceRule: string | null;
  /** Which kind of training is planned. Training only. */
  trainingType: TrainingType | null;
  targetHrMinBpm: number | null;
  targetHrMaxBpm: number | null;
  targetDurationMin: number | null;
  /** Round-tripped untouched; there is no block editor on either platform. */
  blocks: TargetBlock[] | null;
}
