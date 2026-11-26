import type { CalendarEvent } from '@/types/calendar';
import type { ChecklistItem } from '@/data/templateRepository';

/**
 * Competitions as their own view: one card per show (same title on the same
 * day), listing which horse goes with which rider, and each entry's
 * checklist. PURE grouping; the page fetches.
 */

export interface CompetitionEntry {
  event: CalendarEvent;
  checklist: ChecklistItem[];
}

export interface CompetitionGroup {
  key: string;
  title: string;
  /** YYYY-MM-DD of the first entry (UTC date of its start). */
  dayKey: string;
  startsAt: string;
  entries: CompetitionEntry[];
  done: number;
  total: number;
}

export const DEFAULT_CHECKLIST = [
  'entry',
  'passport',
  'vaccinations',
  'transport',
  'number',
] as const;

function baseTitle(title: string): string {
  // "Indoor Brabant – 1.30m" and "Indoor Brabant – 1.20m" are one show.
  return title.split(/\s[–-]\s/)[0]?.trim() ?? title.trim();
}

export function groupCompetitions(
  events: readonly CalendarEvent[],
  checklists: readonly ChecklistItem[],
): CompetitionGroup[] {
  const byEvent = new Map<string, ChecklistItem[]>();
  for (const item of checklists) {
    const list = byEvent.get(item.event_id) ?? [];
    list.push(item);
    byEvent.set(item.event_id, list);
  }
  const groups = new Map<string, CompetitionGroup>();
  for (const event of [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    if (event.type !== 'competition' || event.deleted_at !== null) continue;
    const title = baseTitle(event.title);
    const dayKey = event.starts_at.slice(0, 10);
    // Multi-day shows: same title within 3 days is one group.
    const existing = [...groups.values()].find(
      (g) => g.title === title && Math.abs(Date.parse(g.startsAt) - Date.parse(event.starts_at)) < 3 * 86_400_000,
    );
    const group =
      existing ?? { key: `${title}|${dayKey}`, title, dayKey, startsAt: event.starts_at, entries: [], done: 0, total: 0 };
    const checklist = (byEvent.get(event.id) ?? []).sort((a, b) => a.position - b.position);
    group.entries.push({ event, checklist });
    group.total += checklist.length;
    group.done += checklist.filter((c) => c.done).length;
    groups.set(group.key, group);
  }
  return [...groups.values()];
}
