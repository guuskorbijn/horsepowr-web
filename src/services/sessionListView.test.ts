import { describe, expect, it } from 'vitest';
import { filterSessions, NO_FILTERS, sortSessions } from './sessionListView';
import type { SessionWithHorse } from '@/types/view';

const s = (id: string, horse: string, start: string, minutes: number, type: string | null = null): SessionWithHorse => ({
  session: { id, started_at: start, ended_at: new Date(Date.parse(start) + minutes * 60_000).toISOString(), training_type: type } as SessionWithHorse['session'],
  horse: { id: horse, name: horse, location_id: null } as SessionWithHorse['horse'],
});

const list = [s('1', 'Luna', '2026-11-20T08:00:00Z', 30), s('2', 'Bella', '2026-11-25T08:00:00Z', 60, 'dressage'), s('3', 'Bella', '2026-11-10T08:00:00Z', 90)];

describe('session list view', () => {
  it('sorts by date, length and horse', () => {
    expect(sortSessions(list, 'newest').map((x) => x.session.id)).toEqual(['2', '1', '3']);
    expect(sortSessions(list, 'longest').map((x) => x.session.id)).toEqual(['3', '2', '1']);
    expect(sortSessions(list, 'horse').map((x) => x.session.id)).toEqual(['2', '3', '1']);
  });
  it('filters by horse, type and date range', () => {
    expect(filterSessions(list, { ...NO_FILTERS, horseId: 'Bella' }, null)).toHaveLength(2);
    expect(filterSessions(list, { ...NO_FILTERS, trainingType: 'dressage' }, null).map((x) => x.session.id)).toEqual(['2']);
    expect(filterSessions(list, { ...NO_FILTERS, from: '2026-11-15' }, null)).toHaveLength(2);
  });
});
