/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit cc497bd, do not edit here.
 *
 * Source: horsepowr/src/schemas/plannedSnapshot.ts
 *
 * CLAUDE.md forbids importing the RN repo as a build dependency, and Vercel
 * builds this repo alone, so shared domain logic is copied rather than linked.
 * The copy is deliberate and checked: `npm run check:mirror` fails when this
 * file and its source have drifted, so the duplication is visible instead of
 * silent. Fix a bug in the mobile repo and re-run the mirror; never patch here.
 *
 * These modules are PURE on purpose — that is what makes them safe to mirror.
 * Anything touching Supabase, storage or React stays on its own side.
 */

import { z } from 'zod';

import { log } from '@/lib/log';
import {
  TARGET_DURATION_MAX,
  TARGET_DURATION_MIN,
  trainingTargetsSchema,
} from './trainingTargets';

/**
 * The plan AS IT WAS when a session started — `sessions.planned_targets_snapshot`.
 *
 * Why a snapshot rather than a live read of the event, decided in the Phase 2
 * plan and worth repeating where the type lives:
 *
 *  - Honesty. The comparison is a statement about what was asked for AT THE
 *    TIME. A plan edited this evening must not retroactively rewrite this
 *    afternoon's result.
 *  - Durability. `sessions.planned_event_id` is ON DELETE SET NULL, so a hard
 *    delete of the event would otherwise take the whole comparison with it.
 *  - Offline, which is the decisive one. The local calendar mirror is windowed
 *    to -90/+365 days. Six months on, the event has been evicted and a live
 *    read returns nothing — so "works offline end to end" is not achievable
 *    with live targets at all.
 *
 * Versioned for the same reason `targets` is: this is persisted data that
 * outlives any single app build, and an unversioned blob makes every future
 * shape change silent corruption.
 */

export const PLANNED_SNAPSHOT_VERSION = 1;

/**
 * Where the planned duration came from.
 *
 * Two different numbers can both reasonably be called "the planned duration":
 * the target's own `durationMin`, and the length of the agenda slot
 * (`ends_at - starts_at`). Recording WHICH one was used means the comparison
 * never has to re-derive it with a preference rule that might shift between
 * builds.
 */
export const DURATION_SOURCES = ['targets', 'slot'] as const;

export const plannedSnapshotSchema = z.object({
  version: z.literal(PLANNED_SNAPSHOT_VERSION),
  /** The event's (or occurrence's) targets, exactly as they stood. */
  targets: trainingTargetsSchema.nullable(),
  /** Resolved planned duration in whole minutes, or null when unknown. */
  plannedDurationMin: z
    .number()
    .int()
    .min(TARGET_DURATION_MIN)
    .max(TARGET_DURATION_MAX)
    .nullable(),
  durationSource: z.enum(DURATION_SOURCES).nullable(),
  /**
   * The occurrence's ORIGINAL start for a recurring plan, null for a one-off.
   * Duplicated from the column so the snapshot is self-describing when it is
   * read on its own (an export, a support question, the web app later).
   */
  occurrenceStart: z.string().nullable(),
  /** When the snapshot was taken — i.e. when the session started. */
  capturedAt: z.string(),
});

export type PlannedSnapshot = z.infer<typeof plannedSnapshotSchema>;

export type ParseSnapshotResult =
  | { ok: true; snapshot: PlannedSnapshot }
  | { ok: false; error: string };

export function parsePlannedSnapshot(input: unknown): ParseSnapshotResult {
  const result = plannedSnapshotSchema.safeParse(input);
  if (result.success) return { ok: true, snapshot: result.data };
  const first = result.error.issues[0];
  const where = first && first.path.length > 0 ? `${first.path.join('.')}: ` : '';
  return { ok: false, error: `${where}${first?.message ?? 'invalid snapshot'}` };
}

/**
 * Lenient read path for persisted data: null in, null out; invalid in, null out
 * plus a log line. One malformed snapshot costs that session its comparison
 * card, never the whole results screen.
 */
export function parsePlannedSnapshotOrNull(
  input: unknown,
  context: { sessionId?: string } = {},
): PlannedSnapshot | null {
  if (input === null || input === undefined) return null;
  const result = parsePlannedSnapshot(input);
  if (result.ok) return result.snapshot;
  log.warn('plannedSnapshot: discarding invalid payload', {
    ...context,
    error: result.error,
  });
  return null;
}

/** True when the snapshot says nothing a comparison could be built from. */
export function snapshotHasNothingToCompare(snapshot: PlannedSnapshot): boolean {
  const noTargets =
    snapshot.targets === null ||
    ((snapshot.targets.hrMinBpm === null || snapshot.targets.hrMinBpm === undefined) &&
      (snapshot.targets.hrMaxBpm === null || snapshot.targets.hrMaxBpm === undefined));
  return noTargets && snapshot.plannedDurationMin === null;
}
