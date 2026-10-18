import { getBrowserSupabase } from '@/lib/supabase/browser';
import { log } from '@/lib/log';

/**
 * Tells the server an agenda item changed, so it can decide who to notify.
 *
 * The DECIDING does not happen here, and that is the point. Whether a change
 * is worth interrupting someone for is one policy, and it lives in one place
 * (`notificationPolicy.ts`, copied into the Edge Function) so the phone and
 * the browser cannot develop different opinions about when to wake somebody
 * up at night. This function's whole job is to report what happened.
 *
 * Nor can it send: `push_tokens` is gated by `user_id = auth.uid()`, so a
 * browser physically cannot read the recipient's token — only the Edge
 * Function's service-role client can.
 *
 * A failure here is logged and swallowed ON PURPOSE. The save already
 * succeeded; failing the user's edit because a notification could not be
 * queued would turn a missed buzz into lost work.
 */
export async function notifyCalendarChange(input: {
  eventId: string;
  changedFields: readonly string[];
  /** The occurrence's original start, when one instance of a series changed. */
  occurrenceStart?: string | null;
  previousAssigneeId?: string | null;
  previousStartsAt?: string | null;
}): Promise<void> {
  if (input.changedFields.length === 0) return;
  try {
    const { error } = await getBrowserSupabase().functions.invoke('calendar-notify', {
      body: {
        eventId: input.eventId,
        changedFields: [...input.changedFields],
        occurrenceStart: input.occurrenceStart ?? null,
        previousAssigneeId: input.previousAssigneeId ?? null,
        previousStartsAt: input.previousStartsAt ?? null,
      },
    });
    if (error) throw error;
  } catch (err: unknown) {
    log.warn('agenda: could not request notifications', {
      eventId: input.eventId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
