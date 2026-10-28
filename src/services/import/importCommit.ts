import type { Supa } from '@/lib/supabase/types';
import { getHorse } from '@/data/horseRepository';
import { getSession, insertSessionIfAbsent } from '@/data/sessionRepository';
import { countMeasurements, insertMeasurementsIgnoringDuplicates } from '@/data/measurementRepository';
import { importSessionId, uuidV5 } from '@/lib/deterministicId';
import { MEASUREMENT_INSERT_CHUNK } from '@/services/import/importLimits';
import { buildMeasurementRows, type NormalisedActivity } from '@/services/import/importService';
import { ImportError } from '@/services/import/types';
import { TRAINING_TYPES, type TrainingType } from '@/types/db';

/**
 * Writes a confirmed import: one session, then its measurements.
 *
 * Idempotent with no schema change. The session id is uuid v5 of
 * (org, horse, SHA-256 of the file), each row id is uuid v5 of (session,
 * stream, index), and every write is insert-or-skip. So:
 *   - the same file twice -> "already imported", nothing written;
 *   - a write that died halfway -> the next attempt finds the session, sees
 *     fewer rows than the file holds, and inserts only what is missing.
 * Append-only holds: nothing here issues an UPDATE or a DELETE.
 */

export interface ImportAnnotations {
  trainingType: TrainingType | null;
  environment: string | null;
  locationName: string | null;
}

export interface CommitRequest {
  orgId: string;
  horseId: string;
  activity: NormalisedActivity;
  fileSha256: string;
  annotations: ImportAnnotations;
}

export type CommitOutcome = 'created' | 'resumed' | 'already-imported';

export interface CommitResult {
  outcome: CommitOutcome;
  sessionId: string;
  rowCount: number;
}

const MAX_FREE_TEXT = 120;

/** Annotation fields from a form, validated: known vocabulary, bounded free text. */
export function parseAnnotations(input: {
  trainingType: string | null;
  environment: string | null;
  locationName: string | null;
}): ImportAnnotations {
  const freeText = (value: string | null): string | null => {
    const trimmed = value?.trim() ?? '';
    return trimmed === '' ? null : trimmed.slice(0, MAX_FREE_TEXT);
  };
  const type = input.trainingType?.trim() ?? '';
  return {
    trainingType: (TRAINING_TYPES as readonly string[]).includes(type) ? (type as TrainingType) : null,
    environment: freeText(input.environment),
    locationName: freeText(input.locationName),
  };
}

export async function commitImport(supa: Supa, request: CommitRequest): Promise<CommitResult> {
  const horse = await getHorse(supa, request.horseId);
  if (!horse || horse.org_id !== request.orgId) throw new ImportError('horse-not-found');

  const sessionId = importSessionId(request.orgId, horse.id, request.fileSha256);
  const rows = buildMeasurementRows(request.activity, sessionId, (kind, index) =>
    uuidV5(`${kind}:${index}`, sessionId),
  );

  const existing = await getSession(supa, sessionId);
  if (existing !== null) {
    const stored = await countMeasurements(supa, sessionId);
    if (stored >= rows.length) return { outcome: 'already-imported', sessionId, rowCount: stored };
    await insertMeasurementsIgnoringDuplicates(supa, rows, MEASUREMENT_INSERT_CHUNK);
    return { outcome: 'resumed', sessionId, rowCount: rows.length };
  }

  const created = await insertSessionIfAbsent(supa, {
    id: sessionId,
    horse_id: horse.id,
    started_at: request.activity.startedAt,
    ended_at: request.activity.endedAt,
    notes: null,
    synced: true,
    training_type: request.annotations.trainingType,
    environment: request.annotations.environment,
    location_name: request.annotations.locationName,
  });
  await insertMeasurementsIgnoringDuplicates(supa, rows, MEASUREMENT_INSERT_CHUNK);
  // `created` is false only when a second tab confirmed the same file in the
  // same instant; the rows are idempotent either way.
  return { outcome: created ? 'created' : 'resumed', sessionId, rowCount: rows.length };
}
