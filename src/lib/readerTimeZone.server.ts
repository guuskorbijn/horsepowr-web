import 'server-only';
import { cookies } from 'next/headers';
import { READER_TZ_COOKIE } from '@/lib/readerTimeZone';
import { resolveReaderTimeZone } from '@/services/calendar/agendaService';

/** The reader's zone for server components, with an explicit UTC fallback flag. */
export async function getReaderTimeZone(): Promise<{ timeZone: string; isFallback: boolean }> {
  const store = await cookies();
  return resolveReaderTimeZone(store.get(READER_TZ_COOKIE)?.value);
}
