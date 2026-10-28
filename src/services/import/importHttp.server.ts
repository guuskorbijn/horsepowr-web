import 'server-only';
import { NextResponse } from 'next/server';
import { RepositoryError } from '@/data/errors';
import { log } from '@/lib/log';
import { getSessionContext, type SessionContext } from '@/lib/session';
import { ImportError, type ImportErrorCode } from '@/services/import/types';

/**
 * The HTTP edge of the import routes: who may call them, and how a failure
 * becomes a response. A failure carries a CODE the UI translates — never a
 * message from the file or the database.
 */

const STATUS: Record<ImportErrorCode, number> = {
  'too-large': 413,
  empty: 400,
  'unsupported-extension': 415,
  'content-mismatch': 415,
  unreadable: 422,
  'unsafe-xml': 422,
  'no-samples': 422,
  'too-many-samples': 413,
  'not-allowed': 403,
  'horse-not-found': 404,
  'write-failed': 500,
};

export function importErrorResponse(code: ImportErrorCode): NextResponse {
  return NextResponse.json({ error: code }, { status: STATUS[code] });
}

/** The caller's context when they may import (trainer with an org), else a response. */
export async function requireImporter(): Promise<
  { ok: true; ctx: SessionContext & { org: NonNullable<SessionContext['org']> } } | { ok: false; response: NextResponse }
> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (!ctx.org || !ctx.capabilities.canImport) return { ok: false, response: importErrorResponse('not-allowed') };
  return { ok: true, ctx: { ...ctx, org: ctx.org } };
}

/** Postgres "insufficient privilege" and PostgREST's RLS refusals. */
const RLS_CODES = new Set(['42501', 'PGRST301']);

export function handleImportFailure(err: unknown, route: string): NextResponse {
  if (err instanceof ImportError) {
    log.warn(`${route}: refused`, { code: err.code, detail: err.message });
    return importErrorResponse(err.code);
  }
  if (err instanceof RepositoryError && err.cause?.code !== undefined && RLS_CODES.has(err.cause.code)) {
    log.warn(`${route}: refused by RLS`, { error: err.message });
    return importErrorResponse('not-allowed');
  }
  log.error(`${route}: failed`, { error: err instanceof Error ? err.message : String(err) });
  return importErrorResponse('write-failed');
}
