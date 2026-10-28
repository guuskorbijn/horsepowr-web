// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PlannedVsActualCard } from '@/components/session/PlannedVsActualCard';
import type { PlannedComparison } from '@/services/calendar/plannedComparison';

afterEach(cleanup);

const compared: PlannedComparison = {
  kind: 'compared',
  plannedEventId: 'evt-1',
  targetBand: { minBpm: 150, maxBpm: 170 },
  comparison: {
    duration: { plannedMs: 45 * 60_000, measuredMs: 48 * 60_000, deltaMs: 3 * 60_000 },
    hr: {
      targetMinBpm: 150,
      targetMaxBpm: 170,
      measuredAvgBpm: 158,
      measuredPeakBpm: 190,
      insideMs: 600_000,
      belowMs: 200_000,
      aboveMs: 200_000,
      coveredMs: 1_000_000,
      insidePct: 60,
      belowPct: 20,
      abovePct: 20,
      targetZones: ['z3', 'z4'],
    },
    hrOmittedReason: null,
    coverage: {
      coveredMs: 1_000_000,
      durationMs: 48 * 60_000,
      coveragePct: 34.7,
      uncountedGapMs: 120_000,
      uncountedGapCount: 2,
    },
  },
};

describe('PlannedVsActualCard', () => {
  it('renders nothing for an unplanned session', () => {
    const { container } = render(<PlannedVsActualCard planned={{ kind: 'unplanned' }} maxHr={220} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows numbers with Z labels, the signed delta and the gaps, and no verdict colours', () => {
    const { container } = render(<PlannedVsActualCard planned={compared} maxHr={220} />);
    expect(screen.getByText('150–170 bpm · Z3–Z4')).toBeDefined();
    expect(screen.getByText('158 bpm · Z3')).toBeDefined();
    expect(screen.getByText('48:00 (+3:00)')).toBeDefined();
    expect(screen.getByText(/2 sample gaps longer than 10 s/)).toBeDefined();
    expect(screen.getByText(/35% of the session/)).toBeDefined();
    expect(container.innerHTML).not.toMatch(/success|danger|text-green|text-red/);
  });

  it('says so when the session is linked but no snapshot was saved', () => {
    render(<PlannedVsActualCard planned={{ kind: 'linked-without-snapshot', plannedEventId: 'evt-1' }} maxHr={220} />);
    expect(screen.getByText(/nothing to compare against/)).toBeDefined();
  });
});
