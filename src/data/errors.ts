import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Thrown when a repository call fails. Repositories never swallow errors — they
 * wrap the Supabase error and rethrow so callers can render a design-system
 * error state with a real message (no silent catches).
 */
export class RepositoryError extends Error {
  readonly cause?: PostgrestError;
  constructor(message: string, cause?: PostgrestError) {
    super(message);
    this.name = 'RepositoryError';
    this.cause = cause;
  }
}

/** Unwraps a Supabase `{ data, error }` result, throwing on error. */
export function unwrap<T>(
  result: { data: T | null; error: PostgrestError | null },
  context: string,
): T {
  if (result.error) {
    throw new RepositoryError(`${context}: ${result.error.message}`, result.error);
  }
  if (result.data === null) {
    throw new RepositoryError(`${context}: no data returned`);
  }
  return result.data;
}

/** Unwraps a result that is allowed to be empty (returns null instead of throwing). */
export function unwrapMaybe<T>(
  result: { data: T | null; error: PostgrestError | null },
  context: string,
): T | null {
  if (result.error) {
    throw new RepositoryError(`${context}: ${result.error.message}`, result.error);
  }
  return result.data;
}
