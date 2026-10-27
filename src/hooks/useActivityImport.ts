'use client';

import { useCallback, useState } from 'react';
import { log } from '@/lib/log';
import { MAX_FILE_BYTES, MAX_UPLOAD_BYTES } from '@/services/import/importLimits';
import type { ImportPreview } from '@/services/import/importService';
import type { CommitOutcome } from '@/services/import/importCommit';

/**
 * State and wiring for the activity import: choose -> preview -> confirm.
 * Components only render what this returns.
 *
 * Nothing is written until `confirm`. The file stays in the browser between
 * the two calls and is sent again on confirm, so the server holds no upload
 * state; the preview's hash travels along to prove it is the same file.
 */

export type ImportPhase =
  | { kind: 'idle' }
  | { kind: 'previewing' }
  | { kind: 'previewed'; preview: ImportPreview; fileSha256: string }
  | { kind: 'committing'; preview: ImportPreview; fileSha256: string }
  | { kind: 'done'; outcome: CommitOutcome; sessionId: string }
  | { kind: 'error'; code: string };

export interface ImportChoices {
  horseId: string;
  trainingType: string;
  environment: string;
  locationName: string;
}

export interface UseActivityImport {
  phase: ImportPhase;
  file: File | null;
  choose: (file: File | null) => void;
  confirm: (choices: ImportChoices) => void;
  reset: () => void;
}

/**
 * Gzips in the browser when it can: the request body must stay under the
 * platform's ~4.5 MB cap, and TCX/GPX shrink about tenfold. Without
 * CompressionStream the file goes as-is and the size check below applies.
 */
async function encode(file: File): Promise<{ body: Blob; encoding: 'gzip' | 'identity' }> {
  if (typeof CompressionStream === 'undefined' || typeof file.stream !== 'function') {
    return { body: file, encoding: 'identity' };
  }
  try {
    const stream = file.stream().pipeThrough(new CompressionStream('gzip'));
    return { body: await new Response(stream).blob(), encoding: 'gzip' };
  } catch (err: unknown) {
    log.warn('import: could not compress in the browser; sending the file as-is', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { body: file, encoding: 'identity' };
  }
}

async function post(path: string, file: File, fields: Record<string, string>): Promise<Response> {
  const { body, encoding } = await encode(file);
  if (body.size > MAX_UPLOAD_BYTES) throw new UploadError('too-large');
  const form = new FormData();
  form.set('file', body, file.name);
  form.set('fileName', file.name);
  form.set('encoding', encoding);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return fetch(path, { method: 'POST', body: form });
}

class UploadError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function errorCodeOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : 'write-failed';
  } catch (err: unknown) {
    log.warn('import: error response was not JSON', {
      status: response.status,
      error: err instanceof Error ? err.message : String(err),
    });
    return response.status === 401 ? 'unauthenticated' : 'write-failed';
  }
}

function codeOf(err: unknown): string {
  return err instanceof UploadError ? err.code : 'network';
}

export function useActivityImport(): UseActivityImport {
  const [phase, setPhase] = useState<ImportPhase>({ kind: 'idle' });
  const [file, setFile] = useState<File | null>(null);

  const choose = useCallback((next: File | null): void => {
    setFile(next);
    if (next === null) {
      setPhase({ kind: 'idle' });
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setPhase({ kind: 'error', code: 'too-large' });
      return;
    }
    setPhase({ kind: 'previewing' });
    void (async () => {
      try {
        const response = await post('/api/import/preview', next, {});
        if (!response.ok) {
          setPhase({ kind: 'error', code: await errorCodeOf(response) });
          return;
        }
        const body = (await response.json()) as { preview: ImportPreview; fileSha256: string };
        setPhase({ kind: 'previewed', preview: body.preview, fileSha256: body.fileSha256 });
      } catch (err: unknown) {
        log.error('import: preview failed', { error: err instanceof Error ? err.message : String(err) });
        setPhase({ kind: 'error', code: codeOf(err) });
      }
    })();
  }, []);

  const confirm = useCallback(
    (choices: ImportChoices): void => {
      if (file === null || phase.kind !== 'previewed') return;
      const { preview, fileSha256 } = phase;
      setPhase({ kind: 'committing', preview, fileSha256 });
      void (async () => {
        try {
          const response = await post('/api/import/commit', file, {
            expectedSha256: fileSha256,
            horseId: choices.horseId,
            trainingType: choices.trainingType,
            environment: choices.environment,
            locationName: choices.locationName,
          });
          if (!response.ok) {
            setPhase({ kind: 'error', code: await errorCodeOf(response) });
            return;
          }
          const body = (await response.json()) as { outcome: CommitOutcome; sessionId: string };
          setPhase({ kind: 'done', outcome: body.outcome, sessionId: body.sessionId });
        } catch (err: unknown) {
          log.error('import: commit failed', { error: err instanceof Error ? err.message : String(err) });
          setPhase({ kind: 'error', code: codeOf(err) });
        }
      })();
    },
    [file, phase],
  );

  const reset = useCallback((): void => {
    setFile(null);
    setPhase({ kind: 'idle' });
  }, []);

  return { phase, file, choose, confirm, reset };
}
