# HorsePowr Web

## What is this
A desktop **read / analyze / manage** web companion to the HorsePowr mobile app,
on the **same Supabase backend**. A laptop beats a phone for reading charts,
comparing sessions over time, explaining the data, and exporting clean results
to an external analyst. Primary users: **owner, trainer, analyst**.

## Hard scope walls
- **No capture / recording.** No BLE, no live session, no sensor pairing. The
  mobile app owns capture. Web only reads what was already recorded (and edits
  annotations / manages horses & locations under RLS).
- **No marketing / landing page.** Authenticated app only.
- **No schema changes.** Never create or alter tables, views, RPCs, functions,
  enums, triggers, or RLS policies. The schema is frozen. You MAY read all data
  the signed-in user can read, and write rows to existing tables under existing
  RLS (normal app CRUD). Schema/object mutation is forbidden.
- **Descriptive only — non-negotiable.** Everything shown is a measured fact
  (duration, distance, avg/peak HR, speed, altitude, gait segments, HR zones,
  trends of those numbers). NEVER a judgment, grade, score, health/injury/welfare
  claim, advice, prediction, or comparison to a "normal" baseline. No
  "good/weak/overtrained/should/improving/concerning." Plot the numbers; label
  nothing normatively. The reused AI summary inherits this rule exactly.

## Locked stack
- **Next.js (App Router)**, TypeScript **strict** (+ `noUncheckedIndexedAccess`).
- **Supabase** via `@supabase/ssr`, **anon key only** — never the service-role key.
- **Tailwind CSS v4** (CSS-first `@theme`), driven by brand tokens in
  `src/theme/tokens.ts`.
- Charts: **d3 (scale/shape/array/path) math rendered into plain web `<svg>`** —
  same geometry as the RN charts; react-native-svg does not apply on web.
- Maps: **MapLibre GL JS** with free/open tiles (no Mapbox key).
- Fonts: **Poppins** (display) + **Inter** (body/data) via `next/font`.
- Light + dark, both first-class, via CSS variables + a `.dark` class strategy.
- Desktop-first; degrade cleanly to tablet. No phone optimization.

## Hard "no" list
- ❌ Service-role key anywhere client-reachable. Anon key + RLS only.
- ❌ Secrets committed to the repo or shipped to the browser.
- ❌ Any Supabase schema/object mutation.
- ❌ Any normative/judgment output.
- ❌ Importing from the RN repo as a build dependency (read-only reference only).
- ❌ A second source of truth for brand tokens (`src/theme/tokens.ts` is canonical).
- ❌ Hardcoding anything Lips-specific. The app is org-scoped and generic.

## Architecture rules — enforce
- **TypeScript everywhere, no `any`.** Explicit interfaces. No silent catches —
  handle errors explicitly and surface them as a design-system error state.
- **Repository pattern.** All Supabase access lives in `src/data/`
  (`horseRepository.ts`, `sessionRepository.ts`, `measurementRepository.ts`,
  `annotationRepository.ts`, `orgRepository.ts`, …). No Supabase calls from
  components, pages, or server actions directly. Every repository function has
  an explicit return type.
- **Service layer for logic.** Aggregation, downsampling, comparison alignment,
  gait correlation, CSV/PDF assembly live in `src/services/`. Components render;
  services compute. No business logic in components.
- **DRY / SOLID, pragmatically.** Chart math is written once and shared by the
  single-session, comparison, and trend views via a typed `ChartSeries` shape.
- **Server vs client split.** Fetch with the SSR Supabase client in server
  components where it helps; interactive charts/maps are client components. The
  anon-only rule holds on both sides.

## Folder shape
```
src/
  app/                 # routes (App Router)
  components/          # reusable UI (kit, cards, tables)
  components/charts/   # d3 -> SVG chart primitives (shared by all views)
  data/                # repositories (only place Supabase is touched)
  services/            # aggregation, downsampling, comparison, export
  lib/                 # supabase clients (ssr server + browser), helpers
  theme/               # tokens.ts, theme provider, css vars
  types/               # DB types + view-model types
```

## Roles (existing RLS, mirrored in UI)
trainer = full (create/edit) · owner = read-all · vet = read filtered per horse.
Role → capability mapping is centralised in one typed module (`src/lib/roles.ts`)
so a future `analyst` role is a one-line addition, not a refactor. The analyst
has no DB role this build (that's a frozen schema change + a payments decision);
for now they log in as `trainer` (to edit) or `owner` (read-only).

## Schema (read-only — mirror of the RN migrations, do not change)
`organizations` · `locations` · `horses` (org_id, location_id, name, discipline,
photo_url, active, max_hr) · `profiles` (id, org_id, role, name, email) ·
`sessions` (+ annotation cols: training_type, environment, location_name,
physical_rating, mental_rating, injury_concern, injury_recovery, notes, synced) ·
`measurements` (timestamp, hr_bpm, rr_ms int[], speed_ms, altitude_m, lat, lng) ·
`session_gait_segments` (segments jsonb, classifier_kind/version, computed_at).

HR and GPS are SEPARATE measurement rows correlated by `timestamp`: an HR row has
`hr_bpm` set and lat/lng null; a GPS row has lat/lng/speed/altitude set and
`hr_bpm` null. Filter by field, sort by timestamp. Gait is DERIVED from GPS speed
on read — never written onto measurements; always presented as an estimate with
a Walk/Trot/Canter label.

## Working method
- Sequential work packages WP-W1…W10 on branch `web-overnight-1` (`main` holds
  only the scaffold). After every WP: `npm run typecheck`, `npm run lint`,
  `npm run build` all green. A WP that breaks the build is not done.
- Don't install dependencies you don't use. Keep the tree lean.
