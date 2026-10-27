import { describe, expect, it } from 'vitest';
import {
  agendaWindow,
  asAgendaView,
  buildAgenda,
  resolveReaderTimeZone,
  shiftAgenda,
  todayDayKey,
} from '@/services/calendar/agendaService';
import type { CalendarEvent, CalendarEventOverride } from '@/types/calendar';

const AMS = 'Europe/Amsterdam';
const NOW = '2026-10-27T10:00:00.000Z'; // Tue 27 Oct 2026, 11:00 CET

function event(patch: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'evt-1',
    org_id: 'org-1',
    horse_id: 'horse-1',
    type: 'training',
    title: 'Interval work',
    notes: null,
    starts_at: '2026-10-27T07:00:00.000Z',
    ends_at: '2026-10-27T08:00:00.000Z',
    all_day: false,
    timezone: AMS,
    location_id: null,
    assignee_id: 'trainer-1',
    status: 'planned',
    created_by: 'trainer-1',
    targets: null,
    training_type: null,
    recurrence_rule: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    deleted_at: null,
    ...patch,
  };
}

function override(patch: Partial<CalendarEventOverride>): CalendarEventOverride {
  return {
    id: 'ovr-1',
    event_id: 'evt-1',
    original_start: '2026-10-29T07:00:00.000Z',
    cancelled: false,
    starts_at: null,
    ends_at: null,
    title: null,
    notes: null,
    assignee_id: null,
    status: null,
    targets: null,
    created_at: '2026-10-02T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:00.000Z',
    deleted_at: null,
    ...patch,
  };
}

function week(readerTimeZone = AMS) {
  return agendaWindow({ view: 'week', anchorDayKey: '2026-10-28', readerTimeZone, nowIso: NOW });
}

function itemsByDay(agenda: ReturnType<typeof buildAgenda>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const day of agenda.days) {
    if (day.items.length > 0) out[day.dayKey] = day.items.map((i) => i.occurrence.title);
  }
  return out;
}

