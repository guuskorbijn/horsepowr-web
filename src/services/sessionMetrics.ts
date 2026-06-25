/**
 * Session metrics — DESCRIPTIVE aggregates from raw measurement rows. These are
 * measured facts only (duration, distance, avg/peak HR, speed, altitude gain).
 * No judgments, grades, baselines or predictions. Pure functions.
 */
import type { MeasurementRow, SessionRow } from '@/types/db';
import type { SessionMetrics } from '@/types/view';

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres between two lat/lng points. Shared by the
 *  metrics, effort and gradient services so distance is computed identically. */
export function haversineMetres(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function durationMs(session: SessionRow, rows: MeasurementRow[]): number {
  const start = new Date(session.started_at).getTime();
  if (session.ended_at) {
    return Math.max(0, new Date(session.ended_at).getTime() - start);
  }
  // Fall back to the last measurement timestamp for an unfinished session.
  let lastTs = start;
  for (const r of rows) {
    const t = new Date(r.timestamp).getTime();
    if (t > lastTs) lastTs = t;
  }
  return Math.max(0, lastTs - start);
}

export function computeSessionMetrics(
  session: SessionRow,
  rows: MeasurementRow[],
): SessionMetrics {
  const hrValues: number[] = [];
  const speedValues: number[] = [];
  const gps: Array<{ lat: number; lng: number; alt: number | null }> = [];

  for (const r of rows) {
    if (r.hr_bpm !== null && Number.isFinite(r.hr_bpm)) hrValues.push(r.hr_bpm);
    if (r.speed_ms !== null && Number.isFinite(r.speed_ms)) speedValues.push(r.speed_ms);
    if (r.lat !== null && r.lng !== null) {
      gps.push({ lat: r.lat, lng: r.lng, alt: r.altitude_m });
    }
  }

  let distanceM: number | null = null;
  let altitudeGainM: number | null = null;
  if (gps.length >= 2) {
    distanceM = 0;
    altitudeGainM = 0;
    for (let i = 1; i < gps.length; i++) {
      const prev = gps[i - 1];
      const cur = gps[i];
      if (!prev || !cur) continue;
      distanceM += haversineMetres(prev.lat, prev.lng, cur.lat, cur.lng);
      if (prev.alt !== null && cur.alt !== null && cur.alt > prev.alt) {
        altitudeGainM += cur.alt - prev.alt;
      }
    }
  }

  const sum = (xs: number[]) => xs.reduce((acc, x) => acc + x, 0);

  return {
    durationMs: durationMs(session, rows),
    distanceM,
    avgHr: hrValues.length ? sum(hrValues) / hrValues.length : null,
    peakHr: hrValues.length ? Math.max(...hrValues) : null,
    minHr: hrValues.length ? Math.min(...hrValues) : null,
    avgSpeedMs: speedValues.length ? sum(speedValues) / speedValues.length : null,
    maxSpeedMs: speedValues.length ? Math.max(...speedValues) : null,
    altitudeGainM,
    hrSampleCount: hrValues.length,
    gpsSampleCount: gps.length,
  };
}
