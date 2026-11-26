/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit 241eaaf, do not edit here.
 *
 * Source: horsepowr/src/services/calendar/targetBlocks.ts
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

import {
  TARGET_BLOCK_MAX_SEC,
  TARGET_BLOCK_MIN_SEC,
  TARGET_GAITS,
  TARGET_HR_MAX_BPM,
  TARGET_HR_MIN_BPM,
  TARGET_MAX_BLOCKS,
  type TargetBlock,
} from '@/services/calendar/trainingTargets';

/**
 * Training blocks as an EDITOR sees them, and the conversion to and from the
 * persisted `targets.blocks` shape.
 *
 * PURE and mirrored to the web, so "2 x 2:00 @ 165-175" is parsed and
 * validated by one implementation on both surfaces. The editor works in
 * strings (what a text input holds) and this module is the only place those
 * strings become numbers — a component never parses a duration itself.
 */

export type TargetGait = (typeof TARGET_GAITS)[number];

export type BlockDraftKind = 'steady' | 'interval';

/** One block as typed: every numeric field is the raw input string. */
export interface BlockDraft {
  kind: BlockDraftKind;
  label: string;
  /** Steady: the block's duration. Interval: one WORK bout. "m:ss" or "m". */
  duration: string;
  hrMin: string;
  hrMax: string;
  /** Interval only. */
  repeat: string;
  /** Interval only: recovery between bouts, "m:ss" or "m"; empty = none. */
  recovery: string;
  /** Steady: the block's gait. Interval: the RECOVERY gait. */
  gait: TargetGait | null;
}

export type BlockDraftError =
  | 'duration'
  | 'hrMin'
  | 'hrMax'
  | 'hrRange'
  | 'repeat'
  | 'recovery';

export interface BlockConversion {
  blocks: TargetBlock[];
  /** Per-draft field errors, same index as the input. Empty = valid. */
  errors: BlockDraftError[][];
  valid: boolean;
}

const HR_MIN = TARGET_HR_MIN_BPM;
const HR_MAX = TARGET_HR_MAX_BPM;
const REPEAT_MAX = 50;

/**
 * "2:00" -> 120, "2" -> 120 (minutes), "0:45" -> 45, "" -> null.
 * Returns NaN for text that is not a duration, so callers can tell "empty"
 * from "wrong".
 */
export function parseBlockDuration(raw: string): number | null {
  const text = raw.trim();
  if (text === '') return null;
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minutes = /^\d{1,3}([.,]\d{1,2})?$/.exec(text);
  if (minutes) return Math.round(Number(text.replace(',', '.')) * 60);
  return Number.NaN;
}

/** 120 -> "2:00", 45 -> "0:45". */
export function formatBlockDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseHr(raw: string): number | null {
  const text = raw.trim();
  if (text === '') return null;
  if (!/^\d{2,3}$/.test(text)) return Number.NaN;
  return Number(text);
}

function validHr(n: number | null): boolean {
  return n === null || (Number.isInteger(n) && n >= HR_MIN && n <= HR_MAX);
}

function validDuration(n: number | null, required: boolean): boolean {
  if (n === null) return !required;
  return (
    Number.isInteger(n) && n >= TARGET_BLOCK_MIN_SEC && n <= TARGET_BLOCK_MAX_SEC
  );
}

export function emptyBlockDraft(kind: BlockDraftKind): BlockDraft {
  return kind === 'interval'
    ? { kind, label: '', duration: '2:00', hrMin: '', hrMax: '', repeat: '2', recovery: '1:00', gait: 'walk' }
    : { kind, label: '', duration: '10:00', hrMin: '', hrMax: '', repeat: '', recovery: '', gait: null };
}

/** A persisted block back into editable strings. */
export function blockToDraft(block: TargetBlock): BlockDraft {
  if (block.kind === 'interval') {
    return {
      kind: 'interval',
      label: block.label ?? '',
      duration: formatBlockDuration(block.workDurationSec),
      hrMin: block.workHrMinBpm !== undefined ? String(block.workHrMinBpm) : '',
      hrMax: block.workHrMaxBpm !== undefined ? String(block.workHrMaxBpm) : '',
      repeat: String(block.repeat),
      recovery:
        block.recoveryDurationSec !== undefined
          ? formatBlockDuration(block.recoveryDurationSec)
          : '',
      gait: block.recoveryGait ?? null,
    };
  }
  return {
    kind: 'steady',
    label: block.label ?? '',
    duration: formatBlockDuration(block.durationSec),
    hrMin: block.hrMinBpm !== undefined ? String(block.hrMinBpm) : '',
    hrMax: block.hrMaxBpm !== undefined ? String(block.hrMaxBpm) : '',
    repeat: '',
    recovery: '',
    gait: block.gait ?? null,
  };
}

