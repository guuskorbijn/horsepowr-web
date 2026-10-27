import { describe, expect, it } from 'vitest';
import { isDateOnly, resolveBoundMs, resolveRange } from '@/services/time/dateBounds';

describe('dateBounds', () => {
  it('a date-only range covers whole UTC days, end exclusive', () => {
    expect(resolveRange('2026-10-25', '2026-10-25')).toEqual({
      startUtc: '2026-10-25T00:00:00.000Z',
      endUtc: '2026-10-26T00:00:00.000Z',
    });
  });

  it('a datetime `to` is inclusive of that exact instant', () => {
    const end = resolveBoundMs('2026-10-25T05:10:00Z', 'end');
    expect(end).toBe(Date.parse('2026-10-25T05:10:00Z') + 1);
  });

  it('rejects impossible and unparseable dates instead of rolling them over', () => {
    expect(resolveBoundMs('2026-02-30', 'start')).toBeNull();
    expect(resolveBoundMs('next week', 'end')).toBeNull();
    expect(() => resolveRange('2026-02-30', '2026-03-01')).toThrow(/"from"/);
    expect(() => resolveRange('2026-03-01', 'soon')).toThrow(/"to"/);
  });

  it('rejects a reversed range', () => {
    expect(() => resolveRange('2026-10-26', '2026-10-25')).toThrow(/before/);
  });

  it('recognises date-only text', () => {
    expect(isDateOnly(' 2026-10-25 ')).toBe(true);
    expect(isDateOnly('2026-10-25T00:00:00Z')).toBe(false);
  });
});
