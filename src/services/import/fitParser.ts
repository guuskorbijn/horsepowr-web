import { Decoder, Profile, Stream, type HrvMesg, type Mesg, type RecordMesg, type SessionMesg } from '@garmin/fitsdk';
import {
  ImportError,
  type ActivityFileInput,
  type ActivityParser,
  type ImportWarning,
  type ParsedActivity,
  type ParsedGpsSample,
  type ParsedHrSample,
} from '@/services/import/types';

/**
 * FIT — the binary format Polar Flow exports with the most detail, including
 * beat-to-beat (RR) intervals when the recording had them.
 *
 * Decoded with Garmin's official FIT SDK (`@garmin/fitsdk`). Its licence
 * permits use inside our own software but not redistribution, so this module
 * must only ever run server-side: it is reachable from the import route
 * handlers alone, never from a client component.
 *
 * The file's CRC is verified before anything is read; a damaged file is
 * refused rather than half-imported.
 */

const SEMICIRCLE_TO_DEG = 180 / 2 ** 31;
/** 0xFFFF / 1000 — the FIT "invalid" marker for an HRV interval, in seconds. */
const INVALID_RR_SEC = 65.535;

function toIso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return null;
}

export const fitParser: ActivityParser = {
  format: 'fit',
  extensions: ['.fit'],

  canParse(input: ActivityFileInput): boolean {
    try {
      return Decoder.isFIT(Stream.fromByteArray(input.bytes));
    } catch (err: unknown) {
      // A header the SDK cannot even inspect is simply "not FIT".
      void err;
      return false;
    }
  },

  parse(input: ActivityFileInput): ParsedActivity {
    const decoder = new Decoder(Stream.fromByteArray(input.bytes));
    if (!decoder.checkIntegrity()) throw new ImportError('unreadable', 'FIT header or CRC check failed');

    const hr: ParsedHrSample[] = [];
    const gps: ParsedGpsSample[] = [];
    let unmatchedRr = 0;

    // HRV messages carry no timestamp of their own; they follow the record
    // they belong to. The listener sees messages in file order, which is the
    // only place that order still exists.
    const onMesg = (mesgNum: number, mesg: Mesg): void => {
      if (mesgNum === Profile.MesgNum.RECORD) {
        const record = mesg as RecordMesg;
        const timestamp = toIso(record.timestamp);
        if (timestamp === null) return;
        if (typeof record.heartRate === 'number') hr.push({ timestamp, bpm: record.heartRate, rrMs: null });
        if (typeof record.positionLat === 'number' && typeof record.positionLong === 'number') {
          const speed = record.enhancedSpeed ?? record.speed;
          const altitude = record.enhancedAltitude ?? record.altitude;
          gps.push({
            timestamp,
            lat: record.positionLat * SEMICIRCLE_TO_DEG,
            lng: record.positionLong * SEMICIRCLE_TO_DEG,
            speedMs: typeof speed === 'number' ? speed : null,
            altitudeM: typeof altitude === 'number' ? altitude : null,
          });
        }
        return;
      }
      if (mesgNum === Profile.MesgNum.HRV) {
        const intervals = ((mesg as HrvMesg).time ?? [])
          .filter((sec) => sec > 0 && sec < INVALID_RR_SEC)
          .map((sec) => Math.round(sec * 1000));
        if (intervals.length === 0) return;
        const last = hr[hr.length - 1];
        if (last === undefined) {
          unmatchedRr += intervals.length;
          return;
        }
        last.rrMs = [...(last.rrMs ?? []), ...intervals];
      }
    };

    const { messages, errors } = decoder.read({ mesgListener: onMesg });
    if (errors.length > 0 && hr.length === 0 && gps.length === 0) {
      throw new ImportError('unreadable', errors[0]?.message);
    }

    const session: SessionMesg | undefined = messages.sessionMesgs?.[0];
    const startedAt = toIso(session?.startTime) ?? hr[0]?.timestamp ?? gps[0]?.timestamp;
    if (startedAt === undefined || startedAt === null) throw new ImportError('no-samples');

    const warnings: ImportWarning[] = [];
    if (unmatchedRr > 0) warnings.push({ code: 'rr-unmatched', count: unmatchedRr });
    const sport = session?.sport;

    return {
      format: 'fit',
      startedAt,
      hr,
      gps,
      sport: typeof sport === 'string' ? sport : null,
      warnings,
    };
  },
};
