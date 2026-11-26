import { describe, expect, it } from 'vitest';
import { layoutTimeGrid, snapMinutes } from './timeGridLayout';
import type { AgendaDay, AgendaItem } from './agendaService';

const item = (key: string, time: string | null, minutes = 60, allDay = false): AgendaItem => {
  const start = `2026-12-01T${time ?? '00:00'}:00.000Z`;
  return {
    occurrence: {
      key, all_day: allDay, starts_at: start,
      ends_at: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    } as AgendaItem['occurrence'],
    readerTime: time, eventLocalTime: null, eventZoneLabel: null, cancelled: false, done: false, target: null,
  };
};

describe('layoutTimeGrid', () => {
  const day: AgendaDay = {
    dayKey: '2026-12-01', isToday: true,
    items: [item('a', '09:00'), item('b', '09:30'), item('c', '11:00'), item('d', null, 0, true), item('e', '05:30', 30)],
  };
  const grid = layoutTimeGrid([day]);
  it('puts overlapping items in lanes and separates all-day items', () => {
    const lanes = Object.fromEntries(grid.days[0]!.placed.map((p) => [p.item.occurrence.key, [p.lane, p.lanes]]));
    expect(lanes).toEqual({ e: [0, 1], a: [0, 2], b: [1, 2], c: [0, 1] });
    expect(grid.days[0]!.allDay.map((i) => i.occurrence.key)).toEqual(['d']);
  });
  it('extends the visible hours to fit early items', () => {
    expect(grid.fromHour).toBe(5);
  });
});

describe('snapMinutes', () => {
  it('snaps to quarter hours from the grid start', () => {
    expect(snapMinutes(64 * 2 + 20, 64, 6)).toBe(8 * 60 + 15);
    expect(snapMinutes(-50, 64, 6)).toBe(5 * 60 + 15);
  });
});