describe('agendaWindow', () => {
  it('a week runs Monday to Sunday on the reader’s clock, across the DST end', () => {
    const w = agendaWindow({ view: 'week', anchorDayKey: '2026-10-25', readerTimeZone: AMS, nowIso: NOW });
    expect(w.startDayKey).toBe('2026-10-19');
    expect(w.endDayKey).toBe('2026-10-25');
    expect(w.startUtc).toBe('2026-10-18T22:00:00.000Z'); // Mon 00:00 CEST
    expect(w.endUtc).toBe('2026-10-25T23:00:00.000Z'); // next Mon 00:00 CET — a 169-hour week
  });

  it('a day is one reader day, and a malformed anchor falls back to today', () => {
    const w = agendaWindow({ view: 'day', anchorDayKey: 'not-a-day', readerTimeZone: AMS, nowIso: NOW });
    expect(w.startDayKey).toBe('2026-10-27');
    expect(w.endDayKey).toBe('2026-10-27');
    expect(w.dayCount).toBe(1);
    expect(w.startUtc).toBe('2026-10-26T23:00:00.000Z');
    expect(w.endUtc).toBe('2026-10-27T23:00:00.000Z');
  });

  it('shifts by a day or a week, and parses the view leniently', () => {
    expect(shiftAgenda('day', '2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftAgenda('week', '2026-10-26', -1)).toBe('2026-10-19');
    expect(asAgendaView('day')).toBe('day');
    expect(asAgendaView('month')).toBe('week');
    expect(asAgendaView(undefined)).toBe('week');
  });

  it('says when it had to fall back to UTC for the reader zone', () => {
    expect(resolveReaderTimeZone('America/Mexico_City')).toEqual({
      timeZone: 'America/Mexico_City',
      isFallback: false,
    });
    expect(resolveReaderTimeZone('Mars/Olympus')).toEqual({ timeZone: 'UTC', isFallback: true });
    expect(resolveReaderTimeZone(undefined).isFallback).toBe(true);
  });

  it('today is the reader’s today, not the server’s', () => {
    // 23:30 UTC on the 27th is already the 28th in Shanghai.
    expect(todayDayKey('2026-10-27T23:30:00.000Z', 'Asia/Shanghai')).toBe('2026-10-28');
    expect(todayDayKey('2026-10-27T23:30:00.000Z', AMS)).toBe('2026-10-28');
    expect(todayDayKey('2026-10-27T22:30:00.000Z', AMS)).toBe('2026-10-27');
  });
});

describe('buildAgenda', () => {
  it('recurring + override + cancellation: moved, renamed and struck-through occurrences', () => {
    const series = event({
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU,TH',
      starts_at: '2026-10-20T06:00:00.000Z', // Tue 08:00 CEST
      ends_at: '2026-10-20T07:00:00.000Z',
    });
    const agenda = buildAgenda({
      window: week(),
      events: [series],
      overrides: [
        // Thu 29 Oct cancelled.
        override({ cancelled: true }),
        // Tue 27 Oct moved to Wed 28 Oct 10:00 CET and renamed.
        override({
          id: 'ovr-2',
          original_start: '2026-10-27T07:00:00.000Z',
          starts_at: '2026-10-28T09:00:00.000Z',
          title: 'Hill work',
        }),
      ],
      todayKey: '2026-10-27',
    });

    expect(itemsByDay(agenda)).toEqual({
      '2026-10-28': ['Hill work'],
      '2026-10-29': ['Interval work'],
    });
    const thursday = agenda.days.find((d) => d.dayKey === '2026-10-29')?.items[0];
    expect(thursday?.cancelled).toBe(true);
    const moved = agenda.days.find((d) => d.dayKey === '2026-10-28')?.items[0];
    expect(moved?.readerTime).toBe('10:00');
    expect(moved?.occurrence.ends_at).toBe('2026-10-28T10:00:00.000Z'); // duration kept
    expect(agenda.isEmpty).toBe(false);
  });

  it('keeps 08:00 local on both sides of the DST end', () => {
    const daily = event({
      recurrence_rule: 'FREQ=DAILY',
      starts_at: '2026-10-24T06:00:00.000Z',
      ends_at: null,
    });
    const agenda = buildAgenda({
      window: agendaWindow({ view: 'week', anchorDayKey: '2026-10-21', readerTimeZone: AMS, nowIso: NOW }),
      events: [daily],
      overrides: [],
      todayKey: '2026-10-27',
    });
    const times = agenda.days.flatMap((d) => d.items.map((i) => `${d.dayKey} ${i.readerTime}`));
    expect(times).toEqual(['2026-10-24 08:00', '2026-10-25 08:00']);
  });

  it('a horse-less farrier visit shows on a horse’s agenda, labelled as stable-wide', () => {
    const farrier = event({ id: 'evt-f', horse_id: null, type: 'farrier', title: 'Farrier' });
    const otherHorse = event({ id: 'evt-o', horse_id: 'horse-2', title: 'Other horse' });
    const agenda = buildAgenda({
      window: week(),
      events: [farrier, otherHorse, event({})],
      overrides: [],
      filters: { horseId: 'horse-1' },
      todayKey: '2026-10-27',
    });
    expect(itemsByDay(agenda)).toEqual({ '2026-10-27': ['Farrier', 'Interval work'] });
    expect(agenda.days.find((d) => d.isToday)?.dayKey).toBe('2026-10-27');
  });

  it('all-day items sort first and carry no time', () => {
    const allDay = event({
      id: 'evt-a',
      type: 'competition',
      title: 'Show',
      all_day: true,
      starts_at: '2026-10-26T23:00:00.000Z', // Tue 00:00 CET
      ends_at: null,
    });
    const agenda = buildAgenda({ window: week(), events: [event({}), allDay], overrides: [], todayKey: '2026-10-27' });
    const tuesday = agenda.days.find((d) => d.dayKey === '2026-10-27');
    expect(tuesday?.items.map((i) => i.occurrence.title)).toEqual(['Show', 'Interval work']);
    expect(tuesday?.items[0]?.readerTime).toBeNull();
  });

  it('the assignee filter keeps only that person’s items', () => {
    const vet = event({ id: 'evt-v', type: 'vet', title: 'Vaccination', assignee_id: 'vet-1' });
    const agenda = buildAgenda({
      window: week(),
      events: [event({}), vet],
      overrides: [],
      filters: { assigneeId: 'vet-1' },
      todayKey: '2026-10-27',
    });
    expect(itemsByDay(agenda)).toEqual({ '2026-10-27': ['Vaccination'] });
  });

  it('shows the event’s own clock next to the reader’s when the zones differ', () => {
    const mexico = event({
      id: 'evt-mx',
      title: 'Vet visit Mexico',
      timezone: 'America/Mexico_City',
      starts_at: '2026-10-27T15:00:00.000Z', // 09:00 in Mexico City, 16:00 CET
    });
    const agenda = buildAgenda({ window: week(), events: [mexico], overrides: [], todayKey: '2026-10-27' });
    const item = agenda.days.find((d) => d.dayKey === '2026-10-27')?.items[0];
    expect(item?.readerTime).toBe('16:00');
    expect(item?.eventLocalTime).toBe('09:00');
    expect(item?.eventZoneLabel).toBe('Mexico City');
  });

  it('summarises a training target with the Z labels its HR range spans', () => {
    const planned = event({ targets: { version: 1, hrMinBpm: 150, hrMaxBpm: 180, durationMin: 45 } });
    const agenda = buildAgenda({
      window: week(),
      events: [planned],
      overrides: [],
      maxHrByHorse: { 'horse-1': 220 },
      todayKey: '2026-10-27',
    });
    const target = agenda.days.find((d) => d.dayKey === '2026-10-27')?.items[0]?.target;
    // 220 max: Z2 132–154, Z3 154–176, Z4 176–198.
    expect(target).toEqual({ hrMinBpm: 150, hrMaxBpm: 180, durationMin: 45, zones: ['z2', 'z3', 'z4'], blockCount: 0 });
  });

  it('an empty week is empty', () => {
    const agenda = buildAgenda({ window: week(), events: [], overrides: [], todayKey: '2026-10-27' });
    expect(agenda.isEmpty).toBe(true);
    expect(agenda.days).toHaveLength(7);
  });

  it('an unparseable rule is reported, and the item still shows once at its anchor', () => {
    const broken = event({ recurrence_rule: 'FREQ=HOURLY' });
    const agenda = buildAgenda({ window: week(), events: [broken], overrides: [], todayKey: '2026-10-27' });
    expect(agenda.unparseableRuleEventIds).toEqual(['evt-1']);
    expect(itemsByDay(agenda)).toEqual({ '2026-10-27': ['Interval work'] });
  });
});

describe('target formatting', () => {
  it('prints a zone span and an HR range, one-sided ranges included', async () => {
    const { formatZoneSpan, formatHrRange } = await import('@/services/calendar/agendaService');
    expect(formatZoneSpan(['z3'])).toBe('Z3');
    expect(formatZoneSpan(['z2', 'z3', 'z4'])).toBe('Z2–Z4');
    expect(formatZoneSpan([])).toBe('');
    expect(formatHrRange(150, 170)).toBe('150–170 bpm');
    expect(formatHrRange(150, null)).toBe('≥ 150 bpm');
    expect(formatHrRange(null, 170)).toBe('≤ 170 bpm');
    expect(formatHrRange(null, null)).toBeNull();
  });
});
