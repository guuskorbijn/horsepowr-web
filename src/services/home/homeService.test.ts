import { describe, expect, it } from 'vitest';
import { buildHomeOverview } from './homeService';
import type { Agenda, AgendaItem } from '@/services/calendar/agendaService';

function item(over: { key: string; horse?: string | null; assignee?: string | null; type?: string; done?: boolean; cancelled?: boolean }): AgendaItem {
  return {
    occurrence: {
      key: over.key, event_id: over.key, horse_id: over.horse ?? null, assignee_id: over.assignee ?? null,
      type: (over.type ?? 'training') as AgendaItem['occurrence']['type'], title: over.key,
    } as AgendaItem['occurrence'],
    readerTime: '09:00', eventLocalTime: null, eventZoneLabel: null,
    cancelled: over.cancelled ?? false, done: over.done ?? false, target: null,
  };
}

const agenda = {
  window: {} as Agenda['window'],
  days: [
    { dayKey: '2026-11-30', isToday: true, items: [
      item({ key: 'a', horse: 'h1', assignee: 'me', done: true }),
      item({ key: 'b', horse: 'h2', assignee: 'tim' }),
      item({ key: 'c', horse: 'h1', assignee: 'me', cancelled: true }),
    ] },
    { dayKey: '2026-12-01', isToday: false, items: [item({ key: 'd', horse: 'h2', assignee: 'me', type: 'farrier' }), item({ key: 'e', horse: null })] },
  ],
  isEmpty: false, truncatedEventIds: [], unparseableRuleEventIds: [],
} as Agenda;

describe('buildHomeOverview', () => {
  const o = buildHomeOverview({ agenda, userId: 'me', horses: [{ id: 'h1', name: 'Luna' }, { id: 'h2', name: 'Bella' }] });

  it('counts today without cancelled items', () => {
    expect(o.counts).toMatchObject({ today: 2, doneToday: 1, weekTrainings: 3, weekItems: 4, openAssignedToMe: 1 });
  });

  it('lists my day and a per-horse week grid sorted by name', () => {
    expect(o.myToday.map((i) => i.occurrence.key)).toEqual(['a']);
    expect(o.rows.map((r) => r.name)).toEqual(['Bella', 'Luna']);
    expect(o.rows[0]?.cells[1]?.kinds).toEqual([{ type: 'farrier', done: false, cancelled: false }]);
    expect(o.stableWide).toHaveLength(1);
  });
});
