/**
 * The cookie that carries the reader's IANA zone from the browser to server
 * components.
 *
 * Needed because the server has no idea where the reader is: on Vercel it
 * runs in UTC, so "today" and "which day does 23:30 belong to" would be
 * answered for Greenwich rather than for a trainer in Breda or Mexico.
 * The browser writes it (`TimeZoneSync`); the server only reads it, and
 * `resolveReaderTimeZone` refuses anything that is not a real zone.
 */
export const READER_TZ_COOKIE = 'hp-tz';
