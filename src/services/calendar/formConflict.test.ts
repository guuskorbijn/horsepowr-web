import { describe, expect, it } from 'vitest';
import { mergeFormEdits } from './formConflict';
import { emptyFormValues } from './eventFormMapper';

const base = { ...emptyFormValues({ dayKey: '2026-12-03', timeZone: 'Europe/Amsterdam' }), title: 'Farrier' };

describe('mergeFormEdits', () => {
  it('writes only my columns and keeps theirs', () => {
    const mine = { ...base, notes: 'Front shoes' };
    const theirs = { ...base, startTime: '11:00' };
    const r = mergeFormEdits(base, mine, theirs);
    expect(r.write).toEqual(['notes']);
    expect(r.conflicts).toEqual([]);
    expect(r.merged.startTime).toBe('11:00');
    expect(r.merged.notes).toBe('Front shoes');
  });

  it('reports a column both changed differently and writes nothing for it', () => {
    const mine = { ...base, startTime: '10:00', notes: 'x' };
    const theirs = { ...base, startTime: '11:00' };
    const r = mergeFormEdits(base, mine, theirs);
    expect(r.conflicts).toContain('starts_at');
    expect(r.write).toEqual(['notes']);
    expect(r.merged.startTime).toBe('11:00');
  });

  it('treats the same change on both sides as agreement', () => {
    const mine = { ...base, title: 'Farrier (Jan)' };
    const r = mergeFormEdits(base, mine, { ...mine });
    expect(r).toMatchObject({ write: [], conflicts: [] });
  });
});
