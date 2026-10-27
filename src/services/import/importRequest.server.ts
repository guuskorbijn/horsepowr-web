import 'server-only';
import { gunzipSync } from 'node:zlib';
import { sha256Hex } from '@/lib/deterministicId';
import { defaultParserRegistry } from '@/services/import/parserRegistry';
import { normaliseActivity, type NormalisedActivity } from '@/services/import/importService';
import { MAX_FILE_BYTES, MAX_UPLOAD_BYTES } from '@/services/import/importLimits';
import { ImportError } from '@/services/import/types';

/**
 * Turns a multipart upload into a validated, normalised activity.
 *
 * Server-only on purpose: the FIT decoder behind the registry may not be
 * shipped to browsers (its licence forbids redistribution), and the size
 * checks are only meaningful where the client cannot skip them.
 *
 * The file is data from start to finish. It is decompressed under a hard
 * output ceiling (a gzip bomb fails here), parsed by a format parser, and
 * never executed, followed, or echoed back.
 */

export interface ReadUpload {
  fileName: string;
  fileSha256: string;
  activity: NormalisedActivity;
}

/** Strips any path and bounds the length; the name only selects a parser. */
function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  return base.slice(0, 200);
}

function inflate(bytes: Uint8Array): Uint8Array {
  try {
    return gunzipSync(bytes, { maxOutputLength: MAX_FILE_BYTES });
  } catch (err: unknown) {
    if (err instanceof RangeError || (err as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
      throw new ImportError('too-large');
    }
    throw new ImportError('unreadable', 'not valid gzip');
  }
}

export async function readUpload(form: FormData): Promise<ReadUpload> {
  const file = form.get('file');
  if (!(file instanceof File)) throw new ImportError('empty');
  if (file.size > MAX_UPLOAD_BYTES) throw new ImportError('too-large');

  const raw = new Uint8Array(await file.arrayBuffer());
  const encoding = form.get('encoding');
  const bytes = encoding === 'gzip' ? inflate(raw) : raw;
  if (bytes.byteLength === 0) throw new ImportError('empty');
  if (bytes.byteLength > MAX_FILE_BYTES) throw new ImportError('too-large');

  const nameField = form.get('fileName');
  const fileName = safeFileName(typeof nameField === 'string' ? nameField : file.name);
  const parsed = defaultParserRegistry.parse({ fileName, bytes });
  return { fileName, fileSha256: sha256Hex(bytes), activity: normaliseActivity(parsed) };
}

/** A string form field, or null when absent or not text. */
export function formText(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === 'string' ? value : null;
}
