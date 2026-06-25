# HorsePowr Web — Overnight Build Report #2 (Analyst & Trainer toolkit)

**Branch:** `web-overnight-2` (off `web-overnight-1`'s tip) · **`main` untouched · nothing pushed**
**Result:** all 9 work packages landed — Must (W11–W14), Should (W15, W16, W18), Could (W17, W19).
Every commit is individually green: `npm run typecheck` + `npm run lint` + `npm run build`, and `npm test` (18 pure-service tests across 6 files) all pass.

---

## 1. What you'll see — open these first

Run it:

```bash
npm install      # vitest was added as a dev dependency (see §5)
npm run dev      # http://localhost:3000
```

Then:

1. **A session's new depth panels** — open any session from **Sessions** or a horse card → `/sessions/<id>`. New, in order down the page:
   - **Efforts** — detected work bouts vs recovery, as a table + coral bands overlaid on the synced charts (toggle "Efforts" / "Gradient" / "Gaits" independently above the charts).
   - **Heart rate vs speed** — the scatter + fitted line with **V170 / V180 / V200** read off as plain speeds.
   - **Recovery descent** — the measured HR fall after the last effort, with drops at +1 / +5 / +10 min.
   - **Climbs** + an **Estimated gradient** strip on the shared clock (GPS sessions only).
   - Use **← / →** to walk to the older / newer session of that horse.
2. **A horse's adaptation view** — open a horse → `/horses/<id>`. Above the session list:
   - **Fitness signal — HR vs speed over time**: speed-at-HR-x per session (V200/V180/V170 toggle) + the per-session HR–speed curves faded oldest→newest. Filter by date / training type.
   - **Weekly volume (measured)**: stacked Z1–Z5 minutes per week + distance/duration/session totals.
3. **Command center** (`/`): each horse card now shows **days since last session** with a neutral recency dot.
4. **⌘K / Ctrl+K anywhere**: the **jump-to-horse** quick-switcher.
5. **Print any session** (Print / PDF in the toolbar): a deliberate analyst report — print-only header with metrics + V-index up top, all panels, light ink-friendly render even from dark mode.

---

## 2. Per work package

Shared design choice: every new physiology derivation is a **pure service in `src/services`**, computed **derive-on-read** from existing `measurements` rows, with thresholds in **named, overridable constants** under `src/constants`. Nothing is persisted; no schema object was touched.

### WP-W11 — Effort / interval detection *(Must)* ✅
- **Files:** `constants/effort.ts`, `constants/gradient.ts`, `services/gradientService.ts`, `services/effortService.ts` (+ `effortService.test.ts`), `components/charts/EffortTrack.tsx`, `components/session/EffortsPanel.tsx`; wired in `SessionCharts.tsx`, `sessionViewService.ts`, session page; `sessionMetrics.ts` exports the shared `haversineMetres`.
- **Reviewable:** Efforts table + coral bands on the charts, toggled independently of gait.
- **Method:** detector behind a factory (mirrors the gait classifier) — two-state HR classifier with **enter/exit hysteresis** (fractions of the horse's `max_hr`) + a **min-segment-duration** merge that bridges brief dips and discards blips. Per-effort stats (avg/peak HR, avg/max speed, distance, est. avg gradient + climb) from the rows each bout spans.
- **Assumptions:** default enter/exit = 0.75 / 0.70 of max HR; min work 20s, min recovery 15s — **analyst-pending**, per-discipline overridable via `EFFORT_THRESHOLDS_BY_DISCIPLINE`.

### WP-W12 — HR–speed relationship & V-index *(Must — the core)* ✅
- **Files:** `constants/hrSpeed.ts`, `services/hrSpeedService.ts` (+ test), `components/charts/HrSpeedChart.tsx`, `components/session/HrSpeedPanel.tsx`; wired in `sessionViewService.ts`, session page.
- **Reviewable:** scatter + fitted line + HR-zone shading + V-index markers, with the three V-values below.
- **Method (in code):** each speed sample paired with the nearest HR sample within tolerance; least-squares line over the locomotion range; `V(threshold) = (threshold − a)/b`, reported **only within the session's observed HR range** — otherwise "not reached" (no extrapolation).
- **Verified:** against an exact `HR = 80 + 4·speed` fixture → slope 4, V200 = 30, V180 = 25, V170 = 22.5 km/h.

### WP-W13 — V-index & HR–speed trend over time *(Must)* ✅
- **Files:** `services/vIndexTrendService.ts` (+ test), `components/charts/VIndexTrendChart.tsx`, `components/charts/HrSpeedCurveShiftChart.tsx`, `components/horse/HorseFitnessTrend.tsx`; loaded by `HorseAnalytics.tsx` (see W16).
- **Reviewable:** on the horse page — V-trend points+line (threshold toggle) and the faded curve-shift overlay; date + training-type filters.
- **Method:** reuses W12's service per session (DRY). Client-side aggregation over the most recent 24 finished sessions (raw-row pull capped).

### WP-W14 — Measured recovery descent *(Must)* ✅
- **Files:** `constants/recovery.ts`, `services/recoveryService.ts` (+ test), `components/charts/RecoveryChart.tsx`, `components/session/RecoveryPanel.tsx`; wired in `sessionViewService.ts`, session page.
- **Reviewable:** the descent curve after the last work bout + drops at +1/+5/+10 min in bpm and %.
- **Honest gaps:** when the recording stops before a mark, it shows **"not recorded"** — never fabricated. **No score, no Better/Normal badge** (deliberately short of the competitor's normative feature).

### WP-W15 — Hill / gradient effort analysis *(Should)* ✅
- **Files:** extended `constants/gradient.ts` + `services/gradientService.ts` (`detectClimbs`, `analyzeClimbs`, + test), `components/charts/GradientStrip.tsx`, `components/session/ClimbsPanel.tsx`; wired in `SessionCharts.tsx`, `sessionViewService.ts`, session page.
- **Reviewable:** the gradient strip aligned on the shared clock + a Climbs table with HR/speed per climb.
- **Caveat:** gradient is presented as an **estimate** everywhere (smoothed GPS altitude; caveat in the strip tooltip and table footnote). HR-only sessions hide both cleanly.

### WP-W16 — Measured weekly volume *(Should)* ✅
- **Files:** `services/weeklyVolumeService.ts` (+ test), `components/charts/WeeklyVolumeChart.tsx`, `components/horse/WeeklyVolumeCard.tsx`, `components/horse/HorseAnalytics.tsx` (single loader feeding W13 + W16 — no double fetch); `HorseFitnessTrend` is now presentational.
- **Reviewable:** stacked Z1–Z5 bars per week + totals + a per-week table.
- **Framing:** Monday-anchored UTC weeks; time-in-zone = HR-sample share × duration. **Sums only — not a load/readiness signal**; the title says "(measured)".

### WP-W18 — Analyst-ready PDF handoff *(Should)* ✅
- **Files:** `components/session/PrintReportHeader.tsx`, print rules in `globals.css`, `RouteMap.tsx` (`preserveDrawingBuffer`), compare page/view print touches.
- **Reviewable:** Print / PDF on a real session → a deliberate report (header with metrics + V-index, all panels, route map). **Print stylesheet only — no PDF lib** (the SVG charts render natively; that justification holds). Print pins semantic vars to light values + `print-color-adjust: exact` so zone/effort colours survive on paper even from dark mode.

### WP-W17 — Days since last measured *(Could)* ✅
- **Files:** `services/format.ts` (`daysSince`), `components/command/HorseCard.tsx`.
- **Reviewable:** each command-center card shows "N days since" with a neutral recency dot (fades with age, no good/bad colour). **No "due", no "should".**

### WP-W19 — Analyst navigation & saved filters *(Could)* ✅
- **Files:** `hooks/usePersistentState.ts`, `components/shell/QuickSwitcher.tsx` (mounted in `AppShell.tsx`), `components/session/SessionPager.tsx`, persisted filters in `SessionsList.tsx` (sessions page passes `showFilters`).
- **Reviewable:** Sessions filters (horse/date/type) persist across reload; ←/→ walk a horse's sessions; ⌘K quick-switcher.

---

## 3. Descriptive-only audit

I reviewed every new label, axis, legend, tooltip and table header for normative language. A `grep` for `improv|declin|fitter|better|worse|good|bad|overtrain|concern|injur|should|recommend|optimal|normal|grade|score|readiness|due|…` over all new files returns **only** (a) guardrail disclaimers inside code comments ("never grades…", "NO score…"), and (b) CSS class names (`line-strong`, `font-normal`). No user-facing string is evaluative.

Things I deliberately softened / chose:
- **Renamed the gradient column "Avg grade" → "Avg gradient"** in the Efforts and Climbs tables — "grade" was the one word that could be misread as an evaluation; "gradient" is unambiguous slope.
- V-index always phrased as **"speed at HR 200"**, never "fitness"; trend axes say only "speed at HR x per session"; the curve-shift carries the neutral one-liner "faint = older · solid = most recent".
- Recovery shows **"−38 from peak (21%)"** as a fact and the line "Recovery interpretation is the analyst's."
- Weekly volume titled **"Weekly volume (measured)"** with "Sums only — not a training-load score."
- Days-since uses a monochrome recency dot, never a red/green status.

---

## 4. Pending decisions / flags

- **Prescription bridge (§3 of the brief) — parked, by design.** Tonight's effort detection + V-index are exactly the descriptive foundation a future *prescribed-vs-actual* feature would compare against. It needs a new `targets`/`prescriptions` table (+ likely an `analyst` role and RLS) — a schema + payments decision for you, awake. **No part of its data model was built.**
- **HRV / RR intervals — deliberately not built.** `measurements.rr_ms` exists but no HRV/recovery-from-RR analysis was added; that strays toward normative/clinical territory and wasn't in scope.
- **Thresholds awaiting analyst calibration at Lips** (all named constants, overridable, no code-substance change to retune):
  - `constants/effort.ts` — work enter/exit (0.75 / 0.70 of max HR), min work/recovery durations, per-discipline overrides (map is empty).
  - `constants/hrSpeed.ts` — V thresholds (170/180/200), min fit speed (10 km/h), pairing tolerance.
  - `constants/gradient.ts` — altitude smoothing window, climb enter/exit gradient, min climb distance.
  - `constants/recovery.ts` — the +1/+5/+10 min marks and tolerance.
- **V-index trend & weekly volume pull raw rows client-side** for the most recent 24 sessions of a horse (there is no per-session summary table in the frozen schema). Cheap in practice; if a horse accrues very many sessions, consider raising/lowering `RECENT_SESSION_LIMIT` in `HorseAnalytics.tsx`.
- **Map in print:** `preserveDrawingBuffer` lets the WebGL canvas print; if tiles haven't finished loading when you hit Print, the blue route line still renders — give it a second on screen first.

## 5. New dependency / schema notes

- **Added `vitest` (dev dependency only)** + `vitest.config.ts` + an `npm test` script, because the brief explicitly requires pure-service unit tests and run #1 had no runner. No runtime dependency was added; the production tree is unchanged. (`npm install` is needed once to pull it.)
- **No schema/object mutation. No service-role key. RN repo untouched.** All new metrics are derive-on-read from existing `measurements` rows under the existing anon-key + RLS.

## 6. Commits

9 sequential per-WP commits on `web-overnight-2` (newest first):

```
debd114 WP-W19: analyst navigation & saved filters
a28a886 WP-W17: "days since last measured" on the command center
59fbf1a WP-W18: analyst-ready PDF handoff (print stylesheet)
7c52fb1 WP-W16: measured weekly volume per horse
2a30f42 WP-W15: hill / gradient effort analysis
2e0fdbf WP-W14: measured recovery descent after the last effort
be42828 WP-W13: V-index & HR–speed trend over time, per horse
1554436 WP-W12: HR–speed relationship & V-index per session
0332a7b WP-W11: effort/interval detection — work bouts vs recovery from HR
```

(The descriptive-only column rename in §3 lands with this report commit.)
