import { describe, expect, it } from 'vitest';
// Ported verbatim from horsepowr/src/schemas/__tests__/plannedSnapshot.test.ts (mobile commit cc497bd) so the vendored
// module is held to the exact same golden cases on both sides.
/**
 * The frozen plan stored on a session. Versioned because it is persisted data
 * that outlives any app build.
 */

import {
  PLANNED_SNAPSHOT_VERSION,
  parsePlannedSnapshot,
  parsePlannedSnapshotOrNull,
  snapshotHasNothingToCompare,
} from '@/services/calendar/plannedSnapshot';

const valid = {
  version: 1,
  targets: { version: 1, hrMinBpm: 150, hrMaxBpm: 170, durationMin: 45 },
  plannedDurationMin: 45,
  durationSource: 'targets',
  occurrenceStart: '2026-11-04T08:00:00.000Z',
  capturedAt: '2026-11-04T08:00:12.000Z',
};

describe('parsePlannedSnapshot', () => {
  it('accepts a complete snapshot', () => {
    expect(parsePlannedSnapshot(valid).ok).toBe(true);
  });

  it('accepts a snapshot with no targets (duration-only plan)', () => {
    expect(
      parsePlannedSnapshot({ ...valid, targets: null, durationSource: 'slot' }).ok,
    ).toBe(true);
  });

  it('accepts a one-off plan, which has no occurrence', () => {
    expect(parsePlannedSnapshot({ ...valid, occurrenceStart: null }).ok).toBe(true);
  });

  it('REJECTS a payload with no version', () => {
    const { version: _version, ...withoutVersion } = valid;
    void _version;
    expect(parsePlannedSnapshot(withoutVersion).ok).toBe(false);
  });

  it('rejects a version this build does not speak', () => {
    expect(parsePlannedSnapshot({ ...valid, version: 2 }).ok).toBe(false);
  });

  it('rejects an unknown duration source', () => {
    expect(parsePlannedSnapshot({ ...valid, durationSource: 'vibes' }).ok).toBe(
      false,
    );
  });

  it('rejects an implausible planned duration', () => {
    expect(parsePlannedSnapshot({ ...valid, plannedDurationMin: 0 }).ok).toBe(false);
    expect(parsePlannedSnapshot({ ...valid, plannedDurationMin: 10_000 }).ok).toBe(
      false,
    );
  });

  it('rejects an invalid nested target, naming the field', () => {
    const result = parsePlannedSnapshot({
      ...valid,
      targets: { version: 1, hrMinBpm: 180, hrMaxBpm: 120 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('targets');
  });

  it('rejects non-objects', () => {
    for (const input of [null, undefined, 'snapshot', 42, []]) {
      expect(parsePlannedSnapshot(input).ok).toBe(false);
    }
  });
});

describe('parsePlannedSnapshotOrNull', () => {
  it('passes null and undefined through', () => {
    expect(parsePlannedSnapshotOrNull(null)).toBeNull();
    expect(parsePlannedSnapshotOrNull(undefined)).toBeNull();
  });

  it('degrades one bad snapshot to null instead of throwing', () => {
    // Costs that session its comparison card, never the results screen.
    expect(
      parsePlannedSnapshotOrNull({ version: 9 }, { sessionId: 'session-1' }),
    ).toBeNull();
  });

  it('returns the parsed snapshot for a good row', () => {
    expect(parsePlannedSnapshotOrNull(valid)?.version).toBe(
      PLANNED_SNAPSHOT_VERSION,
    );
  });
});

describe('snapshotHasNothingToCompare', () => {
  it('is false when there is a target range', () => {
    const parsed = parsePlannedSnapshot(valid);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(snapshotHasNothingToCompare(parsed.snapshot)).toBe(false);
  });

  it('is false when there is only a duration', () => {
    expect(
      snapshotHasNothingToCompare({
        version: 1,
        targets: null,
        plannedDurationMin: 45,
        durationSource: 'slot',
        occurrenceStart: null,
        capturedAt: valid.capturedAt,
      }),
    ).toBe(false);
  });

  it('is true when the plan said nothing measurable', () => {
    expect(
      snapshotHasNothingToCompare({
        version: 1,
        targets: null,
        plannedDurationMin: null,
        durationSource: null,
        occurrenceStart: null,
        capturedAt: valid.capturedAt,
      }),
    ).toBe(true);
  });
});
