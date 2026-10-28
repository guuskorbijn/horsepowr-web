#!/usr/bin/env bash
set -u
ANON=$(cd "${MOBILE_REPO:-../horsepowr}" && npx --yes supabase@2.122.0 status -o json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)["ANON_KEY"])')
API=http://127.0.0.1:54321
TOKEN=$(curl -sS -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'content-type: application/json' -d '{"email":"trainer.a@e2e.local","password":"E2e-local-only-1"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
SID=$(psql -At postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select id from sessions where horse_id='00000000-0000-0000-0000-00000000a001' limit 1")
post() {
  curl -sS -w " -> HTTP %{http_code}" -X POST "$API/rest/v1/measurements" \
    -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -H "Prefer: resolution=$1,return=minimal" \
    -d "[{\"id\":\"$2\",\"session_id\":\"$SID\",\"timestamp\":\"2026-10-25T09:30:00Z\",\"hr_bpm\":120}]"
  echo
}
echo "1. mobile-style upsert, NEW row:            $(post merge-duplicates 22222222-2222-4222-8222-222222222222)"
echo "2. mobile-style upsert, SAME row again:     $(post merge-duplicates 22222222-2222-4222-8222-222222222222)"
echo "3. web-style ignore-duplicates, SAME row:   $(post ignore-duplicates 22222222-2222-4222-8222-222222222222)"
