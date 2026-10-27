import { parseCivilDayKey } from '@/services/time/civilDate';
import { asAgendaView, type AgendaView } from '@/services/calendar/agendaService';

/**
 * The agenda's URL state — PURE.
 *
 * Everything that decides what the agenda shows lives in the query string,
 * so a filtered week is a link someone can send ("the vet's week at
 * Breda"). Parsing is strict: anything malformed is dropped rather than
 * passed on to a query.
 */

export interface AgendaQuery {
  view: AgendaView;
  /** YYYY-MM-DD, or null for today. */
  date: string | null;
  horseId: string | null;
  assigneeId: string | null;
}

export type SearchParamValue = string | string[] | undefined;

/** Ids are uuids; accept the uuid alphabet only, so a crafted value is ignored. */
const ID = /^[0-9a-fA-F-]{8,64}$/;

function first(value: SearchParamValue): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v === undefined || v.trim() === '' ? null : v.trim();
}

function asDayKey(value: string | null): string | null {
  return value !== null && parseCivilDayKey(value) !== null ? value : null;
}

function asId(value: string | null): string | null {
  return value !== null && ID.test(value) ? value : null;
}

export function parseAgendaQuery(params: Readonly<Record<string, SearchParamValue>>): AgendaQuery {
  return {
    view: asAgendaView(first(params.view)),
    // `week` was the only parameter before day view existed; old links keep working.
    date: asDayKey(first(params.date)) ?? asDayKey(first(params.week)),
    horseId: asId(first(params.horse)),
    assigneeId: asId(first(params.assignee)),
  };
}

/** A link to `basePath` with `query` applied; defaults are left out of the URL. */
export function agendaHref(basePath: string, query: AgendaQuery): string {
  const params = new URLSearchParams();
  if (query.view !== 'week') params.set('view', query.view);
  if (query.date !== null) params.set('date', query.date);
  if (query.horseId !== null) params.set('horse', query.horseId);
  if (query.assigneeId !== null) params.set('assignee', query.assigneeId);
  const search = params.toString();
  return search === '' ? basePath : `${basePath}?${search}`;
}
