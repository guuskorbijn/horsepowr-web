/**
 * Session-list service — joins horses and their sessions for org/location-scoped
 * list views. Keeps the join logic out of components and out of any single
 * repository (it spans two). Reads only; RLS scopes everything to the org.
 */
import type { Supa } from '@/lib/supabase/types';
import { listHorses } from '@/data/horseRepository';
import {
  getLastSessionForHorse,
  listSessionsForHorses,
} from '@/data/sessionRepository';
import type { HorseRow } from '@/types/db';
import type { HorseLastSession, SessionWithHorse } from '@/types/view';

export interface OrgScopeOptions {
  locationId?: string | null;
  finishedOnly?: boolean;
}

/** All sessions in the org (optionally one location), newest first, with horse. */
export async function getOrgSessions(
  supa: Supa,
  orgId: string,
  options: OrgScopeOptions = {},
): Promise<SessionWithHorse[]> {
  const horses = await listHorses(supa, orgId, { locationId: options.locationId });
  const byId = new Map<string, HorseRow>(horses.map((h) => [h.id, h]));
  const sessions = await listSessionsForHorses(
    supa,
    horses.map((h) => h.id),
    { finishedOnly: options.finishedOnly },
  );
  const out: SessionWithHorse[] = [];
  for (const session of sessions) {
    const horse = byId.get(session.horse_id);
    if (horse) out.push({ session, horse });
  }
  return out;
}

/** Each horse with its last session (command center). One query per horse for
 *  the last session keeps it simple; horse counts are small (tens, not millions). */
export async function getHorsesWithLastSession(
  supa: Supa,
  orgId: string,
  options: OrgScopeOptions = {},
): Promise<HorseLastSession[]> {
  const horses = await listHorses(supa, orgId, { locationId: options.locationId });
  return Promise.all(
    horses.map(async (horse) => {
      const lastSession = await getLastSessionForHorse(supa, horse.id);
      return { horse, lastSession, metrics: null };
    }),
  );
}
