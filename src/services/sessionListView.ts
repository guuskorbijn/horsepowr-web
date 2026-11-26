import type { TrainingType } from '@/types/db';
import type { SessionWithHorse } from '@/types/view';

/** Filtering, sorting and saved views for the sessions list. PURE. */

export interface SessionFilters {
  horseId: string;
  from: string;
  to: string;
  trainingType: TrainingType | '';
}

export const NO_FILTERS: SessionFilters = { horseId: '', from: '', to: '', trainingType: '' };

export const SESSION_SORTS = ['newest', 'oldest', 'longest', 'horse'] as const;
export type SessionSort = (typeof SESSION_SORTS)[number];

export interface SavedView {
  name: string;
  filters: SessionFilters;
}

function lengthMs(s: SessionWithHorse): number {
  return s.session.ended_at ? Date.parse(s.session.ended_at) - Date.parse(s.session.started_at) : -1;
}

export function filterSessions(
  sessions: readonly SessionWithHorse[],
  f: SessionFilters,
  locationId: string | null,
): SessionWithHorse[] {
  const fromMs = f.from ? Date.parse(`${f.from}T00:00:00`) : null;
  const toMs = f.to ? Date.parse(`${f.to}T23:59:59`) : null;
  return sessions.filter((s) => {
    if (locationId && s.horse.location_id !== locationId) return false;
    if (f.horseId && s.horse.id !== f.horseId) return false;
    if (f.trainingType && s.session.training_type !== f.trainingType) return false;
    const t = Date.parse(s.session.started_at);
    if (fromMs !== null && t < fromMs) return false;
    if (toMs !== null && t > toMs) return false;
    return true;
  });
}

export function sortSessions(sessions: readonly SessionWithHorse[], sort: SessionSort): SessionWithHorse[] {
  const out = [...sessions];
  switch (sort) {
    case 'newest':
      return out.sort((a, b) => b.session.started_at.localeCompare(a.session.started_at));
    case 'oldest':
      return out.sort((a, b) => a.session.started_at.localeCompare(b.session.started_at));
    case 'longest':
      return out.sort((a, b) => lengthMs(b) - lengthMs(a));
    case 'horse':
      return out.sort(
        (a, b) => a.horse.name.localeCompare(b.horse.name) || b.session.started_at.localeCompare(a.session.started_at),
      );
  }
}
