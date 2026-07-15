import { describe, it, expect } from 'vitest';
import { en } from './en';
import { nl } from './nl';
import { es } from './es';
import { translate } from './index';

/** Collects every leaf key path (string leaves). */
function keyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') out.push(...keyPaths(value, path));
    else out.push(path);
  }
  return out.sort();
}

const enPaths = keyPaths(en);

describe('web i18n parity', () => {
  it('en has a non-trivial key set', () => {
    expect(enPaths.length).toBeGreaterThan(50);
  });

  it.each([
    ['nl', nl],
    ['es', es],
  ])('%s has exactly the same keys as en', (_name, resource) => {
    const paths = keyPaths(resource);
    const missing = enPaths.filter((p) => !paths.includes(p));
    const extra = paths.filter((p) => !enPaths.includes(p));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });
});

describe('translate() fallback chain', () => {
  it('resolves per locale', () => {
    expect(translate('nav.horses', 'en')).toBe('Horses');
    expect(translate('nav.horses', 'nl')).toBe('Paarden');
    expect(translate('horses.sex.mare', 'nl')).toBe('Merrie');
  });

  it('falls back to English for the untranslated es scaffold', () => {
    expect(translate('nav.horses', 'es')).toBe('Horses');
  });

  it('falls back to the key itself when missing everywhere', () => {
    expect(translate('nope.missing', 'nl')).toBe('nope.missing');
  });
});
