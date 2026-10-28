// Polar-style FIT (synthetic): a 60-minute conditioning ride in Mexico City,
// manufacturer polarElectro, record per second, HRV (RR) messages after each
// record, one 20 s strap dropout. Built with the Garmin FIT SDK encoder.
import { Encoder, Profile } from '@garmin/fitsdk';
import { writeFileSync } from 'node:fs';
const out = process.argv[2];
const start = new Date('2026-10-26T15:00:00Z'); // 09:00 in Mexico City (UTC-6, no DST)
const enc = new Encoder();
const M = Profile.MesgNum;
enc.onMesg(M.FILE_ID, { type: 'activity', manufacturer: 'polarElectro', product: 0, timeCreated: start, serialNumber: 12345 });
let lat = 19.3550, lng = -99.1620, hr = 75, t = 0, seed = 3;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
const plan = [[600, 1.6, 85], [1200, 4.2, 140], [600, 6.5, 170], [1200, 1.5, 95]];
const SC = 2 ** 31 / 180;
for (const [dur, speed, target] of plan) {
  for (let i = 0; i < dur; i++, t++) {
    const s = Math.max(0, speed + rnd() * 0.4);
    lat += (s * 0.7) / 111320; lng += (s * 0.7) / (111320 * Math.cos(lat * Math.PI / 180));
    hr += (target - hr) * 0.04 + rnd() * 2;
    const drop = t >= 1800 && t < 1820;
    const rec = { timestamp: new Date(start.getTime() + t * 1000), positionLat: Math.round(lat * SC), positionLong: Math.round(lng * SC), enhancedSpeed: s, enhancedAltitude: 2240 + 3 * Math.sin(t / 300) };
    if (!drop) rec.heartRate = Math.round(hr);
    enc.onMesg(M.RECORD, rec);
    if (!drop) { const rr = 60 / hr; enc.onMesg(M.HRV, { time: [rr] }); }
  }
}
enc.onMesg(M.SESSION, { timestamp: new Date(start.getTime() + t * 1000), startTime: start, sport: 'horsebackRiding', totalElapsedTime: t, totalTimerTime: t });
enc.onMesg(M.ACTIVITY, { timestamp: new Date(start.getTime() + t * 1000), numSessions: 1, type: 'manual', event: 'activity', eventType: 'stop' });
const bytes = enc.close();
writeFileSync(out, bytes);
console.log(`${out}: ${bytes.length} bytes, ${t} s`);
