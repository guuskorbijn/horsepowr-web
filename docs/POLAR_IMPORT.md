# Polar file import

A trainer imports a ride exported from Polar Flow (TCX, GPX or FIT) as an ordinary
session: `/sessions` → **Import file** → preview → pick the horse → **Import session**.
Nothing is written before that last click.

## How it works

| Stage | Where | What it guarantees |
|---|---|---|
| Upload | `hooks/useActivityImport.ts` | Gzipped in the browser (Vercel's request body limit is ~4.5 MB); sent twice (preview, commit), held nowhere on the server |
| Size/encoding | `services/import/importRequest.server.ts` | ≤ 4 MB per request, ≤ 25 MB inflated; a gzip bomb stops at the ceiling |
| Format | `services/import/parserRegistry.ts` | Extension **and** content must agree; one parser per format |
| XML | `services/import/xmlSafe.ts` | Any DTD refused (XXE, entity bombs); entity processing off |
| FIT | `services/import/fitParser.ts` | Garmin FIT SDK; CRC verified; server-only (licence forbids redistribution) |
| Clean-up | `services/import/importService.ts` | Impossible values and repeated timestamps dropped **and counted**; missing speed derived from positions |
| Preview | same | Same `computeSessionMetrics` / `assessRecordingQuality` / `detectHrGaps` the session page uses |
| Write | `services/import/importCommit.ts` | uuid v5 ids from (org, horse, file SHA-256); insert-or-skip only; same file twice = "Already imported"; a half-finished write is completed by the next attempt |

Storage is the canonical model: HR rows and GPS rows separate, one per sample, UTC
timestamps as the file gave them. Nothing marks a row as imported, so charts, export and
the analyst read an imported ride exactly like a recorded one. (An optional `sessions.source`
column is proposed in the mobile repo, `proposals/migrations/20261027000001_*`; nothing
depends on it.)

`training_type` offers the existing vocabulary only (dressage, cross-country, conditioning,
other). There is no `competition` value on sessions; writing one would read back as "not
set" on both apps. Use *environment* or *location* for the event name, or extend the
vocabulary in both apps first.

## Validate with a real Polar export (needs a file from Lips)

The fixtures are synthetic. These can only be confirmed with real exports:

- [ ] **TCX from Polar Flow:** HR present per trackpoint; speed present in `TPX/Speed`
      (if absent, the preview says speed was derived); start time matches Polar Flow.
- [ ] **FIT from Polar Flow:** decodes (CRC passes); positions land on the real route on the
      map; RR intervals appear (Polar writes HRV messages only when RR recording was on).
- [ ] **GPX from Polar Flow:** whether it carries HR at all (many exports do not).
- [ ] **Time zone:** a ride at 10:00 in Mexico City shows at the right local time on the
      session page; DST-crossing rides (late October) have no one-hour jump.
- [ ] **Duration and distance** equal what Polar Flow shows, within GPS noise.
- [ ] **Same file twice** → "Already imported"; the session list shows one session.
- [ ] **A file from the Polar device Lips actually uses** (model still unconfirmed, CLAUDE.md).
