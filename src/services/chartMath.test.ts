import { describe, expect, it } from 'vitest';
import { distinctLabelTicks } from '@/services/chartMath';

describe('distinctLabelTicks', () => {
  it('keeps one tick per label, the first', () => {
    const hourly = [0, 6, 12, 18, 24, 30].map((h) => Date.UTC(2026, 9, 24) + h * 3_600_000);
    const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
    expect(distinctLabelTicks(hourly, day).map((t) => t.label)).toEqual(['2026-10-24', '2026-10-25']);
    expect(distinctLabelTicks(hourly, day)[1]?.tick).toBe(hourly[4]);
  });
});
