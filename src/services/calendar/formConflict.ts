import { changedEventFields } from './changedFields';
import type { CalendarEventFormValues } from '@/types/calendarForm';

/**
 * Three-way merge at the level of the edit dialog.
 *
 * PURE. The dialog opened on `base`; the user turned it into `mine`; the
 * server meanwhile holds `theirs`. The same rule the phone applies per column
 * (see the mirrored `conflictResolution`), expressed over form values because
 * that is what the dialog holds:
 *
 *  - a column only I changed  -> mine is written
 *  - a column only they changed -> theirs is kept (and NOT overwritten, which
 *    a whole-row save used to do)
 *  - a column we both changed to different values -> CONFLICT: nothing is
 *    written; the dialog shows their value and says so, and the user decides.
 */

export interface FormMerge {
  /** Columns to write: changed by me, not in conflict. */
  write: string[];
  /** Columns both sides changed differently. */
  conflicts: string[];
  /** What the dialog should show now: theirs, with my non-conflicting edits. */
  merged: CalendarEventFormValues;
}

/** Which form keys carry each column. */
const COLUMN_KEYS: Record<string, readonly (keyof CalendarEventFormValues)[]> = {
  starts_at: ['dayKey', 'startTime', 'allDay', 'timeZone'],
  ends_at: ['durationMin'],
  title: ['title'],
  notes: ['notes'],
  type: ['type'],
  horse_id: ['horseId'],
  assignee_id: ['assigneeId'],
  location_id: ['locationId'],
  all_day: ['allDay'],
  timezone: ['timeZone'],
  training_type: ['trainingType'],
  recurrence_rule: ['recurrencePreset', 'customRecurrenceRule', 'recurrenceInterval'],
  targets: ['targetHrMinBpm', 'targetHrMaxBpm', 'targetDurationMin', 'blocks'],
};

export function mergeFormEdits(
  base: CalendarEventFormValues,
  mine: CalendarEventFormValues,
  theirs: CalendarEventFormValues,
): FormMerge {
  const myChanges = changedEventFields(base, mine);
  const theirChanges = new Set(changedEventFields(base, theirs));
  const disagreements = new Set(changedEventFields(theirs, mine));

  const write: string[] = [];
  const conflicts: string[] = [];
  for (const column of myChanges) {
    if (!theirChanges.has(column)) write.push(column);
    else if (disagreements.has(column)) conflicts.push(column);
    // else: they made the same change — nothing to write, nothing to report.
  }

  const merged: CalendarEventFormValues = { ...theirs };
  const assign = <K extends keyof CalendarEventFormValues>(key: K): void => {
    merged[key] = mine[key];
  };
  for (const column of write) {
    for (const key of COLUMN_KEYS[column] ?? []) assign(key);
  }
  return { write, conflicts, merged };
}
