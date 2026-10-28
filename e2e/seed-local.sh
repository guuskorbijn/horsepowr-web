#!/usr/bin/env bash
# Local-only seed for the e2e run. Never point this at a real project.
set -euo pipefail
API=http://127.0.0.1:54321
# Hard guard: this script creates users with the service-role key of the LOCAL
# stack (read from `supabase status` at runtime, never stored). It must never
# run against a hosted project.
case "$API" in http://127.0.0.1:*|http://localhost:*) ;; *) echo 'refusing: not a local Supabase' >&2; exit 1;; esac
OUT=${E2E_OUT:-./e2e-out}; mkdir -p "$OUT"
SR=$(cd "${MOBILE_REPO:-../horsepowr}" && npx --yes supabase@2.122.0 status -o json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')
DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres
mk() { curl -sS -X POST "$API/auth/v1/admin/users" -H "apikey: $SR" -H "Authorization: Bearer $SR" -H 'content-type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"E2e-local-only-1\",\"email_confirm\":true,\"user_metadata\":{\"name\":\"$2\"}}" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("id") or d)'; }
A_TRAINER=$(mk trainer.a@e2e.local "Sanne (trainer)")
A_OWNER=$(mk owner.a@e2e.local "Eigenaar A")
A_VET=$(mk vet.a@e2e.local "Wout (vet)")
B_TRAINER=$(mk trainer.b@e2e.local "Trainer B")
echo "users: $A_TRAINER $A_OWNER $A_VET $B_TRAINER"
psql -q "$DB" <<SQL
insert into organizations (id, name, location, country) values
  ('00000000-0000-0000-0000-0000000000aa', 'E2E Alpha Stables', 'Breda', 'NL'),
  ('00000000-0000-0000-0000-0000000000bb', 'E2E Bravo Stables', 'Elsewhere', 'NL') on conflict (id) do nothing;
insert into locations (id, org_id, name, country) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000aa', 'Breda', 'NL') on conflict (id) do nothing;
insert into profiles (id, email, name) values
  ('$A_TRAINER','trainer.a@e2e.local','Sanne (trainer)'), ('$A_OWNER','owner.a@e2e.local','Eigenaar A'),
  ('$A_VET','vet.a@e2e.local','Wout (vet)'), ('$B_TRAINER','trainer.b@e2e.local','Trainer B')
  on conflict (id) do nothing;
update profiles set org_id='00000000-0000-0000-0000-0000000000aa', role='trainer', name='Sanne (trainer)' where id='$A_TRAINER';
update profiles set org_id='00000000-0000-0000-0000-0000000000aa', role='owner' where id='$A_OWNER';
update profiles set org_id='00000000-0000-0000-0000-0000000000aa', role='vet' where id='$A_VET';
update profiles set org_id='00000000-0000-0000-0000-0000000000bb', role='trainer' where id='$B_TRAINER';
insert into horses (id, org_id, location_id, name, discipline, max_hr) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000a1', 'Luna', 'eventing', 220),
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000bb', null, 'Bravo Horse', null, 240)
  on conflict (id) do nothing;
insert into sessions (id, horse_id, started_at, ended_at) values
  ('00000000-0000-0000-0000-00000000b010', '00000000-0000-0000-0000-00000000b001', now() - interval '1 day', now() - interval '23 hours')
  on conflict (id) do nothing;
SQL
echo "A_TRAINER=$A_TRAINER" > "$OUT/ids.env"
echo "B_TRAINER=$B_TRAINER" >> "$OUT/ids.env"
psql -q "$DB" -c "select p.name, p.role, o.name as org from profiles p left join organizations o on o.id=p.org_id order by 1"
