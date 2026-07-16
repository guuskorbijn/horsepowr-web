/**
 * Typed stubs for the analyst tools that need cross-session math not built yet:
 * per-horse trends, in-stable cohort benchmarks, and multi-session comparison.
 * Signatures and result shapes are locked here so wiring the real computation
 * later is a body change, not an interface change — and so callers/tests can
 * depend on the contract now.
 *
 * Each returns a discriminated `{ status: 'not_implemented' }` result rather than
 * throwing, so if one is ever exposed as a tool the model gets a readable answer
 * ("this isn't available yet") instead of an error. These are NOT registered in
 * the tool registry for the MVP (see tools.ts); they exist as the next slots.
 *
 * When implemented these stay read-only and org-scoped exactly like the live
 * tools: derive orgId from the session context, read through repositories under
 * RLS, and re-check horse.org_id ownership. V200 / rolling baselines are the
 * deliberately-deferred piece (per the build brief).
 */
import type { Supa } from '@/lib/supabase/types';
import type {
  HorseTrendInput,
  HorseTrendResult,
  StableBenchmarkInput,
  StableBenchmarkResult,
  CompareSessionsInput,
  CompareSessionsResult,
} from '@/services/analyst/types';

/* eslint-disable @typescript-eslint/no-unused-vars -- params document the locked
   signature for the future implementation; intentionally unused in the stub. */

/** One metric for one horse across sessions (e.g. HR at ~30 km/h, 5-min recovery
 *  HR). Real version computes V200/baselines — deferred. */
export async function getHorseTrend(
  supa: Supa,
  orgId: string,
  input: HorseTrendInput,
): Promise<HorseTrendResult> {
  return {
    status: 'not_implemented',
    tool: 'get_horse_trend',
    message:
      'Trend computation (HR-at-speed, recovery HR, V200/baselines) is not built yet. Use get_session on individual sessions for now.',
  };
}

/** Aggregated cohort figures within THIS stable (e.g. eventing horses at a level).
 *  Always aggregated, never another horse's identifiable trace. Deferred. */
export async function getStableBenchmark(
  supa: Supa,
  orgId: string,
  input: StableBenchmarkInput,
): Promise<StableBenchmarkResult> {
  return {
    status: 'not_implemented',
    tool: 'get_stable_benchmark',
    message: 'In-stable cohort benchmarking is not built yet.',
  };
}

/** The same metrics aligned across several sessions. Deferred. */
export async function compareSessions(
  supa: Supa,
  orgId: string,
  input: CompareSessionsInput,
): Promise<CompareSessionsResult> {
  return {
    status: 'not_implemented',
    tool: 'compare_sessions',
    message:
      'Multi-session comparison is not built yet. Call get_session on each session and compare the returned metrics.',
  };
}

/* eslint-enable @typescript-eslint/no-unused-vars */
