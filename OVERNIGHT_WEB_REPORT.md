# HorsePowr Web — Overnight Build Report

Built overnight as an isolated repo (`horsepowr-web`), a desktop analysis
companion to the HorsePowr mobile app on the **same Supabase backend**. All ten
work packages (WP-W1…W10) landed and are individually green
(`typecheck` + `lint` + `next build`). Every Must, every Should, and the one
Could are done.

> **Two things before anything works:** set the two env vars (`.env.local`) and,
> for the preview, connect the repo to Vercel. See **Manual steps** below. The
> service-role key must never be added to this project — anon key + RLS only.

---

## 1. What you'll see — start here

```bash
cd horsepowr-web
# .env.local already exists locally with the same Supabase project as the app.
npm run dev          # http://localhost:3000
```

Sign in (email + password, or magic link). Then open, in this order:

1. **Command center** (`/`) — your stable at a glance: horses grouped by
   location, each with last-session recency, duration and sync state. Search +
   the top-bar location switcher filter it live.
2. **A deep session** (click any horse card's last session, or Sessions → a row)
   — the screen where the laptop beats the phone: metric tiles, a descriptive
   summary, large HR / speed / altitude charts on one shared time axis with
   **scroll-to-zoom, drag-to-pan, synced crosshair**, a **gait overlay** (Show
   gaits toggle), the **route map**, recording-quality, time-in-zone, editable
   annotations, and **export** (CSV + Print/PDF).
3. **Compare** (`/compare`) — pick a horse and 2+ sessions; HR/speed/altitude
   overlay on a shared elapsed-time axis with a side-by-side metric table.
4. **Trends** (`/trends`) — descriptive metric trends per horse and cross-horse
   per location. Numbers only, labelled neutrally.
5. **Horses** (`/horses`) — management home: horses CRUD, locations CRUD, team.

Toggle **light/dark** from the top bar (both are first-class). The whole UI is
desktop-first and degrades to tablet.

---

## 2. Per work package

| WP | Status | What's reviewable |
|----|--------|-------------------|
| **W0** Bootstrap | ✅ | `create-next-app` (App Router, TS strict + `noUncheckedIndexedAccess`), lean deps, GitHub Actions CI (typecheck/lint/build), `.env.local.example`, web `CLAUDE.md`. Scaffold lives on `main`. |
| **W1** Foundation & shell | ✅ | `src/theme/tokens.ts` (canonical Vital tokens), Tailwind v4 `@theme` → light/dark CSS vars, Poppins+Inter, no-FOUC theme via `useSyncExternalStore`, left sidebar + top context bar, UI kit, Supabase browser+SSR clients, hand-authored DB types. |
| **W2** Auth & access | ✅ | Login (password **and** magic link), `proxy` (Next 16 middleware) session refresh + route guard, server session loader, role→capability module, client `useRole()/useCan()`, no-access + link-expired states. |
| **W3** Data layer | ✅ | Typed repositories (horse/session/measurement/gait/annotation/org), `measurementService` with **LTTB downsampling**, `sessionMetrics`, `gaitService` (derive-on-read classifier), `sessionListService`. Sessions list wired to live data. |
| **W4** Command center | ✅ | Horses by location, last-session glance, search + location filter, click-through to horse and session. |
| **W5** Deep session view | ✅ | `TimeSeriesChart` (d3→SVG, zoom/pan, crosshair, re-windowed downsampling), gait track + legend, MapLibre route, AI summary + deterministic fallback, recording-quality, zone distribution. |
| **W6** Annotations editing | ✅ | Role-gated form writing existing `sessions` columns under RLS; honest Save→Saved states; read-only view for owner/vet. |
| **W7** Comparison | ✅ | `OverlayCharts` (multi-series, shared zoom), side-by-side metric table, colour-blind-safe series + labels. |
| **W8** Trends (Could) | ✅ | Per-horse + cross-horse descriptive trends; `TrendChart` (date axis); **no normative wording** (guardrail audited). |
| **W9** Export | ✅ | Raw measurements CSV + summary CSV (client-side), print stylesheet → analyst-ready PDF. |
| **W10** Admin | ✅ | Horses & locations CRUD under RLS (trainer-gated), team read-only. |

**Verification:** `tsc`, `eslint`, and `next build` are clean on the final
commit. A runtime smoke confirmed `/` 307-redirects to `/login?next=/` (proxy
guard) and `/login` renders 200.

---

## 3. Assumptions & decisions (smaller, reversible where uncertain)

- **Tailwind v4, not `tailwind.config.ts`.** `create-next-app` ships Tailwind
  v4 (CSS-first `@theme`). Tokens still have **one source of truth**
  (`src/theme/tokens.ts`); `globals.css` mirrors them into light/dark CSS vars
  consumed as utilities. This is the brief's intent (token-driven Tailwind),
  just via v4's mechanism rather than a JS config file.
- **`proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention and warns
  on the old name; adopted `proxy` to keep the build clean.
- **DB types are hand-authored** (`src/types/db.ts`) from the RN migrations,
  because `supabase gen types` needs an access token that wasn't present. They
  match `gen types` output shape, so dropping in generated types later is a
  no-op. (Note: they're transcribed from migrations; regenerate once the CLI is
  authed to be 100% sure they match production.)
- **Command center keeps avg HR off the cards.** Showing avg HR per horse on the
  landing page means pulling every last session's measurements (tens of
  thousands of rows across a stable) on first paint. The cards show duration,
  recency and sync; **avg/peak HR live in the deep session view**. Reversible —
  if you want it on the cards, a small per-card lazy fetch or a DB aggregate is
  the path.
- **Gait is derived on read** when there's no cached `session_gait_segments`
  row, mirroring mobile; the cache is read but never written. Thresholds are the
  same analyst-pending placeholders as the app.
- **Map tiles:** keyless OpenStreetMap raster (no Mapbox, no vendor lock). Fine
  for internal use; swap to a paid/styled tile source later if volume grows.
- **Unit tests:** no test runner was added (keeping the tree lean; CI runs
  typecheck/lint/build). The pure services (`measurementService`,
  `sessionMetrics`, `gaitService`, `chartMath`, `hrZone`, `recordingQuality`,
  `trendService`) are written as pure functions ready to test — wiring Vitest is
  a small follow-up if you want it.

---

## 4. Pending decisions for you

- **Analyst role + payments (§7 of the brief).** Not touched — it's a frozen
  schema change and a commercial call. The whole permission layer routes through
  one typed module (`src/lib/roles.ts`); adding an `analyst` role there is a
  **one-line addition**, not a refactor. For now an analyst logs in as `trainer`
  (to edit annotations) or `owner` (read-only).
- **AI-summary Edge Function name.** Web calls `NEXT_PUBLIC_AI_SUMMARY_FUNCTION`
  (default `session-summary`) with `{ sessionId }` and renders `lines[]` or
  `summary`. No such function was found in the RN repo, so today it **always
  renders the deterministic descriptive fallback** (which is correct and
  descriptive-only). Confirm the real function name and I'll point web at it; the
  fallback stays wired regardless.
- **Team management from web** is read-only: RLS (`profiles_self_read`) only
  exposes your own profile, and invites run through the existing mobile
  mechanism. No new invite path was built (as instructed). If you want web team
  management, that needs a deliberate RLS/Edge-Function decision.
- **Dark mode** is complete (both themes first-class), so nothing pending there.
- **PDF:** the print stylesheet was enough — no PDF library was added (cheaper,
  and "print to PDF" of the session/comparison view is tidy). If you later want
  pixel-perfect server-rendered PDFs, that's the place to add one.

---

## 5. Manual steps for you

1. **GitHub:** create `github.com/guuskorbijn/horsepowr-web` and add the remote
   (the build is local only; pushing is your call):
   ```bash
   git remote add origin git@github.com:guuskorbijn/horsepowr-web.git
   git push -u origin main
   git push -u origin web-overnight-1
   ```
2. **Env vars** — `.env.local` (already set locally) and in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_AI_SUMMARY_FUNCTION` (optional; fallback works without it)
   **Anon key only — never the service-role key.**
3. **Vercel:** connect the repo and confirm the preview deploy.
4. **Analyst role + payment model** — out of scope tonight (§7).
5. **Confirm the AI-summary Edge Function name** so web calls the right one.
6. Later, daytime: the `analyst` role migration + RLS, if you go that route.

---

## 6. Things that wanted a new dependency or schema object — NOT done

- **No schema/object mutation** anywhere (tables, views, RPCs, functions, enums,
  triggers, RLS all untouched). The app only reads, and writes rows to existing
  tables under existing RLS.
- **No new summarizer** — reused the existing Edge Function contract with a
  deterministic fallback.
- Dependencies added were all used: `@supabase/{ssr,supabase-js}`,
  `d3-{scale,shape,array,path}`, `maplibre-gl`, `lucide-react`. No `papaparse`
  (CSV is hand-rolled). No PDF lib (print stylesheet). No test runner.
- Future work (your call, not done): generated DB types once the CLI is authed;
  Vitest for the pure services; avg-HR-on-cards if wanted; richer team
  management (needs an RLS/Edge decision).

---

## 7. Guardrails honoured

- **Anon key + RLS only.** The service-role key is referenced nowhere; `env.ts`
  reads only `NEXT_PUBLIC_*`.
- **Descriptive only.** No grades, scores, health/welfare claims, advice,
  predictions or baselines anywhere — including the reused AI summary and the
  trends view (audited for normative wording).
- **No capture.** No BLE, no live session — read/analyze/manage only.
- **RN repo untouched** — read-only reference for schema/design.

---

## 8. Commits

Branch `web-overnight-1` (12 commits incl. scaffold). `main` holds only the
scaffold + bootstrap.

```
dc768fd WP-W8: trends & cross-horse — descriptive metrics over time
2a62c5f WP-W10: admin/management — horses & locations CRUD, team view
750ec96 WP-W9: export — CSV (raw + summary) and print-to-PDF stylesheet
879c5a6 WP-W7: session comparison — overlay 2+ sessions of one horse
fa513c4 WP-W6: annotations editing — role-gated session metadata form
ddc308c WP-W5: deep session view — charts, gait, map, summary, quality
651e1d2 WP-W4: command center — stable at a glance, horses by location
d426a0f WP-W3: data layer — typed repositories + measurement/metrics/gait services
794b907 WP-W2: auth & access — login (password + magic link), proxy guard, roles
82e8817 WP-W1: foundation & shell — tokens, theming, app shell, routed pages
5986c10 WP-W0: bootstrap — deps, strict TS, env example, CI, web CLAUDE.md
b3e4cc4 Initial commit from Create Next App
```

---

**Reminder:** set the two `NEXT_PUBLIC_SUPABASE_*` env vars and connect the repo
to Vercel for the preview deploy. Anon key only.
