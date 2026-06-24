import type { Supa } from '@/lib/supabase/types';
import type { SessionRow, TrainingType } from '@/types/db';
import { unwrap } from '@/data/errors';

/** Editable annotation fields on a session (WP9). Mirrors the existing columns;
 *  no schema change. `notes` is the free-text field alongside the structured ones. */
export interface SessionAnnotationInput {
  training_type: TrainingType | null;
  environment: string | null;
  location_name: string | null;
  physical_rating: number | null;
  mental_rating: number | null;
  injury_concern: boolean;
  injury_recovery: boolean;
  notes: string | null;
}

export const EMPTY_ANNOTATIONS: SessionAnnotationInput = {
  training_type: null,
  environment: null,
  location_name: null,
  physical_rating: null,
  mental_rating: null,
  injury_concern: false,
  injury_recovery: false,
  notes: null,
};

/** Reads the annotation fields off a session row. */
export function annotationsFromSession(session: SessionRow): SessionAnnotationInput {
  return {
    training_type: session.training_type,
    environment: session.environment,
    location_name: session.location_name,
    physical_rating: session.physical_rating,
    mental_rating: session.mental_rating,
    injury_concern: session.injury_concern,
    injury_recovery: session.injury_recovery,
    notes: session.notes,
  };
}

/**
 * Updates a session's annotation columns under RLS (trainer write only — owner/
 * vet are blocked by the policy). Returns the updated row. No schema change:
 * these are existing columns on `sessions`.
 */
export async function updateSessionAnnotations(
  supa: Supa,
  sessionId: string,
  input: SessionAnnotationInput,
): Promise<SessionRow> {
  const rows = unwrap(
    await supa.from('sessions').update(input).eq('id', sessionId).select('*'),
    'updateSessionAnnotations',
  );
  const updated = rows[0];
  if (!updated) {
    // RLS blocked the write (or the row vanished) — surface it, don't pretend success.
    throw new Error('Could not save annotations. You may not have edit access to this session.');
  }
  return updated;
}
