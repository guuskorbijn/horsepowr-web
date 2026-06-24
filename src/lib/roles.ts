import type { UserRole } from '@/types/db';

/**
 * Centralised role -> capability mapping. This is the ONE place that maps a
 * role to what UI affordances it gets, so the future `analyst` role is a
 * one-line addition here (see CLAUDE.md / OVERNIGHT report), not a refactor
 * scattered across components.
 *
 * These mirror the existing Supabase RLS (the database is the real gate):
 *   trainer = full create/edit · owner = read-all · vet = read filtered per horse.
 * The UI gating below is defence-in-depth and UX clarity — RLS still enforces.
 */
export interface Capabilities {
  /** Can create/edit horses, locations, and session annotations. */
  canEdit: boolean;
  /** Can manage org setup (horses/locations CRUD, view team). */
  canManage: boolean;
  /** Sees only horses they're assigned to (vet). */
  perHorseScoped: boolean;
}

const CAPABILITIES: Readonly<Record<UserRole, Capabilities>> = {
  trainer: { canEdit: true, canManage: true, perHorseScoped: false },
  owner: { canEdit: false, canManage: false, perHorseScoped: false },
  vet: { canEdit: false, canManage: false, perHorseScoped: true },
  // FUTURE: add `analyst: { ... }` here once the role exists in the DB. No other
  // file should need to change. Until then the analyst logs in as trainer/owner.
};

export function capabilitiesFor(role: UserRole): Capabilities {
  return CAPABILITIES[role];
}

export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  trainer: 'Trainer',
  owner: 'Owner',
  vet: 'Vet',
};
