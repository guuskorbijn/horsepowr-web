'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { READER_TZ_COOKIE } from '@/lib/readerTimeZone';
import { log } from '@/lib/log';

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const hit = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return hit === undefined ? null : decodeURIComponent(hit.slice(prefix.length));
}

/**
 * Tells the server which zone the reader is in, once per change.
 *
 * Renders nothing. When the cookie is missing or stale (first visit, or a
 * laptop that flew from Breda to Mexico) it is rewritten and the current page
 * re-rendered, so the agenda's "today" and day buckets are the reader's own.
 */
export function TimeZoneSync(): null {
  const router = useRouter();
  useEffect(() => {
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (err: unknown) {
      log.warn('timezone: browser did not report a zone; agenda stays on UTC', {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    if (!zone || readCookie(READER_TZ_COOKIE) === zone) return;
    document.cookie = `${READER_TZ_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}
