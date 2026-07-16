/**
 * Two-account org-isolation smoke test for the analyst tool layer.
 *
 * WHAT IT PROVES: signed in as an Org A user, the analyst tools return NONE of
 * Org B's horses/sessions — list_horses, list_sessions and get_session all refuse
 * cross-org data. This is the exact read path POST /api/analyst/chat uses: the
 * endpoint only ever hands the model these tool results, so if the tools are
 * org-tight the chat is too.
 *
 * ANON-ONLY BY DESIGN: the "attacker" is an ordinary authenticated user on the
 * anon key + RLS — this repo never touches the service-role key (not even in
 * tests). It does NOT seed or delete anything; it reads pre-existing fixtures.
 *
 * GATED / SKIPPED BY DEFAULT: it runs only when ANALYST_IT=1 and every required
 * env var is set (below). Point it at a LOCAL or DISPOSABLE Supabase, never
 * production. Without the vars the whole block is skipped, so `npm test` stays
 * green — it does NOT invent a pass.
 *
 * TODO(needs Guus): supply two org accounts + a couple of Org B ids. The backend
 * repo's RLS suite (tests/rls/orgIsolation.rls.test.ts + proposals/RLS_SUITE_README.md)
 * already seeds exactly this shape against a disposable project; reuse those
 * fixtures, then export:
 *   ANALYST_IT=1
 *   ANALYST_IT_SUPABASE_URL=...            (or falls back to NEXT_PUBLIC_SUPABASE_URL)
 *   ANALYST_IT_ANON_KEY=...                (or falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *   ANALYST_IT_ORG_A_EMAIL=...  ANALYST_IT_ORG_A_PASSWORD=...  ANALYST_IT_ORG_A_ID=...
 *   ANALYST_IT_ORG_B_ID=...  ANALYST_IT_ORG_B_HORSE_ID=...  ANALYST_IT_ORG_B_SESSION_ID=...
 * then: ANALYST_IT=1 npx vitest run src/services/analyst/orgIsolation.integration.test.ts
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import type { Supa } from '@/lib/supabase/types';
import { listHorsesForAnalyst, listSessionsForAnalyst } from '@/services/analyst/lists';
import { getSessionForAnalyst } from '@/services/analyst/sessionDetail';

const cfg = {
  url: process.env.ANALYST_IT_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  anon: process.env.ANALYST_IT_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  aEmail: process.env.ANALYST_IT_ORG_A_EMAIL ?? '',
  aPassword: process.env.ANALYST_IT_ORG_A_PASSWORD ?? '',
  aOrgId: process.env.ANALYST_IT_ORG_A_ID ?? '',
  bOrgId: process.env.ANALYST_IT_ORG_B_ID ?? '',
  bHorseId: process.env.ANALYST_IT_ORG_B_HORSE_ID ?? '',
  bSessionId: process.env.ANALYST_IT_ORG_B_SESSION_ID ?? '',
};

const REQUIRED = [
  cfg.url,
  cfg.anon,
  cfg.aEmail,
  cfg.aPassword,
  cfg.aOrgId,
  cfg.bOrgId,
  cfg.bHorseId,
  cfg.bSessionId,
];
const ENABLED = process.env.ANALYST_IT === '1' && REQUIRED.every((v) => v.length > 0);

const suite = ENABLED ? describe : describe.skip;

async function signInAs(email: string, password: string): Promise<Supa> {
  const client = createClient<Database>(cfg.url, cfg.anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

suite('analyst org isolation — Org A cannot see Org B', () => {
  let supaA: Supa;

  beforeAll(async () => {
    supaA = await signInAs(cfg.aEmail, cfg.aPassword);
  }, 30_000);

  it('list_horses returns Org A’s own horses but never an Org B horse', async () => {
    const horses = await listHorsesForAnalyst(supaA, cfg.aOrgId);
    // Positive guard: Org A must actually see its own data (seed gives it ≥1
    // horse). Without this, an "empty everywhere" misconfig would pass trivially.
    expect(horses.length).toBeGreaterThan(0);
    expect(horses.some((h) => h.id === cfg.bHorseId)).toBe(false);
  });

  it('list_horses with a spoofed Org B id returns nothing', async () => {
    const horses = await listHorsesForAnalyst(supaA, cfg.bOrgId);
    expect(horses).toHaveLength(0);
  });

  it('list_sessions for an Org B horse returns nothing', async () => {
    const byHorse = await listSessionsForAnalyst(supaA, cfg.aOrgId, { horseId: cfg.bHorseId });
    expect(byHorse).toHaveLength(0);

    const spoof = await listSessionsForAnalyst(supaA, cfg.bOrgId);
    expect(spoof.some((s) => s.horseId === cfg.bHorseId)).toBe(false);
  });

  it('get_session for an Org B session returns null (not another org’s data)', async () => {
    const detail = await getSessionForAnalyst(supaA, cfg.aOrgId, { sessionId: cfg.bSessionId });
    expect(detail).toBeNull();
  });
});
