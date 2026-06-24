import type { Supa } from '@/lib/supabase/types';
import { env } from '@/lib/env';

/**
 * Invokes the existing AI session-summary Edge Function (the same one the mobile
 * app calls) and returns its descriptive lines. Returns null when the function
 * is not configured or fails, so the caller can fall back to the deterministic
 * summary gracefully. We do NOT write a new summarizer here.
 *
 * Expected response shapes (tolerant): { lines: string[] } or { summary: string }.
 */
export async function invokeSessionSummary(
  supa: Supa,
  sessionId: string,
): Promise<string[] | null> {
  if (!env.aiSummaryFunction) return null;
  try {
    const { data, error } = await supa.functions.invoke<{ lines?: string[]; summary?: string }>(
      env.aiSummaryFunction,
      { body: { sessionId, session_id: sessionId } },
    );
    if (error || !data) return null;
    if (Array.isArray(data.lines) && data.lines.length > 0) return data.lines;
    if (typeof data.summary === 'string' && data.summary.trim() !== '') {
      return data.summary
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return null;
  } catch {
    // Function not deployed / network error — caller uses the deterministic fallback.
    return null;
  }
}
