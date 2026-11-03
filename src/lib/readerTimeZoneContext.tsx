'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * The reader's IANA zone for client components.
 *
 * Filled from the same cookie server components read (`getReaderTimeZone`),
 * so a client component renders the same time on the server pass and after
 * hydration. Reading the browser's zone directly would differ from the
 * server render and React would warn, or worse, silently keep the UTC text.
 */
const ReaderTimeZoneContext = createContext<string>('UTC');

export function ReaderTimeZoneProvider({ timeZone, children }: { timeZone: string; children: ReactNode }) {
  return <ReaderTimeZoneContext.Provider value={timeZone}>{children}</ReaderTimeZoneContext.Provider>;
}

export function useReaderTimeZone(): string {
  return useContext(ReaderTimeZoneContext);
}
