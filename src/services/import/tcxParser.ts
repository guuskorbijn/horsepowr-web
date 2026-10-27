import {
  child,
  children,
  head,
  isoOrNull,
  numberAt,
  parseXmlSafely,
  rootName,
  stringAt,
} from '@/services/import/xmlSafe';
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
 * Garmin Training Center XML — Polar Flow's richest text export.
 *
 * Read per Trackpoint: Time, HeartRateBpm/Value, Position (degrees),
 * AltitudeMeters, and the ActivityExtension `TPX/Speed` (m/s) when present.
 * Namespace prefixes are stripped by the XML layer, so `ns3:TPX` and `TPX`
 * read the same. Only the first Activity is imported; more is a warning.
 */
export const tcxParser: ActivityParser = {
  format: 'tcx',
  extensions: ['.tcx'],

  canParse(input: ActivityFileInput): boolean {
    return /<(?:\w+:)?TrainingCenterDatabase[\s>]/.test(head(input.bytes));
  },

  parse(input: ActivityFileInput): ParsedActivity {
    const doc = parseXmlSafely(input.bytes);
    if (rootName(doc) !== 'TrainingCenterDatabase') throw new ImportError('content-mismatch');

    const activities = children(child(doc.TrainingCenterDatabase, 'Activities'), 'Activity');
    const activity = activities[0];
    if (activity === undefined) throw new ImportError('no-samples', 'no Activity element');

    const warnings: ImportWarning[] = [];
    if (activities.length > 1) warnings.push({ code: 'multiple-activities', count: activities.length });

    const hr: ParsedHrSample[] = [];
    const gps: ParsedGpsSample[] = [];
    for (const lap of children(activity, 'Lap')) {
      for (const track of children(lap, 'Track')) {
        for (const point of children(track, 'Trackpoint')) {
          const timestamp = isoOrNull(stringAt(point, 'Time'));
          if (timestamp === null) continue;
          const bpm = numberAt(point, 'HeartRateBpm', 'Value');
          if (bpm !== null) hr.push({ timestamp, bpm, rrMs: null });
          const lat = numberAt(point, 'Position', 'LatitudeDegrees');
          const lng = numberAt(point, 'Position', 'LongitudeDegrees');
          if (lat !== null && lng !== null) {
            gps.push({
              timestamp,
              lat,
              lng,
              speedMs: numberAt(point, 'Extensions', 'TPX', 'Speed'),
              altitudeM: numberAt(point, 'AltitudeMeters'),
            });
          }
        }
      }
    }

    const firstLapStart = isoOrNull(stringAt(children(activity, 'Lap')[0], '@_StartTime'));
    const startedAt =
      isoOrNull(stringAt(activity, 'Id')) ?? firstLapStart ?? hr[0]?.timestamp ?? gps[0]?.timestamp;
    if (startedAt === undefined || startedAt === null) throw new ImportError('no-samples');

    return {
      format: 'tcx',
      startedAt,
      hr,
      gps,
      sport: stringAt(activity, '@_Sport'),
      warnings,
    };
  },
};
