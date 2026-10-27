import {
  comparePlannedVsActual,
  type PlannedVsActual,
} from '@/services/calendar/plannedVsActualService';
import {
  parsePlannedSnapshotOrNull,
  snapshotHasNothingToCompare,
} from '@/services/calendar/plannedSnapshot';
import type { MeasurementRow, SessionRow } from '@/types/db';

/**
 * What the session page can say about the plan a session was ridden against.
 *
 * Built ONLY from the snapshot frozen on the session row at start, never from
 * the live calendar event — the same rule as mobile, for the same reason: a
 * plan edited this evening must not rewrite this afternoon's comparison.
 *
 * The snapshot column is part of the Phase 2 migration, which is a proposal
 * until Guus applies it. Until then every session reads as `unplanned` or
 * `linked-without-snapshot`, and nothing on this path fails: the comparison
 * appears on its own the day the column starts arriving.
 */
export type PlannedComparison =
  | { kind: 'unplanned' }
  /** Started from a plan (planned_event_id is live), but no snapshot to compare against. */
  | { kind: 'linked-without-snapshot'; plannedEventId: string }
  | {
      kind: 'compared';
      plannedEventId: string;
      comparison: PlannedVsActual;
      /** The target band for the HR chart; null sides are unbounded. */
      targetBand: { minBpm: number | null; maxBpm: number | null } | null;
    };

export function buildPlannedComparison(
  session: SessionRow,
  rows: readonly MeasurementRow[],
  maxHr: number,
): PlannedComparison {
  const plannedEventId = session.planned_event_id ?? null;
  if (plannedEventId === null) return { kind: 'unplanned' };

  const snapshot = parsePlannedSnapshotOrNull(session.planned_targets_snapshot, {
    sessionId: session.id,
  });
  if (snapshot === null || snapshotHasNothingToCompare(snapshot)) {
    return { kind: 'linked-without-snapshot', plannedEventId };
  }

  const comparison = comparePlannedVsActual({
    targets: snapshot.targets,
    plannedDurationMin: snapshot.plannedDurationMin,
    measurements: rows,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    maxHr,
  });
  const minBpm = snapshot.targets?.hrMinBpm ?? null;
  const maxBpm = snapshot.targets?.hrMaxBpm ?? null;
  return {
    kind: 'compared',
    plannedEventId,
    comparison,
    targetBand: minBpm === null && maxBpm === null ? null : { minBpm, maxBpm },
  };
}
