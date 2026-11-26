/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit 241eaaf, do not edit here.
 *
 * Source: horsepowr/src/services/calendar/conflictResolution.ts
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

/**
 * Field-level three-way merge for a pending agenda edit.
 *
 * PURE. Given, per field this device changed: the value it saw BEFORE the edit
 * (base), the value it wants (local) and what the server holds now (server):
 *
 *   server == base   -> nobody else touched it: push ours
 *   server == local  -> someone made the same change: nothing to push
 *   otherwise        -> CONFLICT: two people changed the same field. The server
 *                       keeps its value (first writer wins) and ours is
 *                       reported, never silently dropped.
 *
 * A field without a recorded base (an outbox entry written before this
 * existed) is pushed as before — the old, documented last-write-wins rule —
 * rather than guessed at.
 *
 * Mirrored to the web, which applies the same rule when a dialog saves over
 * a row someone else changed after it was opened.
 */

export interface FieldConflict {
  field: string;
  base: unknown;
  local: unknown;
  server: unknown;
}

export interface MergeResult {
  /** Fields to write. */
  push: string[];
  /** Fields where both sides changed the value differently. */
  conflicts: FieldConflict[];
}

/** Structural equality for column values (scalars, null, plain JSON). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    return (a ?? null) === (b ?? null);
  }
  if (typeof a !== typeof b) return false;
  if (typeof a === 'string') {
    // Timestamps come back from Postgres as "+00:00" with microseconds and
    // leave the client as "Z" with milliseconds: compare them as instants.
    const ta = Date.parse(a);
    const tb = Date.parse(b as string);
    const looksLikeInstant = /^\d{4}-\d{2}-\d{2}T/.test(a) && /^\d{4}-\d{2}-\d{2}T/.test(b as string);
    return looksLikeInstant && !Number.isNaN(ta) && ta === tb;
  }
  if (typeof a === 'object') return stableJson(a) === stableJson(b);
  return false;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function mergePendingFields(params: {
  dirtyFields: readonly string[];
  base: Readonly<Record<string, unknown>> | undefined;
  local: Readonly<Record<string, unknown>>;
  server: Readonly<Record<string, unknown>>;
}): MergeResult {
  const { dirtyFields, base, local, server } = params;
  const push: string[] = [];
  const conflicts: FieldConflict[] = [];

  for (const field of dirtyFields) {
    if (base === undefined || !(field in base)) {
      push.push(field);
      continue;
    }
    const b = base[field];
    const l = local[field];
    const s = server[field];
    if (sameValue(s, b)) push.push(field);
    else if (sameValue(s, l)) continue;
    else conflicts.push({ field, base: b, local: l, server: s });
  }
  return { push, conflicts };
}
