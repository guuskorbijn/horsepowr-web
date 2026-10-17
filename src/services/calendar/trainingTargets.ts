/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 *
 * Source: horsepowr/src/schemas/trainingTargets.ts
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

/**
 * The training TARGET a planned session is measured against — the one shared
 * definition of the `calendar_events.targets` jsonb payload.
 *
 * Versioned on purpose. The payload is persisted data that outlives any single
 * app build: a phone that has been offline for a month can push a v1 object to
 * a server that already speaks v2, and a v2 row can land on a phone that only
 * knows v1. An unversioned blob makes both of those silent data corruption, so
 * `version` is required by the schema AND by a database CHECK constraint.
 *
 * The database stores this; it does not validate it beyond "is an object and
 * has a version key". Deep validation lives here so the app and (later) the web
 * repo share exactly one rule set.
 */

/** Current payload version. Bump together with a migration in `upgradeTargets`. */
export const TARGETS_VERSION = 1;

/**
 * Plausible equine heart-rate bounds for a TARGET, not for a measurement.
 * Deliberately wider than the 240 bpm default max (see utils/hrZone.ts) so a
 * stable that confirms a higher max with their vet is not blocked by a
 * hard-coded ceiling. This is an input-sanity guard, not a zone model.
 */
export const TARGET_HR_MIN_BPM = 20;
export const TARGET_HR_MAX_BPM = 300;

/** A target block's duration bounds, in seconds. */
export const TARGET_BLOCK_MIN_SEC = 5;
export const TARGET_BLOCK_MAX_SEC = 4 * 60 * 60;

/** Whole-session planned duration bounds, in minutes. */
export const TARGET_DURATION_MIN = 1;
export const TARGET_DURATION_MAX = 600;

/** How many blocks one plan may hold — a guard against a pathological paste. */
export const TARGET_MAX_BLOCKS = 50;

const hrBpm = z
  .number()
  .int()
  .min(TARGET_HR_MIN_BPM)
  .max(TARGET_HR_MAX_BPM);

/**
 * The gait a recovery or steady block is ridden in. Mirrors the gait vocabulary
 * in types/gait.ts rather than inventing a second one, but stays a plain string
 * union here: this is a PLAN (what the trainer intends), while GaitSegment is a
 * MEASUREMENT (what the classifier estimated). Conflating the two would let a
 * planned gait leak into derived data.
 */
export const TARGET_GAITS = ['walk', 'trot', 'canter'] as const;
const targetGait = z.enum(TARGET_GAITS);

/**
 * A steady effort held for a duration — "15 min at 140-150 bpm".
 */
const steadyBlock = z.object({
  kind: z.literal('steady'),
  label: z.string().trim().max(80).optional(),
  durationSec: z.number().int().min(TARGET_BLOCK_MIN_SEC).max(TARGET_BLOCK_MAX_SEC),
  hrMinBpm: hrBpm.optional(),
  hrMaxBpm: hrBpm.optional(),
  gait: targetGait.optional(),
});

/**
 * A repeated work/recovery pair — the analyst's "2 x 2 min at 170 bpm, 1 min
 * trot between". `repeat` counts the WORK bouts; there is one fewer recovery
 * than work bout in the expanded form, which is the reader's concern, not this
 * schema's.
 */
const intervalBlock = z.object({
  kind: z.literal('interval'),
  label: z.string().trim().max(80).optional(),
  repeat: z.number().int().min(1).max(50),
  workDurationSec: z
    .number()
    .int()
    .min(TARGET_BLOCK_MIN_SEC)
    .max(TARGET_BLOCK_MAX_SEC),
  workHrMinBpm: hrBpm.optional(),
  workHrMaxBpm: hrBpm.optional(),
  recoveryDurationSec: z
    .number()
    .int()
    .min(TARGET_BLOCK_MIN_SEC)
    .max(TARGET_BLOCK_MAX_SEC)
    .optional(),
  recoveryGait: targetGait.optional(),
});

/**
 * Discriminated union so a new block kind is a new member here plus a new
 * renderer — no edits to anything that already consumes blocks (open/closed).
 */
const targetBlock = z.discriminatedUnion('kind', [steadyBlock, intervalBlock]);

export const trainingTargetsSchema = z
  .object({
    version: z.literal(TARGETS_VERSION),
    hrMinBpm: hrBpm.nullable().optional(),
    hrMaxBpm: hrBpm.nullable().optional(),
    durationMin: z
      .number()
      .int()
      .min(TARGET_DURATION_MIN)
      .max(TARGET_DURATION_MAX)
      .nullable()
      .optional(),
    /**
     * Analyst-style structure. Accepted and round-tripped from v1 onward so an
     * imported or web-authored plan is never silently dropped, even though the
     * v1 mobile UI only edits the simple hr range + duration.
     */
    blocks: z.array(targetBlock).max(TARGET_MAX_BLOCKS).optional(),
  })
  // A reversed range is the one mistake a numeric input invites, and it would
  // make "% of time inside target" meaningless rather than merely wrong.
  .refine(
    (t) =>
      t.hrMinBpm === null ||
      t.hrMinBpm === undefined ||
      t.hrMaxBpm === null ||
      t.hrMaxBpm === undefined ||
      t.hrMinBpm <= t.hrMaxBpm,
    { message: 'hrMinBpm must be less than or equal to hrMaxBpm', path: ['hrMinBpm'] },
  );

export type TrainingTargets = z.infer<typeof trainingTargetsSchema>;
export type TargetBlock = z.infer<typeof targetBlock>;
export type SteadyTargetBlock = z.infer<typeof steadyBlock>;
export type IntervalTargetBlock = z.infer<typeof intervalBlock>;

/** An empty v1 target — the starting point for a new planned training. */
export function emptyTargets(): TrainingTargets {
  return { version: TARGETS_VERSION };
}

/** True when the target carries nothing a reader could act on. */
export function targetsAreEmpty(targets: TrainingTargets): boolean {
  const noRange =
    (targets.hrMinBpm === null || targets.hrMinBpm === undefined) &&
    (targets.hrMaxBpm === null || targets.hrMaxBpm === undefined);
  const noDuration =
    targets.durationMin === null || targets.durationMin === undefined;
  const noBlocks = !targets.blocks || targets.blocks.length === 0;
  return noRange && noDuration && noBlocks;
}

export type ParseTargetsResult =
  | { ok: true; targets: TrainingTargets }
  | { ok: false; error: string };

/**
 * Validates an unknown payload (a database row, an import, a form) as targets.
 *
 * Returns a result rather than throwing: a single malformed row from the server
 * must degrade that one event to "no target shown", never break the whole
 * agenda's render. The caller logs and carries on — see `parseTargetsOrNull`.
 */
export function parseTargets(input: unknown): ParseTargetsResult {
  const result = trainingTargetsSchema.safeParse(input);
  if (result.success) return { ok: true, targets: result.data };
  const first = result.error.issues[0];
  const where = first && first.path.length > 0 ? `${first.path.join('.')}: ` : '';
  return { ok: false, error: `${where}${first?.message ?? 'invalid targets'}` };
}

/**
 * Lenient read path for persisted data: null in, null out; invalid in, null out
 * plus a log line. Never throws, never silently swallows.
 */
export function parseTargetsOrNull(
  input: unknown,
  context: { eventId?: string } = {},
): TrainingTargets | null {
  if (input === null || input === undefined) return null;
  const result = parseTargets(input);
  if (result.ok) return result.targets;
  log.warn('trainingTargets: discarding invalid targets payload', {
    ...context,
    error: result.error,
  });
  return null;
}
