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
  type ParsedActivity,
  type ParsedGpsSample,
  type ParsedHrSample,
} from '@/services/import/types';

/**
 * GPX 1.1 — the route format. Position, elevation and time per `trkpt`; heart
 * rate only when the exporter adds the Garmin TrackPointExtension (`hr`),
 * which Polar Flow's GPX export may not. Speed is not part of GPX, so it is
 * left null here and derived from positions downstream (and said so).
 */
export const gpxParser: ActivityParser = {
  format: 'gpx',
  extensions: ['.gpx'],

  canParse(input: ActivityFileInput): boolean {
    return /<(?:\w+:)?gpx[\s>]/.test(head(input.bytes));
  },

  parse(input: ActivityFileInput): ParsedActivity {
    const doc = parseXmlSafely(input.bytes);
    if (rootName(doc) !== 'gpx') throw new ImportError('content-mismatch');

    const hr: ParsedHrSample[] = [];
    const gps: ParsedGpsSample[] = [];
    for (const track of children(doc.gpx, 'trk')) {
      for (const segment of children(track, 'trkseg')) {
        for (const point of children(segment, 'trkpt')) {
          const timestamp = isoOrNull(stringAt(point, 'time'));
          if (timestamp === null) continue;
          const lat = numberAt(point, '@_lat');
          const lng = numberAt(point, '@_lon');
          if (lat !== null && lng !== null) {
            gps.push({ timestamp, lat, lng, speedMs: null, altitudeM: numberAt(point, 'ele') });
          }
          const extensions = child(point, 'extensions');
          const bpm =
            numberAt(extensions, 'TrackPointExtension', 'hr') ?? numberAt(extensions, 'hr');
          if (bpm !== null) hr.push({ timestamp, bpm, rrMs: null });
        }
      }
    }

    const startedAt = isoOrNull(stringAt(child(doc.gpx, 'metadata'), 'time')) ?? gps[0]?.timestamp ?? hr[0]?.timestamp;
    if (startedAt === undefined || startedAt === null) throw new ImportError('no-samples');

    return {
      format: 'gpx',
      startedAt,
      hr,
      gps,
      sport: stringAt(children(doc.gpx, 'trk')[0], 'type'),
      warnings: [],
    };
  },
};
