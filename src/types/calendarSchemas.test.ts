import { describe, expect, it } from 'vitest';
import { parseCalendarEventOverrideRow, parseCalendarEventRow } from '@/types/calendarSchemas';

const validEvent = {
  id: '6f1c1b1e-0000-4000-8000-000000000001',
  org_id: 'org-1',
  horse_id: null,
  type: 'farrier',
  title: 'Farrier visit',
  notes: null,
  starts_at: '2026-10-27T07:00:00+00:00',
  ends_at: null,
  all_day: false,
  timezone: 'Europe/Amsterdam',
  location_id: null,
  assignee_id: null,
  status: 'planned',
  created_by: 'user-1',
  targets: null,
  recurrence_rule: 'FREQ=WEEKLY;INTERVAL=6',
  created_at: '2026-10-01T00:00:00+00:00',
  updated_at: '2026-10-01T00:00:00+00:00',
  deleted_at: null,
};

describe('calendar row schemas', () => {
  it('accepts a row exactly as PostgREST returns it, with training_type absent', () => {
    const result = parseCalendarEventRow(validEvent);
    expect(result.ok).toBe(true);
  });

  it('keeps a malformed targets payload for the lenient targets parser to handle', () => {
    const result = parseCalendarEventRow({ ...validEvent, type: 'training', targets: { nope: 1 } });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown event type and names the column', () => {
    const result = parseCalendarEventRow({ ...validEvent, type: 'party' });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('type') });
  });

  it('rejects an unparseable timestamp', () => {
    const result = parseCalendarEventRow({ ...validEvent, starts_at: 'tomorrow' });
    expect(result.ok).toBe(false);
  });

  it('rejects a row missing a NOT NULL column', () => {
    const { timezone: _dropped, ...withoutZone } = validEvent;
    void _dropped;
    expect(parseCalendarEventRow(withoutZone).ok).toBe(false);
  });

  it('validates an override row, including a null status meaning "inherit"', () => {
    const result = parseCalendarEventOverrideRow({
      id: 'ovr-1',
      event_id: validEvent.id,
      original_start: '2026-10-27T07:00:00+00:00',
      cancelled: true,
      starts_at: null,
      ends_at: null,
      title: null,
      notes: null,
      assignee_id: null,
      status: null,
      targets: null,
      created_at: '2026-10-01T00:00:00+00:00',
      updated_at: '2026-10-01T00:00:00+00:00',
      deleted_at: null,
    });
    expect(result.ok).toBe(true);
  });
});
