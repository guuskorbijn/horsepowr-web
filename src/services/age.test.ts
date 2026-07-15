import { describe, it, expect } from 'vitest';
import { deriveAgeYears, formatAge } from '@/services/age';

const NOW = new Date('2026-07-15T12:00:00.000Z');

describe('deriveAgeYears', () => {
  it('returns null for missing / invalid / future dates', () => {
    expect(deriveAgeYears(null, NOW)).toBeNull();
    expect(deriveAgeYears('', NOW)).toBeNull();
    expect(deriveAgeYears('not-a-date', NOW)).toBeNull();
    expect(deriveAgeYears('2030-01-01', NOW)).toBeNull();
  });

  it('counts whole years after the birthday has passed this year', () => {
    expect(deriveAgeYears('2014-01-01', NOW)).toBe(12);
  });

  it('does not count the current year before the birthday', () => {
    // Birthday later in 2026 (Dec) → still 11, not 12.
    expect(deriveAgeYears('2014-12-31', NOW)).toBe(11);
  });

  it('counts the birthday itself', () => {
    expect(deriveAgeYears('2014-07-15', NOW)).toBe(12);
  });

  it('handles a Feb-29 (leap day) date of birth', () => {
    expect(deriveAgeYears('2016-02-29', NOW)).toBe(10);
    expect(deriveAgeYears('2016-02-29', new Date('2020-02-28T12:00:00.000Z'))).toBe(3);
  });
});

describe('formatAge', () => {
  it('uses a singular label at one year', () => {
    expect(formatAge('2025-07-15', NOW)).toBe('1 yr');
  });

  it('uses a plural label otherwise, and null when unknown', () => {
    expect(formatAge('2014-01-01', NOW)).toBe('12 yr');
    expect(formatAge(null, NOW)).toBeNull();
  });
});
