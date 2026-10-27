-- Calendar fixtures for the GATED analyst isolation test
-- (src/services/analyst/orgIsolation.integration.test.ts).
--
-- LOCAL OR DISPOSABLE SUPABASE ONLY. Never run against production.
-- Builds on the mobile repo's proposals/rls_seed.sql (orgs aa/bb, horses
-- a001/b001, sessions a010/b010). Replace <A_TRAINER_UID> / <B_TRAINER_UID>
-- with the real auth user ids, exactly as in that file. Run as the postgres
-- role in the SQL editor (RLS does not apply to it).
--
-- Rows only: this creates no table, policy, function or grant.

insert into calendar_events (id, org_id, horse_id, type, title, starts_at, timezone, created_by)
values
  -- Org A, on its horse: the positive assertion (org A must see its own data).
  ('00000000-0000-0000-0000-00000000ae01', '00000000-0000-0000-0000-0000000000aa',
   '00000000-0000-0000-0000-00000000a001', 'training', 'Alpha planned training',
   now() + interval '1 day', 'Europe/Amsterdam', '<A_TRAINER_UID>'),
  -- Org B, on its horse.
  ('00000000-0000-0000-0000-00000000be01', '00000000-0000-0000-0000-0000000000bb',
   '00000000-0000-0000-0000-00000000b001', 'vet', 'Bravo vet visit',
   now() + interval '1 day', 'Europe/Amsterdam', '<B_TRAINER_UID>'),
  -- Org B, stable-wide (no horse): the case a horse-join policy would miss.
  ('00000000-0000-0000-0000-00000000be02', '00000000-0000-0000-0000-0000000000bb',
   null, 'farrier', 'Bravo farrier round',
   now() + interval '2 days', 'Europe/Amsterdam', '<B_TRAINER_UID>');

-- Then export, next to the existing ANALYST_IT_* variables:
--   ANALYST_IT_ORG_A_EVENT_ID=00000000-0000-0000-0000-00000000ae01
--   ANALYST_IT_ORG_B_EVENT_ID=00000000-0000-0000-0000-00000000be01
--   ANALYST_IT_ORG_B_STABLE_EVENT_ID=00000000-0000-0000-0000-00000000be02
