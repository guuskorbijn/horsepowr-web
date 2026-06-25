/**
 * Recovery service — the MEASURED HR descent after the last detected work bout.
 * It plots HR against time-since-effort and reads the drop at +1/+5/+10 min, in
 * bpm and %. That is all it does.
 *
 * Explicitly NO score, NO Better/Normal label, NO judgment. Where the session
 * ended before 10 minutes of post-effort data exist, the missing marks are
 * reported as "not recorded" — never fabricated. The interpretation is the
 * analyst's. Pure functions; tested against fixtures.
 */
import type { MeasurementRow } from '@/types/db';
import type { ChartPoint, Effort } from '@/types/view';
import { RECOVERY_MARKS_SEC, RECOVERY_MARK_TOLERANCE_MS } from '@/constants/recovery';

export interface RecoveryMark {
  atSec: number;
  /** Measured HR at this mark, or null when not recorded. */
  hr: number | null;
  /** Drop from the effort's peak HR (bpm), or null when not recorded. */
  dropBpm: number | null;
  /** Drop as a percentage of the peak HR, or null when not recorded. */
  dropPct: number | null;
  recorded: boolean;
}

export interface RecoveryDescent {
  /** ms elapsed from session start where recovery begins (end of last effort). */
  startTs: number;
  /** Reference peak HR of the last work bout. */
  peakHr: number;
  /** HR vs time-since-recovery-start (point.t is ms from startTs). */
  curve: ChartPoint[];
  marks: RecoveryMark[];
}

interface HrSample {
  t: number;
  hr: number;
}

function hrSamples(rows: MeasurementRow[], startMs: number): HrSample[] {
  const out: HrSample[] = [];
  for (const r of rows) {
    if (r.hr_bpm === null || !Number.isFinite(r.hr_bpm)) continue;
    out.push({ t: new Date(r.timestamp).getTime() - startMs, hr: r.hr_bpm });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

function lastWorkEffort(efforts: Effort[]): Effort | null {
  for (let i = efforts.length - 1; i >= 0; i--) {
    const e = efforts[i]!;
    if (e.kind === 'work') return e;
  }
  return null;
}

/**
 * Builds the recovery descent after the last detected work bout. Returns null
 * when there is no work bout or the effort has no measured peak HR.
 */
export function buildRecoveryDescent(
  rows: MeasurementRow[],
  startedAt: string,
  efforts: Effort[],
): RecoveryDescent | null {
  const effort = lastWorkEffort(efforts);
  if (!effort || effort.peakHr === null) return null;

  const startMs = new Date(startedAt).getTime();
  const samples = hrSamples(rows, startMs);
  const startTs = effort.endTs;
  const peakHr = effort.peakHr;

  const post = samples.filter((s) => s.t >= startTs);
  const curve: ChartPoint[] = post.map((s) => ({ t: s.t - startTs, v: s.hr }));
  const lastT = post.length > 0 ? post[post.length - 1]!.t : startTs;

  const marks: RecoveryMark[] = RECOVERY_MARKS_SEC.map((atSec) => {
    const targetT = startTs + atSec * 1000;
    // Honest "not recorded" when the recording stopped before this mark.
    if (targetT > lastT + RECOVERY_MARK_TOLERANCE_MS) {
      return { atSec, hr: null, dropBpm: null, dropPct: null, recorded: false };
    }
    const nearest = nearestSample(post, targetT);
    if (!nearest || Math.abs(nearest.t - targetT) > RECOVERY_MARK_TOLERANCE_MS) {
      return { atSec, hr: null, dropBpm: null, dropPct: null, recorded: false };
    }
    const dropBpm = peakHr - nearest.hr;
    return {
      atSec,
      hr: nearest.hr,
      dropBpm,
      dropPct: peakHr > 0 ? (dropBpm / peakHr) * 100 : null,
      recorded: true,
    };
  });

  return { startTs, peakHr, curve, marks };
}

function nearestSample(samples: HrSample[], t: number): HrSample | null {
  let best: HrSample | null = null;
  let bestGap = Infinity;
  for (const s of samples) {
    const gap = Math.abs(s.t - t);
    if (gap < bestGap) {
      bestGap = gap;
      best = s;
    }
  }
  return best;
}
