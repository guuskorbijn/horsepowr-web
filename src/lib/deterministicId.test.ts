import { describe, expect, it } from 'vitest';
import { importSessionId, sha256Hex, uuidV5 } from '@/lib/deterministicId';

describe('deterministic ids', () => {
  it('matches the RFC 4122 v5 reference vector', () => {
    // DNS namespace, "www.example.com" -> the widely published v5 result.
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  it('hashes bytes with SHA-256', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('gives the same file the same session id per horse, and a different one per horse or org', () => {
    const a = importSessionId('org-a', 'horse-1', 'f00d');
    expect(importSessionId('org-a', 'horse-1', 'f00d')).toBe(a);
    expect(importSessionId('org-a', 'horse-2', 'f00d')).not.toBe(a);
    expect(importSessionId('org-b', 'horse-1', 'f00d')).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
