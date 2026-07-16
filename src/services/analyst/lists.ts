/**
 * Read-only list tools: horses and session summaries for the caller's stable.
 * Both derive their org scope from the signed-in user's org id and read through
 * the existing repositories under RLS.
 *
 * listSessions returns LIGHTWEIGHT summaries only (no per-session HR/speed
 * aggregates). Those aggregates require loading every measurement row for each
 * session — too heavy for a list — so they come from getSession on the specific
 * session the model drills into. This is a deliberate boundary, surfaced in the
 * tool description, not a silent truncation.
 */
import type { Supa } from '@/lib/supabase/types';
import type { HorseRow, SessionRow, TrainingType } from '@/types/db';
import { listHorses, getHorse } from '@/data/horseRepository';
import { listSessionsForHorse, listSessionsForHorses } from '@/data/sessionRepository';
import { deriveAgeYears } from '@/services/age';
import type {
  AnalystHorseSummary,
  AnalystSessionSummary,
  ListHorsesInput,
  ListSessionsInput,
} from '@/services/analyst/types';

/** Cap on rows returned by a single list call. */
const DEFAULT_SESSION_LIMIT = 50;
const MAX_SESSION_LIMIT = 200;

function durationMinOf(session: SessionRow): number | null {
  if (!session.ended_at) return null;
  const start = new Date(session.started_at).getTime();
  const end = new Date(session.ended_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

/** Maps a session row to the model-facing summary. Exported for reuse by
 *  getSessionForAnalyst so the summary is shaped identically everywhere (DRY). */
export function toSessionSummary(session: SessionRow, horseName: string): AnalystSessionSummary {
  return {
    id: session.id,
    horseId: session.horse_id,
    horseName,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationMin: durationMinOf(session),
    trainingType: session.training_type,
    environment: session.environment,
    locationName: session.location_name,
    physicalRating: session.physical_rating,
    mentalRating: session.mental_rating,
    injuryConcern: session.injury_concern,
    injuryRecovery: session.injury_recovery,
    notes: session.notes,
  };
}

function toHorseSummary(horse: HorseRow): AnalystHorseSummary {
  return {
    id: horse.id,
    name: horse.name,
    discipline: horse.discipline,
    level: horse.level,
    ageYears: deriveAgeYears(horse.date_of_birth),
    sex: horse.sex,
    active: horse.active,
    maxHr: horse.max_hr,
    locationId: horse.location_id,
  };
}

export async function listHorsesForAnalyst(
  supa: Supa,
  orgId: string,
  input: ListHorsesInput = {},
): Promise<AnalystHorseSummary[]> {
  const horses = await listHorses(supa, orgId, {
    activeOnly: input.activeOnly,
    locationId: input.locationId ?? undefined,
  });
  // Defense-in-depth: the query already filters by org_id and RLS enforces it,
  // so this filter is belt-and-suspenders — it guarantees a policy regression can
  // never surface a foreign horse through this tool. Mirrors the org guard in
  // getSessionForAnalyst; the DB stays the primary gate.
  return horses.filter((h) => h.org_id === orgId).map(toHorseSummary);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Inclusive date-range test on a session's ISO `started_at`. Bounds may be
 * date-only ("2026-06-21") or full datetimes.
 *
 * A date-only `to` means "through the END of that UTC day", so a session at
 * 05:10Z on the 21st matches a `to: "2026-06-21"`. Without this a single-day
 * range [D, D] would exclude everything after 00:00Z (the bare date parses to
 * midnight) — which silently hid real same-day sessions from the analyst.
 * A `to` with a time component is treated as the exact instant. Timestamps are
 * stored in UTC, so bounds are compared in UTC.
 */
export function inDateRange(startedAt: string, from?: string, to?: string): boolean {
  const t = new Date(startedAt).getTime();
  if (!Number.isFinite(t)) return false;
  if (from) {
    const f = new Date(from).getTime();
    if (Number.isFinite(f) && t < f) return false;
  }
  if (to) {
    const base = new Date(to).getTime();
    if (Number.isFinite(base)) {
      if (DATE_ONLY.test(to.trim())) {
        // End of that UTC day, exclusive of the next day's midnight.
        if (t >= base + 86_400_000) return false;
      } else if (t > base) {
        return false;
      }
    }
  }
  return true;
}

export async function listSessionsForAnalyst(
  supa: Supa,
  orgId: string,
  input: ListSessionsInput = {},
): Promise<AnalystSessionSummary[]> {
  const limit = Math.min(MAX_SESSION_LIMIT, Math.max(1, input.limit ?? DEFAULT_SESSION_LIMIT));

  // Resolve the horse-id → name map for the scope, so every summary carries a
  // readable name. This also enforces org scope: we only ever query horses/
  // sessions the org owns.
  const nameById = new Map<string, string>();
  let sessions: SessionRow[];

  if (input.horseId) {
    const horse = await getHorse(supa, input.horseId);
    if (!horse || horse.org_id !== orgId) return []; // not in this stable
    nameById.set(horse.id, horse.name);
    sessions = await listSessionsForHorse(supa, input.horseId, { finishedOnly: false });
  } else {
    const horses = await listHorses(supa, orgId);
    // Defense-in-depth: only trust horses re-verified as belonging to this org
    // (RLS already scopes them; this is belt-and-suspenders). nameById then
    // doubles as the allow-list the session filter below is checked against.
    for (const h of horses) if (h.org_id === orgId) nameById.set(h.id, h.name);
    sessions = await listSessionsForHorses(
      supa,
      [...nameById.keys()],
      { finishedOnly: false },
    );
  }

  const trainingType: TrainingType | undefined = input.trainingType;
  const filtered = sessions.filter(
    (s) =>
      // Only sessions whose horse was re-verified as in this org (defense-in-depth
      // over RLS): a session for a horse not in the allow-list is dropped.
      nameById.has(s.horse_id) &&
      inDateRange(s.started_at, input.from, input.to) &&
      (trainingType === undefined || s.training_type === trainingType),
  );

  // Repos already order by started_at desc; keep that and cap.
  return filtered
    .slice(0, limit)
    .map((s) => toSessionSummary(s, nameById.get(s.horse_id) ?? 'Unknown horse'));
}