/**
 * Drafts into persisted blocks, collecting every field error rather than
 * stopping at the first, so the editor can mark all of them at once.
 */
export function draftsToBlocks(drafts: readonly BlockDraft[]): BlockConversion {
  const blocks: TargetBlock[] = [];
  const errors: BlockDraftError[][] = [];

  for (const draft of drafts.slice(0, TARGET_MAX_BLOCKS)) {
    const fieldErrors: BlockDraftError[] = [];
    const duration = parseBlockDuration(draft.duration);
    const hrMin = parseHr(draft.hrMin);
    const hrMax = parseHr(draft.hrMax);
    const label = draft.label.trim();

    if (!validDuration(duration, true)) fieldErrors.push('duration');
    if (!validHr(hrMin)) fieldErrors.push('hrMin');
    if (!validHr(hrMax)) fieldErrors.push('hrMax');
    if (
      hrMin !== null && hrMax !== null &&
      validHr(hrMin) && validHr(hrMax) && hrMin > hrMax
    ) {
      fieldErrors.push('hrRange');
    }

    if (draft.kind === 'interval') {
      const repeat = /^\d{1,2}$/.test(draft.repeat.trim())
        ? Number(draft.repeat.trim())
        : Number.NaN;
      const recovery = parseBlockDuration(draft.recovery);
      if (!(repeat >= 1 && repeat <= REPEAT_MAX)) fieldErrors.push('repeat');
      if (!validDuration(recovery, false)) fieldErrors.push('recovery');

      if (fieldErrors.length === 0 && duration !== null) {
        blocks.push({
          kind: 'interval',
          ...(label !== '' ? { label } : {}),
          repeat,
          workDurationSec: duration,
          ...(hrMin !== null ? { workHrMinBpm: hrMin } : {}),
          ...(hrMax !== null ? { workHrMaxBpm: hrMax } : {}),
          ...(recovery !== null ? { recoveryDurationSec: recovery } : {}),
          ...(draft.gait !== null && recovery !== null ? { recoveryGait: draft.gait } : {}),
        });
      }
    } else if (fieldErrors.length === 0 && duration !== null) {
      blocks.push({
        kind: 'steady',
        ...(label !== '' ? { label } : {}),
        durationSec: duration,
        ...(hrMin !== null ? { hrMinBpm: hrMin } : {}),
        ...(hrMax !== null ? { hrMaxBpm: hrMax } : {}),
        ...(draft.gait !== null ? { gait: draft.gait } : {}),
      });
    }
    errors.push(fieldErrors);
  }

  return { blocks, errors, valid: errors.every((e) => e.length === 0) };
}

/** Planned seconds of one block, recoveries included. */
export function blockDurationSec(block: TargetBlock): number {
  if (block.kind === 'steady') return block.durationSec;
  const recoveries = Math.max(0, block.repeat - 1);
  return block.repeat * block.workDurationSec + recoveries * (block.recoveryDurationSec ?? 0);
}

export function blocksDurationSec(blocks: readonly TargetBlock[]): number {
  return blocks.reduce((sum, block) => sum + blockDurationSec(block), 0);
}

/** "165-175", "≥ 165", "≤ 175" or null when the block has no HR target. */
export function formatHrRange(min: number | undefined, max: number | undefined): string | null {
  if (min !== undefined && max !== undefined) return `${min}–${max}`;
  if (min !== undefined) return `≥ ${min}`;
  if (max !== undefined) return `≤ ${max}`;
  return null;
}

/**
 * The structured summary of a block, for one line of UI. Numbers only — the
 * caller supplies the words (unit, gait name) through i18n.
 */
export interface BlockSummary {
  kind: BlockDraftKind;
  label: string | null;
  repeat: number;
  duration: string;
  hrRange: string | null;
  recovery: string | null;
  gait: TargetGait | null;
}

export function summariseBlock(block: TargetBlock): BlockSummary {
  if (block.kind === 'interval') {
    return {
      kind: 'interval',
      label: block.label ?? null,
      repeat: block.repeat,
      duration: formatBlockDuration(block.workDurationSec),
      hrRange: formatHrRange(block.workHrMinBpm, block.workHrMaxBpm),
      recovery:
        block.recoveryDurationSec !== undefined
          ? formatBlockDuration(block.recoveryDurationSec)
          : null,
      gait: block.recoveryGait ?? null,
    };
  }
  return {
    kind: 'steady',
    label: block.label ?? null,
    repeat: 1,
    duration: formatBlockDuration(block.durationSec),
    hrRange: formatHrRange(block.hrMinBpm, block.hrMaxBpm),
    recovery: null,
    gait: block.gait ?? null,
  };
}
