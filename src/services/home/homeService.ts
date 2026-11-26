import type { Agenda, AgendaItem } from '@/services/calendar/agendaService';
import type { CalendarEventType } from '@/types/calendar';

/**
 * The dashboard's role-aware overview, derived from one week of agenda.
 *
 * PURE. One fixed layout for everyone; what fills it follows the person:
 *  - "My day": what is assigned to ME today (the rider's view),
 *  - "Stable today": everything today with its done/open state (trainer),
 *  - "This week": horses x days, so a manager sees full and empty days.
 * Counts only — never a judgement of how the week "should" look.
 */

export interface HomeCell {
  dayKey: string;
  kinds: Array<{ type: CalendarEventType; done: boolean; cancelled: boolean }>;
}

export interface HomeRow {
  horseId: string;
  name: string;
  cells: HomeCell[];
  total: number;
}

export interface HomeOverview {
  todayKey: string | null;
  myToday: AgendaItem[];
  /** The next item assigned to me after today, when today has none. */
  myNext: { dayKey: string; item: AgendaItem } | null;
  stableToday: AgendaItem[];
  counts: {
    today: number;
    doneToday: number;
    weekTrainings: number;
    weekItems: number;
    openAssignedToMe: number;
  };
  dayKeys: string[];
  rows: HomeRow[];
  /** Stable-wide items this week (no horse): farrier rounds, meetings. */
  stableWide: Array<{ dayKey: string; item: AgendaItem }>;
}

export function buildHomeOverview(params: {
  agenda: Agenda;
  userId: string;
  horses: ReadonlyArray<{ id: string; name: string; active?: boolean }>;
}): HomeOverview {
  const { agenda, userId } = params;
  const today = agenda.days.find((d) => d.isToday) ?? null;
  const live = (i: AgendaItem): boolean => !i.cancelled;

  const myToday = (today?.items ?? []).filter((i) => live(i) && i.occurrence.assignee_id === userId);
  let myNext: HomeOverview['myNext'] = null;
  if (myToday.length === 0) {
    for (const day of agenda.days) {
      if (today !== null && day.dayKey <= today.dayKey) continue;
      const item = day.items.find((i) => live(i) && i.occurrence.assignee_id === userId);
      if (item) {
        myNext = { dayKey: day.dayKey, item };
        break;
      }
    }
  }

  const all = agenda.days.flatMap((d) => d.items.map((item) => ({ dayKey: d.dayKey, item })));
  const horses = params.horses.filter((h) => h.active !== false);
  const rows: HomeRow[] = horses
    .map((horse) => {
      const cells = agenda.days.map((day) => ({
        dayKey: day.dayKey,
        kinds: day.items
          .filter((i) => i.occurrence.horse_id === horse.id)
          .map((i) => ({ type: i.occurrence.type, done: i.done, cancelled: i.cancelled })),
      }));
      return {
        horseId: horse.id,
        name: horse.name,
        cells,
        total: cells.reduce((n, c) => n + c.kinds.filter((k) => !k.cancelled).length, 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const todayItems = (today?.items ?? []).filter(live);
  return {
    todayKey: today?.dayKey ?? null,
    myToday,
    myNext,
    stableToday: today?.items ?? [],
    counts: {
      today: todayItems.length,
      doneToday: todayItems.filter((i) => i.done).length,
      weekTrainings: all.filter(({ item }) => live(item) && item.occurrence.type === 'training').length,
      weekItems: all.filter(({ item }) => live(item)).length,
      openAssignedToMe: all.filter(
        ({ item }) => live(item) && !item.done && item.occurrence.assignee_id === userId,
      ).length,
    },
    dayKeys: agenda.days.map((d) => d.dayKey),
    rows,
    stableWide: all.filter(({ item }) => item.occurrence.horse_id === null && live(item)),
  };
}
