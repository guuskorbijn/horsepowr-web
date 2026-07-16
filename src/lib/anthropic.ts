import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Server-only Anthropic client + analyst chat config.
 *
 * `ANTHROPIC_API_KEY` is a SERVER secret — it is NOT a NEXT_PUBLIC_* var and must
 * never reach the browser. The `server-only` import makes importing this module
 * from a client component a build error, so the key can't leak into a client
 * bundle. This is separate from the Supabase anon-key + RLS model: the model
 * never gets a DB connection — it only ever receives structured tool results.
 *
 * Model choice: the AI_CHAT_SPEC asked for "Sonnet, temperature 0.2". The current
 * Sonnet (claude-sonnet-5) REJECTS the temperature parameter (sampling params
 * were removed on it → 400). claude-sonnet-4-6 is the newest Sonnet that still
 * accepts temperature, so it uniquely satisfies "Sonnet + temperature 0.2". To
 * move to Sonnet 5 later, set ANALYST_MODEL = 'claude-sonnet-5' and set
 * ANALYST_TEMPERATURE = undefined (steer determinism via effort/prompt instead).
 */
export const ANALYST_MODEL = 'claude-sonnet-4-6';
export const ANALYST_TEMPERATURE: number | undefined = 0.2;
export const ANALYST_MAX_TOKENS = 4096;
/** Safety cap on tool-call round trips per user turn. */
export const ANALYST_MAX_STEPS = 8;

let cached: Anthropic | null = null;

/**
 * Returns the shared Anthropic client, or throws a clear, actionable error when
 * the key is missing so the route can surface a 500 with a real message rather
 * than a cryptic SDK failure.
 */
export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env.local (server-only — not a NEXT_PUBLIC_ var) to enable the analyst chat.',
    );
  }
  if (!cached) cached = new Anthropic({ apiKey });
  return cached;
}
