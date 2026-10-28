import { XMLParser } from 'fast-xml-parser';
import { ImportError } from '@/services/import/types';
import { MAX_FILE_BYTES } from '@/services/import/importLimits';

/**
 * XML for TCX/GPX, parsed so that a hostile file can do nothing but fail.
 *
 * - No DTD at all: a `<!DOCTYPE` or `<!ENTITY` declaration is refused before
 *   parsing. TCX and GPX never need one, and refusing outright closes XXE
 *   (external entities) and entity-expansion bombs in one rule instead of
 *   trusting a parser flag.
 * - Entity processing is off in the parser as well (defense in depth).
 * - Size is bounded before decoding.
 * - Nothing in the file is ever executed, followed, or treated as an
 *   instruction: values are read as plain strings and numbers.
 */

const DTD = /<!DOCTYPE|<!ENTITY/i;

export type XmlNode = Record<string, unknown>;

export function parseXmlSafely(bytes: Uint8Array): XmlNode {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new ImportError('too-large');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (err: unknown) {
    throw new ImportError('unreadable', err instanceof Error ? err.message : 'not UTF-8');
  }
  if (DTD.test(text)) throw new ImportError('unsafe-xml', 'DTD declarations are not accepted');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    processEntities: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    // Repeated elements are arrays wherever the formats allow repetition, so
    // a one-trackpoint file has the same shape as a ten-thousand-point one.
    isArray: (name) => REPEATABLE.has(name),
  });
  try {
    return parser.parse(text) as XmlNode;
  } catch (err: unknown) {
    throw new ImportError('unreadable', err instanceof Error ? err.message : 'malformed XML');
  }
}

const REPEATABLE = new Set([
  // TCX
  'Activity', 'Lap', 'Track', 'Trackpoint',
  // GPX
  'trk', 'trkseg', 'trkpt',
]);

/* ---------------------------------------------- typed access to parsed XML */

export function child(node: unknown, key: string): unknown {
  return node !== null && typeof node === 'object' ? (node as XmlNode)[key] : undefined;
}

export function children(node: unknown, key: string): unknown[] {
  const value = child(node, key);
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Text content of an element (or attribute), whether parsed as a scalar or an object with #text. */
export function text(node: unknown): string | null {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  const inner = child(node, '#text');
  return typeof inner === 'string' || typeof inner === 'number' ? String(inner) : null;
}

export function numberAt(node: unknown, ...path: string[]): number | null {
  let current: unknown = node;
  for (const key of path) current = child(current, key);
  const raw = text(current);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function stringAt(node: unknown, ...path: string[]): string | null {
  let current: unknown = node;
  for (const key of path) current = child(current, key);
  return text(current);
}

/** The single root element's name, or null. */
export function rootName(doc: XmlNode): string | null {
  const names = Object.keys(doc).filter((key) => !key.startsWith('?'));
  return names.length === 1 ? (names[0] ?? null) : null;
}

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * A timestamp from the file as UTC ISO, or null when it does not parse.
 * TCX and GPX times are UTC by specification; one written without a zone
 * designator is read as UTC too, never as the server's local time.
 */
export function isoOrNull(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  const ms = Date.parse(HAS_ZONE.test(trimmed) ? trimmed : `${trimmed}Z`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** The first `limit` bytes as text, for a cheap content sniff before a full parse. */
export function head(bytes: Uint8Array, limit = 4096): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, limit));
}
