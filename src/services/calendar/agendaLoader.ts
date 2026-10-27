import type { Supa } from '@/lib/supabase/types';
import { listEventsInWindow, listOverrides } from '@/data/calendarRepository';
import { listHorses } from '@/data/horseRepository';
import { listOrgProfiles } from '@/data/profileRepository';
import { log } from '@/lib/log';
import {
  agendaWindow,
  buildAgenda,
  todayDayKey,
  type Agenda,
  type AgendaFilters,
  type AgendaView,
} from '@/services/calendar/agendaService';
import type { HorseRow, ProfileRow } from '@/types/db';

export interface AgendaRequest {
  orgId: string;
  view: AgendaView;
  /** YYYY-MM-DD to show, or null for today. */
  anchorDayKey: string | null;
  filters: AgendaFilters;
  readerTimeZone: string;
  nowIso: string;
}

export interface AgendaPayload {
  agenda: Agenda;
  horses: HorseRow[];
  assignees: ProfileRow[];
}

/**
 * Everything an agenda screen shows, fetched and assembled.
 *
 * The one place the agenda's reads are orchestrated, shared by the stable
 * agenda and the per-horse agenda so the two cannot drift apart. Problems the
 * pure assembly reports (a rule it could not read, a series cut at the safety
 * ceiling) are logged here — the pure layer returns them, this layer is where
 * they leave a trace.
 */
export async function loadAgenda(supa: Supa, request: AgendaRequest): Promise<AgendaPayload> {
  const window = agendaWindow({
    view: request.view,
    anchorDayKey: request.anchorDayKey,
    readerTimeZone: request.readerTimeZone,
    nowIso: request.nowIso,
  });

  const [events, horses, assignees] = await Promise.all([
    listEventsInWindow(supa, {
      orgId: request.orgId,
      startUtc: window.startUtc,
      endUtc: window.endUtc,
      ...(request.filters.horseId !== undefined ? { horseId: request.filters.horseId } : {}),
      ...(request.filters.assigneeId !== undefined ? { assigneeId: request.filters.assigneeId } : {}),
      ...(request.filters.types !== undefined ? { types: request.filters.types } : {}),
    }),
    listHorses(supa, request.orgId),
    listOrgProfiles(supa, request.orgId),
  ]);
  const overrides = await listOverrides(
    supa,
    events.map((event) => event.id),
  );

  const maxHrByHorse: Record<string, number> = {};
  for (const horse of horses) maxHrByHorse[horse.id] = horse.max_hr;

  const agenda = buildAgenda({
    window,
    events,
    overrides,
    filters: request.filters,
    maxHrByHorse,
    todayKey: todayDayKey(request.nowIso, request.readerTimeZone),
  });

  if (agenda.unparseableRuleEventIds.length > 0) {
    log.warn('agenda: recurrence rules that could not be read; shown once at their start', {
      eventIds: agenda.unparseableRuleEventIds,
    });
  }
  if (agenda.truncatedEventIds.length > 0) {
    log.warn('agenda: series cut short at the expansion ceiling', {
      eventIds: agenda.truncatedEventIds,
    });
  }

  return { agenda, horses, assignees };
}
