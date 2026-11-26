/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit 16f41a2, do not edit here.
 *
 * Source: horsepowr/src/services/calendar/blockTimeline.ts
 *
 * CLAUDE.md forbids importing the RN repo as a build dependency, and Vercel
 * builds this repo alone, so shared domain logic is copied rather than linked.
 * The copy is deliberate and checked: `npm run check:mirror` fails when this
 * file and its source have drifted, so the duplication is visible instead of
 * silent. Fix a bug in the mobile repo and re-run the mirror; never patch here.
 *
 * These modules are PURE on purpose — that is what makes them safe to mirror.
 * Anything touching Supabase, storage or React stays on its own side.
 */

import type { TargetBlock } from '@/services/calendar/trainingTargets';

/**
 * A plan's blocks laid out on the clock: "0:00–10:00 warm-up, 10:00–25:00
 * trot, 25:00–27:00 interval 1, 27:00–28:00 recovery, ...".
 *
 * PURE and mirrored to the web. The phone uses it live ("Interval 2 of 2 ·
 * 0:48 left", a buzz at every change); the web draws the same segments as
 * bands behind the heart-rate chart. Positions are PLANNED time from the
 * start of the recording — the plan, not a detection of what was ridden.
 */

export type SegmentKind = 'steady' | 'work' | 'recovery';

export interface TimelineSegment {
  blockIndex: number;
  kind: SegmentKind;
  /** For interval work/recovery: which repeat, 1-based. */
  repeat: number | null;
  repeatsTotal: number | null;
  label: string | null;
  startSec: number;
  endSec: number;
  hrMinBpm: number | null;
  hrMaxBpm: number | null;
  gait: string | null;
}

export function blockTimeline(blocks: readonly TargetBlock[]): TimelineSegment[] {
  const out: TimelineSegment[] = [];
  let t = 0;
  blocks.forEach((block, blockIndex) => {
    if (block.kind === 'steady') {
      out.push({
        blockIndex,
        kind: 'steady',
        repeat: null,
        repeatsTotal: null,
        label: block.label ?? null,
        startSec: t,
        endSec: t + block.durationSec,
        hrMinBpm: block.hrMinBpm ?? null,
        hrMaxBpm: block.hrMaxBpm ?? null,
        gait: block.gait ?? null,
      });
      t += block.durationSec;
      return;
    }
    for (let r = 1; r <= block.repeat; r++) {
      out.push({
        blockIndex,
        kind: 'work',
        repeat: r,
        repeatsTotal: block.repeat,
        label: block.label ?? null,
        startSec: t,
        endSec: t + block.workDurationSec,
        hrMinBpm: block.workHrMinBpm ?? null,
        hrMaxBpm: block.workHrMaxBpm ?? null,
        gait: null,
      });
      t += block.workDurationSec;
      const rec = block.recoveryDurationSec;
      if (r < block.repeat && rec !== undefined && rec > 0) {
        out.push({
          blockIndex,
          kind: 'recovery',
          repeat: r,
          repeatsTotal: block.repeat,
          label: block.label ?? null,
          startSec: t,
          endSec: t + rec,
          hrMinBpm: null,
          hrMaxBpm: null,
          gait: block.recoveryGait ?? null,
        });
        t += rec;
      }
    }
  });
  return out;
}

export interface TimelinePosition {
  /** Null before the first or after the last segment. */
  current: TimelineSegment | null;
  next: TimelineSegment | null;
  /** Seconds left in the current segment. */
  remainingSec: number;
  /** 0..1 through the current segment. */
  progress: number;
  /** Index into the timeline, -1 when outside it. */
  index: number;
  finished: boolean;
}

export function positionAt(timeline: readonly TimelineSegment[], elapsedSec: number): TimelinePosition {
  const index = timeline.findIndex((s) => elapsedSec >= s.startSec && elapsedSec < s.endSec);
  const last = timeline[timeline.length - 1];
  if (index < 0) {
    return {
      current: null,
      next: elapsedSec < (timeline[0]?.startSec ?? 0) ? (timeline[0] ?? null) : null,
      remainingSec: 0,
      progress: 0,
      index: -1,
      finished: last !== undefined && elapsedSec >= last.endSec,
    };
  }
  const current = timeline[index] as TimelineSegment;
  const span = current.endSec - current.startSec;
  return {
    current,
    next: timeline[index + 1] ?? null,
    remainingSec: Math.max(0, Math.ceil(current.endSec - elapsedSec)),
    progress: span <= 0 ? 1 : (elapsedSec - current.startSec) / span,
    index,
    finished: false,
  };
}
