import { createHash } from 'node:crypto';

/**
 * Name-based ids (RFC 4122 v5) and content hashes — server-side (node:crypto).
 *
 * This is what makes an import idempotent WITHOUT a schema change: the same
 * file, for the same horse in the same org, always yields the same session id
 * and the same measurement ids, so a second upload finds what the first one
 * wrote instead of writing it again.
 */

/** Fixed namespace for HorsePowr activity imports. Never change it: ids derive from it. */
export const IMPORT_NAMESPACE = '0c0f6d7e-4b1a-4d2e-9f3a-5e8b7c6d1a20';

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`not a uuid: ${uuid}`);
  return Buffer.from(hex, 'hex');
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** RFC 4122 §4.3: SHA-1 over namespace + name, version 5, RFC variant. */
export function uuidV5(name: string, namespace: string): string {
  const hash = createHash('sha1').update(uuidToBytes(namespace)).update(name, 'utf8').digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The session id an import of this exact file for this horse will always get. */
export function importSessionId(orgId: string, horseId: string, fileSha256: string): string {
  return uuidV5(`${orgId}:${horseId}:${fileSha256}`, IMPORT_NAMESPACE);
}
