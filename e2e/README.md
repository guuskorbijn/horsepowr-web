# End-to-end: Polar export → web import → session page

Needs Docker and a Chromium for Playwright (`npx playwright install chromium` once).

A real browser against a production build of this app and a **local**
Supabase built from the mobile repo's migrations. Not part of `npm test`.

```bash
# 1. Local stack (Docker running), from the mobile repo
cd ../horsepowr && npx supabase start -x studio,imgproxy,vector,logflare,edge-runtime,supavisor,mailpit,realtime,postgres-meta
# 2. Seed two stables, four roles, a horse (LOCAL ONLY — the script refuses anything else)
cd ../horsepowr-web && bash e2e/seed-local.sh
# 3. Files: a real Polar Flow export, or the synthetic generators
mkdir -p e2e-out/files
python3 e2e/generators/polar_tcx.py e2e-out/files/polar-competition-2026-10-25.tcx
node e2e/generators/polar_fit.mjs e2e-out/files/polar-mexico-2026-10-26.fit
cp e2e-out/files/polar-competition-2026-10-25.tcx e2e-out/files/renamed.fit
printf '<?xml version="1.0"?>\n<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>\n<TrainingCenterDatabase/>\n' > e2e-out/files/xxe.tcx
# 4. Build and serve against the local stack
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(cd ../horsepowr && npx supabase status -o json | python3 -c 'import json,sys;print(json.load(sys.stdin)["ANON_KEY"])')
npx next build && npx next start -p 3100 &
# 5. Run
node e2e/polar-import.e2e.mjs        # screenshots in e2e-out/shots
bash e2e/measurements-upsert-probe.sh # the mobile upsert finding
```

To test a **real** Polar export, replace the two generated files with the
exports (same names) and re-run step 5. Results of the first run, 2026-10-28:
20/21 checks pass; the failing one is the known UTC-time bug on the session
page (see PRODUCTION_READINESS.md in the mobile repo).
