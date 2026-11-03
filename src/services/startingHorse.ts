import type { Supa } from '@/lib/supabase/types';
import { listSessionsForHorses } from '@/data/sessionRepository';
import type { HorseRow } from '@/types/db';

/**
 * Which horse an analysis screen (compare, trends) opens on.
 *
 * An empty "pick a horse" screen is a dead first impression: the person came
 * to look at numbers and gets a dropdown. So: the horse the link asked for
 * (`?horse=`, from a horse's own page), else the horse ridden most recently,
 * else none. Only a horse in the given list is ever chosen, so a crafted id
 * from another stable falls through to the default.
 */
export async function resolveStartingHorse(
  supa: Supa,
  horses: readonly HorseRow[],
  requested: string | null,
): Promise<string | null> {
  if (requested !== null && horses.some((h) => h.id === requested)) return requested;
  const active = horses.filter((h) => h.active);
  if (active.length === 0) return null;
  const [latest] = await listSessionsForHorses(
    supa,
    active.map((h) => h.id),
    { limit: 1 },
  );
  return latest?.horse_id ?? null;
}
