/**
 * Activity import — the format-neutral shapes every parser produces.
 *
 * A new file format is ONE new `ActivityParser` registered in
 * `parserRegistry.ts`. Nothing downstream (preview, row building, writing)
 * knows which format a sample came from, which is also what makes an imported
 * session indistinguishable from a recorded one once it is stored.
 */

export type ActivityFormat = 'tcx' | 'gpx' | 'fit';

/** The raw upload, after decompression and size checks. */
export interface ActivityFileInput {
  fileName: string;
  bytes: Uint8Array;
}

export interface ParsedHrSample {
  /** UTC ISO instant. */
  timestamp: string;
  bpm: number;
  /** Beat-to-beat intervals (ms) that arrived with this sample, when the file has them. */
  rrMs: number[] | null;
}

export interface ParsedGpsSample {
  /** UTC ISO instant. */
  timestamp: string;
  lat: number;
  lng: number;
  /** m/s, from the file; null when the file has no speed for this point. */
  speedMs: number | null;
  altitudeM: number | null;
}

/** Something the trainer should know before confirming. Codes are i18n keys. */
export type ImportWarningCode =
  | 'no-hr'
  | 'no-gps'
  | 'hr-gaps'
  | 'invalid-samples-dropped'
  | 'duplicate-timestamps-dropped'
  | 'speed-derived'
  | 'multiple-activities'
  | 'rr-unmatched';

export interface ImportWarning {
  code: ImportWarningCode;
  /** A count or duration the message is about, when there is one. */
  count?: number;
  seconds?: number;
}

export interface ParsedActivity {
  format: ActivityFormat;
  /** The activity's own start (UTC ISO). May precede the first sample. */
  startedAt: string;
  hr: ParsedHrSample[];
  gps: ParsedGpsSample[];
  /** Free text from the file (e.g. "Other", "Riding"), never interpreted. */
  sport: string | null;
  warnings: ImportWarning[];
}

/** One parser per format. `parse` throws an ImportError on a file it cannot read. */
export interface ActivityParser {
  readonly format: ActivityFormat;
  /** Lower-case, with the dot: ['.tcx']. */
  readonly extensions: readonly string[];
  /** Content sniff: true only when the bytes really are this format. */
  canParse(input: ActivityFileInput): boolean;
  parse(input: ActivityFileInput): ParsedActivity;
}

/** Why an upload was refused. Codes are i18n keys; nothing from the file is echoed. */
export type ImportErrorCode =
  | 'too-large'
  | 'empty'
  | 'unsupported-extension'
  | 'content-mismatch'
  | 'unreadable'
  | 'unsafe-xml'
  | 'no-samples'
  | 'too-many-samples'
  | 'not-allowed'
  | 'horse-not-found'
  | 'write-failed';

export class ImportError extends Error {
  readonly code: ImportErrorCode;
  constructor(code: ImportErrorCode, detail?: string) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = 'ImportError';
    this.code = code;
  }
}
