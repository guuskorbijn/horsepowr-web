/**
 * Turning a Realtime row change into one human sentence.
 *
 * PURE: the name lookup and translator are passed in, so the wording is
 * testable without a socket. Returns null for changes not worth a toast
 * (a measurement-less session insert from a sync, a status-only bookkeeping
 * write) — those still refresh the page, silently.
 */

export type LiveTable =
  | 'calendar_events'
  | 'calendar_event_overrides'
  | 'sessions'
  | 'polar_inbox'
  | 'horse_health_records'
  | 'event_checklist_items';

export interface LiveChangeInput {
  table: LiveTable;
  kind: 'INSERT' | 'UPDATE' | 'DELETE';
  row: Record<string, unknown>;
}

export interface LiveChange extends LiveChangeInput {
  /** The row's own id, or for an override the event it belongs to. */
  entityId: string | null;
  actorId: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Adds entityId/actorId; called by the provider before `describeLiveChange`. */
export function toLiveChange(input: LiveChangeInput): LiveChange {
  const row = input.row;
  const entityId = input.table === 'calendar_event_overrides' ? str(row.event_id) : str(row.id);
  const actorId = str(row.updated_by) ?? str(row.created_by) ?? str(row.user_id);
  return { ...input, entityId, actorId };
}

export function describeLiveChange(
  change: LiveChange,
  nameOf: (id: string | null) => string | null,
  t: (key: string) => string,
): string | null {
  const who = nameOf(change.actorId) ?? t('live.someone');
  const title = str(change.row.title);
  const fill = (key: string): string =>
    t(key).replace('{who}', who).replace('{title}', title ?? t('live.anItem'));

  switch (change.table) {
    case 'calendar_events':
      if (change.row.deleted_at) return fill('live.eventRemoved');
      return fill(change.kind === 'INSERT' ? 'live.eventAdded' : 'live.eventChanged');
    case 'calendar_event_overrides':
      return fill(change.row.cancelled === true ? 'live.occurrenceCancelled' : 'live.occurrenceChanged');
    case 'sessions':
      return change.kind === 'INSERT' ? t('live.sessionAdded') : null;
    case 'polar_inbox':
      return change.kind === 'INSERT' ? t('live.polarArrived') : null;
    case 'horse_health_records':
      return change.kind === 'INSERT' ? fill('live.healthAdded') : null;
    case 'event_checklist_items':
      return change.row.done === true ? t('live.checklistTicked').replace('{who}', who).replace('{label}', str(change.row.label) ?? '') : null;
  }
}
