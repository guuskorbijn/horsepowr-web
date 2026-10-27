/**
 * Hard limits on an activity upload. Each one is a refusal, never a cut:
 * a file over a limit is rejected with a reason, not silently truncated.
 */

/** Decompressed file size. A three-hour 1 Hz TCX is ~6 MB; 25 MB is generous. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * What one request may carry. Vercel caps a function's request body at about
 * 4.5 MB, so the browser gzips the file first (text formats shrink ~10x) and
 * the server inflates it with MAX_FILE_BYTES as the ceiling.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Samples per stream: 24 h at 1 Hz, plus headroom for sub-second recorders. */
export const MAX_SAMPLES_PER_STREAM = 200_000;

/** Plausible heart-rate bounds for a horse (bpm). Outside: dropped, and counted. */
export const MIN_VALID_HR_BPM = 20;
export const MAX_VALID_HR_BPM = 300;

/** Fastest plausible horse speed (m/s, ~90 km/h); a faster derived speed is GPS noise. */
export const MAX_PLAUSIBLE_SPEED_MS = 25;

/** Rows per insert request, matching the mobile sync's chunk size. */
export const MEASUREMENT_INSERT_CHUNK = 500;

export const ACCEPTED_EXTENSIONS = ['.tcx', '.gpx', '.fit'] as const;
