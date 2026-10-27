import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { MAX_FILE_BYTES, MAX_UPLOAD_BYTES } from '@/services/import/importLimits';
import { ImportError } from '@/services/import/types';

vi.mock('server-only', () => ({}));
const { readUpload } = await import('@/services/import/importRequest.server');

const tcx = new Uint8Array(readFileSync(join(__dirname, '__fixtures__', 'ride.tcx')));

function form(bytes: Uint8Array, fileName: string, encoding: 'gzip' | 'identity'): FormData {
  const data = new FormData();
  // Copied into a fresh ArrayBuffer: Blob does not take a view over a shared buffer.
  data.set('file', new Blob([new Uint8Array(bytes).buffer]), fileName);
  data.set('fileName', fileName);
  data.set('encoding', encoding);
  return data;
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ImportError) return err.code;
    throw err;
  }
  throw new Error('expected a refusal');
}

describe('readUpload', () => {
  it('inflates a gzipped upload and hashes the ORIGINAL bytes', async () => {
    const plain = await readUpload(form(tcx, 'ride.tcx', 'identity'));
    const zipped = await readUpload(form(gzipSync(tcx), 'ride.tcx', 'gzip'));
    expect(zipped.fileSha256).toBe(plain.fileSha256);
    expect(zipped.activity.hr).toHaveLength(92);
  });

  it('strips a path from the file name', async () => {
    const upload = await readUpload(form(tcx, '../../etc/ride.tcx', 'identity'));
    expect(upload.fileName).toBe('ride.tcx');
  });

  it('refuses an upload over the request limit before reading it', async () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    expect(await refusal(readUpload(form(big, 'ride.tcx', 'identity')))).toBe('too-large');
  });

  it('refuses a gzip bomb: inflation stops at the file ceiling', async () => {
    const bomb = gzipSync(new Uint8Array(MAX_FILE_BYTES + 1024)); // ~25 KB compressed
    expect(bomb.byteLength).toBeLessThan(MAX_UPLOAD_BYTES);
    expect(await refusal(readUpload(form(bomb, 'ride.tcx', 'gzip')))).toBe('too-large');
  });

  it('refuses something claiming gzip that is not', async () => {
    expect(await refusal(readUpload(form(tcx, 'ride.tcx', 'gzip')))).toBe('unreadable');
  });

  it('refuses a request with no file', async () => {
    expect(await refusal(readUpload(new FormData()))).toBe('empty');
  });
});
