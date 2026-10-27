import { describe, expect, it } from 'vitest';
import { agendaHref, parseAgendaQuery } from '@/services/calendar/agendaQuery';

const HORSE = '6f1c1b1e-0000-4000-8000-000000000001';

describe('agenda query', () => {
  it('parses a full query and round-trips it into a link', () => {
    const query = parseAgendaQuery({ view: 'day', date: '2026-10-27', horse: HORSE, assignee: HORSE });
    expect(query).toEqual({ view: 'day', date: '2026-10-27', horseId: HORSE, assigneeId: HORSE });
    expect(agendaHref('/agenda', query)).toBe(
      `/agenda?view=day&date=2026-10-27&horse=${HORSE}&assignee=${HORSE}`,
    );
  });

  it('drops malformed values instead of passing them to a query', () => {
    expect(
      parseAgendaQuery({ view: 'year', date: '27-10-2026', horse: "x'),or(1=1", assignee: '' }),
    ).toEqual({ view: 'week', date: null, horseId: null, assigneeId: null });
  });

  it('keeps old ?week= links working, and leaves defaults out of the URL', () => {
    const query = parseAgendaQuery({ week: '2026-10-26' });
    expect(query.date).toBe('2026-10-26');
    expect(agendaHref('/agenda', { view: 'week', date: null, horseId: null, assigneeId: null })).toBe('/agenda');
  });
});
