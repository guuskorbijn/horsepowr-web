import { formEndToUtc, formStartToUtc, formTargets } from './eventFormMapper';
import type { CalendarEventFormValues } from '@/types/calendarForm';

/**
 * Which database columns an edit actually touched.
 *
 * PURE, and it matters more than its size suggests: the notification policy
 * decides between interrupting someone and letting it wait almost entirely on
 * this list. Report `starts_at` as changed when only the title moved and the
 * assignee's phone lights up for nothing; miss it when the time really did
 * move and they turn up an hour late.
 *
 * Compared in the SAME space the row is written in — UTC instants and the
 * serialised targets payload — rather than in form fields, so re-picking the
 * same time in a different way is not mistaken for a change.
 */
export function changedEventFields(
  before: CalendarEventFormValues,
  after: CalendarEventFormValues,
): string[] {
  const changed: string[] = [];

  const beforeStart = formStartToUtc(before);
  const afterStart = formStartToUtc(after);
  if (beforeStart !== afterStart) changed.push('starts_at');
  if (
    beforeStart !== null &&
    afterStart !== null &&
    formEndToUtc(before, beforeStart) !== formEndToUtc(after, afterStart)
  ) {
    changed.push('ends_at');
  }

  const simple: Array<[keyof CalendarEventFormValues, string]> = [
    ['title', 'title'],
    ['notes', 'notes'],
    ['type', 'type'],
    ['horseId', 'horse_id'],
    ['assigneeId', 'assignee_id'],
    ['locationId', 'location_id'],
    ['allDay', 'all_day'],
    ['timeZone', 'timezone'],
    ['trainingType', 'training_type'],
  ];
  for (const [key, column] of simple) {
    if (before[key] !== after[key]) changed.push(column);
  }

  if (before.recurrencePreset !== after.recurrencePreset) {
    changed.push('recurrence_rule');
  }
  if (JSON.stringify(formTargets(before)) !== JSON.stringify(formTargets(after))) {
    changed.push('targets');
  }

  return changed;
}
