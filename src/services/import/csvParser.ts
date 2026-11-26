import { zonedCivilToUtcIso } from '@/services/time/timezone';
import {
  ImportError,
  type ActivityFileInput,
  type ActivityParser,
  type ParsedActivity,
  type ParsedHrSample,
} from '@/services/import/types';

/**
 * Polar Flow's CSV export ("Export session" -> CSV).
 *
 * Layout, as Polar writes it:
 *   line 1  summary header   Name,Sport,Date,Start time,Duration,...
 *   line 2  summary values   Guus,OTHER_OUTDOOR,26-11-2026,08:00:00,01:02:03,...
 *   line 3  sample header    Sample rate,Time,HR (bpm),Speed (km/h),...
 *   line 4+ one row per sample
 *
 * Two honest limits, both surfaced rather than papered over:
 *  - The CSV has NO position columns, so a CSV import never has a route and
 *    carries the `no-gps` warning. TCX/GPX/FIT carry the route.
 *  - The start is a LOCAL wall-clock time without an offset. The uploader's
 *    time zone (sent by the browser) turns it into an instant; without a
 *    valid one it falls back to UTC.
 *
 * Columns are located BY NAME, never by position: Polar has added columns
 * between export versions.
 */

function cells(line: string): string[] {
  return line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ''));
}

function column(header: readonly string[], pattern: RegExp): number {
  return header.findIndex((h) => pattern.test(h));
}

/** "26-11-2026" or "2026-11-26" -> civil date parts. */
function parseDate(raw: string): { year: number; month: number; day: number } | null {
  const dmy = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/.exec(raw);
  if (dmy) return { day: Number(dmy[1]), month: Number(dmy[2]), year: Number(dmy[3]) };
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) return { year: Number(ymd[1]), month: Number(ymd[2]), day: Number(ymd[3]) };
  return null;
}

/** "01:02:03" -> seconds. */
function parseClock(raw: string): number | null {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(raw);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

function num(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function validZone(zone: string | undefined): string | null {
  if (zone === undefined || zone.trim() === '') return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    // An unknown zone name is not an error worth failing the import over;
    // the caller falls back to UTC.
    return null;
  }
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^﻿/, '');
}

export const csvParser: ActivityParser = {
  format: 'csv',
  extensions: ['.csv'],

  canParse(input: ActivityFileInput): boolean {
    const lines = textOf(input.bytes.subarray(0, 8192)).split(/\r?\n/);
    return (
      /start time/i.test(lines[0] ?? '') &&
      /\btime\b/i.test(lines[2] ?? '') &&
      /\bhr\b/i.test(lines[2] ?? '')
    );
  },

  parse(input: ActivityFileInput): ParsedActivity {
    const lines = textOf(input.bytes).split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 3) throw new ImportError('unreadable', 'csv has no sample rows');

    const summaryHeader = cells(lines[0] ?? '');
    const summary = cells(lines[1] ?? '');
    const sampleHeader = cells(lines[2] ?? '');

    const date = parseDate(summary[column(summaryHeader, /^date$/i)] ?? '');
    const startClock = parseClock(summary[column(summaryHeader, /^start time$/i)] ?? '');
    if (date === null || startClock === null) {
      throw new ImportError('unreadable', 'csv summary has no readable date/start time');
    }
    const startedAt = zonedCivilToUtcIso(
      {
        ...date,
        hour: Math.floor(startClock / 3600),
        minute: Math.floor((startClock % 3600) / 60),
        second: startClock % 60,
      },
      validZone(input.timeZone) ?? 'UTC',
    );
    const startMs = Date.parse(startedAt);

    const timeCol = column(sampleHeader, /^time$/i);
    const hrCol = column(sampleHeader, /^hr\b/i);
    if (timeCol < 0) throw new ImportError('unreadable', 'csv has no Time column');

    const hr: ParsedHrSample[] = [];
    let dropped = 0;
    let duplicates = 0;
    let lastOffset = -1;
    for (const line of lines.slice(3)) {
      const row = cells(line);
      const offset = parseClock(row[timeCol] ?? '');
      if (offset === null) {
        dropped += 1;
        continue;
      }
      if (offset <= lastOffset) {
        duplicates += 1;
        continue;
      }
      lastOffset = offset;
      const bpm = hrCol >= 0 ? num(row[hrCol]) : null;
      if (bpm === null || bpm === 0) continue;
      if (bpm < 20 || bpm > 300) {
        dropped += 1;
        continue;
      }
      hr.push({
        timestamp: new Date(startMs + offset * 1000).toISOString(),
        bpm: Math.round(bpm),
        rrMs: null,
      });
    }

    const warnings: ParsedActivity['warnings'] = [{ code: 'no-gps' }];
    if (hr.length === 0) warnings.push({ code: 'no-hr' });
    if (dropped > 0) warnings.push({ code: 'invalid-samples-dropped', count: dropped });
    if (duplicates > 0) warnings.push({ code: 'duplicate-timestamps-dropped', count: duplicates });

    const sportCol = column(summaryHeader, /^sport$/i);
    const sport = sportCol >= 0 ? (summary[sportCol] ?? '') : '';
    return { format: 'csv', startedAt, hr, gps: [], sport: sport === '' ? null : sport, warnings };
  },
};
