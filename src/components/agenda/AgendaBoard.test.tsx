// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AgendaBoard } from '@/components/agenda/AgendaBoard';
import { agendaWindow, buildAgenda } from '@/services/calendar/agendaService';
import type { CalendarEvent } from '@/types/calendar';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
// The board's write paths are not exercised here; keep the browser client
// (which reads env at import) out of a render test.
vi.mock('@/lib/supabase/browser', () => ({ getBrowserSupabase: vi.fn() }));

afterEach(cleanup);

const NOW = '2026-10-27T10:00:00.000Z';

function event(patch: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'evt-1',
    org_id: 'org-1',
    horse_id: 'horse-1',
    type: 'training',
    title: 'Interval work',
    notes: null,
    starts_at: '2026-10-27T07:00:00.000Z',
    ends_at: null,
    all_day: false,
    timezone: 'Europe/Amsterdam',
    location_id: null,
    assignee_id: null,
    status: 'planned',
    created_by: 'user-1',
    targets: { version: 1, hrMinBpm: 150, hrMaxBpm: 170, durationMin: 45 },
    training_type: null,
    recurrence_rule: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    deleted_at: null,
    ...patch,
  };
}

function renderBoard(
  events: CalendarEvent[],
  canEdit: boolean,
  view: 'day' | 'week' = 'week',
  defaults: { horseId?: string | null } = {},
) {
  const agenda = buildAgenda({
    window: agendaWindow({ view, anchorDayKey: '2026-10-27', readerTimeZone: 'Europe/Amsterdam', nowIso: NOW }),
    events,
    overrides: [],
    maxHrByHorse: { 'horse-1': 220 },
    todayKey: '2026-10-27',
  });
  return render(
    <AgendaBoard
      agenda={agenda}
      horseNames={{ 'horse-1': 'Luna' }}
      readerTimeZoneIsFallback={false}
      defaults={defaults}
      canEdit={canEdit}
      orgId="org-1"
      userId="user-1"
      horses={[{ id: 'horse-1', org_id: 'org-1', location_id: null, name: 'Luna', discipline: null, photo_url: null, active: true, max_hr: 220, date_of_birth: null, sex: null, breed: null, level: null, height_cm: null, weight_kg: null, chip_number: null, created_at: NOW }]}
      locations={[]}
      assignees={[]}
    />,
  );
}

describe('AgendaBoard', () => {
  it('shows a training target as bpm with its Z label and duration', () => {
    renderBoard([event({})], false);
    expect(screen.getByText('150–170 bpm · Z2–Z3 · 45 min')).toBeDefined();
    expect(screen.getByText('Luna')).toBeDefined();
  });

  it('strikes a cancelled item through and labels it', () => {
    renderBoard([event({ status: 'cancelled' })], false);
    expect(screen.getByText('Interval work').className).toContain('line-through');
    expect(screen.getByText('Cancelled')).toBeDefined();
  });

  it('a read-only role sees no write affordances', () => {
    renderBoard([event({})], false);
    expect(screen.queryByText('New item')).toBeNull();
    expect(screen.queryByLabelText(/Plan on/)).toBeNull();
  });

  it('a trainer gets the single coral action', () => {
    renderBoard([event({})], true);
    expect(screen.getAllByText('New item')).toHaveLength(1);
  });

  it('an empty read-only day points to the mobile app', () => {
    renderBoard([], false, 'day');
    expect(screen.getByText('Nothing planned this day')).toBeDefined();
    expect(screen.getByText(/Plan items in the mobile app/)).toBeDefined();
  });

  it('a new item on a horse’s agenda starts with that horse selected', () => {
    renderBoard([], true, 'week', { horseId: 'horse-1' });
    fireEvent.click(screen.getByText('New item'));
    const horse = screen.getByLabelText('Horse') as HTMLSelectElement;
    expect(horse.value).toBe('horse-1');
  });
});
