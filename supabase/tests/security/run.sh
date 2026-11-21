#!/usr/bin/env bash
# Disposable validation for the 20261120 security hardening migrations.
#
# Creates a throwaway PostgreSQL cluster under a temp directory (Unix socket
# only, no TCP), loads a synthetic Supabase-like role model, replays the
# repository migrations, and checks behavior before and after the hardening
# migrations. Never connects to a remote database.
#
#   PG_BIN=/usr/lib/postgresql/16/bin supabase/tests/security/run.sh
#   POSTGREST_BIN=/path/to/postgrest   (optional) adds HTTP probes through PostgREST
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HERE="$ROOT/supabase/tests/security"
MIGRATIONS="$ROOT/supabase/migrations"
FIXTURE="$ROOT/supabase/tests/fixtures/production_shaped_baseline.sql"
NEW_MIGRATIONS=(
  20261120213000_revoke_private_intake_truncate.sql
  20261120213100_restrict_security_definer_execute.sql
  20261120213200_profiles_owner_policies_by_id.sql
)

PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
WORK="$(mktemp -d)"
PORT=55433
SOCK="$WORK"
FAILED=0
PGRST_PID=""

cleanup() {
  [[ -n "$PGRST_PID" ]] && kill "$PGRST_PID" 2>/dev/null || true
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

psql_db() {
  local db="$1"; shift
  "$PG_BIN/psql" -X -q -h "$SOCK" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"
}

apply_migration() {
  psql_db "$1" -1 -f "$2" >/dev/null 2>"$WORK/err" || { cat "$WORK/err" >&2; return 1; }
}

is_new_migration() {
  local name; name="$(basename "$1")"
  for m in "${NEW_MIGRATIONS[@]}"; do [[ "$m" == "$name" ]] && return 0; done
  return 1
}

# shape: clean (replay every migration) | production (schema fixture first)
build_db() {
  local db="$1" shape="$2"
  psql_db postgres -c "CREATE DATABASE $db" >/dev/null
  psql_db "$db" -f "$HERE/00_supabase_like_bootstrap.sql" >/dev/null 2>&1
  if [[ "$shape" == production ]]; then
    psql_db "$db" -f "$FIXTURE" >/dev/null 2>&1
  fi
  for f in "$MIGRATIONS"/*.sql; do
    is_new_migration "$f" && continue
    if [[ "$shape" == production ]]; then
      # athlete_profiles.user_id is text in production; 20260202/20260203 hit
      # text = uuid there. Those statements do not touch the tables under test.
      "$PG_BIN/psql" -X -q -h "$SOCK" -p "$PORT" -U postgres -d "$db" -f "$f" >/dev/null 2>&1 || true
    else
      psql_db "$db" -f "$f" >/dev/null 2>&1
    fi
  done
  psql_db "$db" -f "$HERE/10_auth.sql" >/dev/null 2>&1
  psql_db "$db" -f "$HERE/15_probe_helpers.sql" >/dev/null 2>&1
}

apply_hardening() {
  for m in "${NEW_MIGRATIONS[@]}"; do apply_migration "$1" "$MIGRATIONS/$m"; done
}

report() {
  local db="$1" title="$2"
  echo
  echo "== $title"
  psql_db "$db" -At -F ' | ' -c \
    "SELECT CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END, phase, label,
            CASE WHEN passed THEN '' ELSE 'expected ' || expected || ', got ' || actual END
     FROM security_test.results ORDER BY ctid"
  local failures
  failures="$(psql_db "$db" -At -c "SELECT count(*) FROM security_test.results WHERE NOT passed")"
  [[ "$failures" == 0 ]] || FAILED=1
}

expect_migration_failure() {
  local db="$1" migration="$2" label="$3"
  if apply_migration "$db" "$MIGRATIONS/$migration" 2>"$WORK/neg"; then
    echo "FAIL | negative | $label | migration applied but should have aborted"
    FAILED=1
  else
    echo "PASS | negative | $label | aborted: $(grep -o 'ERROR:.*' "$WORK/neg" | head -1)"
  fi
}

"$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/pg.log" -w \
  -o "-p $PORT -k $SOCK -c listen_addresses=''" start >/dev/null
echo "PostgreSQL: $(psql_db postgres -Atc 'SHOW server_version')"

for shape in clean production; do
  db="sec_$shape"
  build_db "$db" "$shape"
  psql_db "$db" -f "$HERE/20_seed.sql" >/dev/null
  psql_db "$db" -f "$HERE/30_before.sql" >/dev/null
  apply_hardening "$db"
  psql_db "$db" -f "$HERE/40_after.sql" >/dev/null
  report "$db" "$shape schema"
done

echo
echo "== negative preflights (each must abort and roll back)"

build_db neg_member clean
psql_db neg_member -c "CREATE ROLE legacy_intake_ops NOLOGIN;
  GRANT TRUNCATE ON public.waitlist TO legacy_intake_ops;
  GRANT legacy_intake_ops TO authenticated;" >/dev/null
expect_migration_failure neg_member "${NEW_MIGRATIONS[0]}" "TRUNCATE inherited through role membership"
[[ "$(psql_db neg_member -Atc "SELECT has_table_privilege('anon','public.waitlist','TRUNCATE')")" == t ]] \
  && echo "PASS | negative | aborted TRUNCATE migration left grants untouched" \
  || { echo "FAIL | negative | aborted TRUNCATE migration changed grants"; FAILED=1; }

build_db neg_grantor clean
psql_db neg_grantor -c "CREATE ROLE intake_grantor NOLOGIN;
  GRANT TRUNCATE ON public.anon_sessions TO intake_grantor WITH GRANT OPTION;
  SET ROLE intake_grantor; GRANT TRUNCATE ON public.anon_sessions TO anon; RESET ROLE;" >/dev/null
expect_migration_failure neg_grantor "${NEW_MIGRATIONS[0]}" "TRUNCATE granted to anon by another grantor"

build_db neg_public clean
psql_db neg_public -c "GRANT TRUNCATE ON public.waitlist TO PUBLIC" >/dev/null
if apply_migration neg_public "$MIGRATIONS/${NEW_MIGRATIONS[0]}" \
   && [[ "$(psql_db neg_public -Atc "SELECT has_table_privilege('anon','public.waitlist','TRUNCATE')")" == f ]]; then
  echo "PASS | negative | TRUNCATE granted to PUBLIC is removed"
else
  echo "FAIL | negative | TRUNCATE granted to PUBLIC is removed"; FAILED=1
fi

build_db neg_fn_member clean
psql_db neg_fn_member -c "CREATE ROLE legacy_fn_ops NOLOGIN;
  GRANT EXECUTE ON FUNCTION public.handle_new_user() TO legacy_fn_ops;
  GRANT legacy_fn_ops TO anon;" >/dev/null
expect_migration_failure neg_fn_member "${NEW_MIGRATIONS[1]}" "EXECUTE inherited through role membership"

build_db neg_profiles production
psql_db neg_profiles -c "ALTER POLICY profiles_update_own ON public.profiles USING (true)" >/dev/null
expect_migration_failure neg_profiles "${NEW_MIGRATIONS[2]}" "profiles policy drift"

# Policy names reported by a live audit; predicates there are not yet known.
build_db neg_profiles_live production
psql_db neg_profiles_live -c "DROP POLICY profiles_upsert_own ON public.profiles;
  DROP POLICY profiles_delete_own ON public.profiles;
  CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  CREATE POLICY profiles_anon_insert ON public.profiles FOR INSERT TO anon WITH CHECK (true);" >/dev/null
expect_migration_failure neg_profiles_live "${NEW_MIGRATIONS[2]}" "live-audit policy names (anon_insert/insert_own/select_own/update_own)"
[[ "$(psql_db neg_profiles_live -Atc "SELECT count(*) FROM pg_policies WHERE tablename = 'profiles'")" == 4 ]] \
  && echo "PASS | negative | aborted profiles migration left live-shaped policies untouched" \
  || { echo "FAIL | negative | aborted profiles migration changed policies"; FAILED=1; }

build_db neg_rerun clean
apply_hardening neg_rerun
psql_db neg_rerun -f "$HERE/20_seed.sql" >/dev/null
expect_migration_failure neg_rerun "${NEW_MIGRATIONS[2]}" "profiles migration is not re-applied over new policies"

POSTGREST_BIN="${POSTGREST_BIN:-$(command -v postgrest || true)}"
if [[ -n "$POSTGREST_BIN" ]]; then
  echo
  echo "== PostgREST probes (production-shaped schema, synthetic JWTs)"
  build_db rest production
  psql_db rest -f "$HERE/20_seed.sql" >/dev/null
  SECRET="$(openssl rand -hex 32)"
  b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
  jwt() {
    local h p s
    h="$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)"
    p="$(printf '%s' "$1" | b64url)"
    s="$(printf '%s.%s' "$h" "$p" | openssl dgst -binary -sha256 -hmac "$SECRET" | b64url)"
    printf '%s.%s.%s' "$h" "$p" "$s"
  }
  EXP=$(( $(date +%s) + 3600 ))
  ANON="$(jwt "{\"role\":\"anon\",\"exp\":$EXP}")"
  ATHLETE="$(jwt "{\"role\":\"authenticated\",\"sub\":\"aaaaaaaa-0000-4000-8000-000000000001\",\"exp\":$EXP}")"
  OTHER="$(jwt "{\"role\":\"authenticated\",\"sub\":\"aaaaaaaa-0000-4000-8000-000000000002\",\"exp\":$EXP}")"
  REST_PORT=55434

  start_postgrest() {
    PGRST_DB_URI="postgres://authenticator@/rest?host=$SOCK&port=$PORT" \
    PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$SECRET" \
    PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=$REST_PORT PGRST_LOG_LEVEL=crit \
    PGRST_ADMIN_SERVER_PORT=$((REST_PORT + 1)) \
      "$POSTGREST_BIN" >"$WORK/postgrest.log" 2>&1 &
    PGRST_PID=$!
    for _ in $(seq 1 100); do
      [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$((REST_PORT + 1))/ready")" == 200 ]] \
        && return 0
      sleep 0.2
    done
    echo "PostgREST did not start"; cat "$WORK/postgrest.log"; exit 1
  }
  stop_postgrest() { kill "$PGRST_PID"; wait "$PGRST_PID" 2>/dev/null || true; PGRST_PID=""; }

  # probe <phase> <label> <expected status regex> <token> <method> <path> [json]
  probe() {
    local phase="$1" label="$2" want="$3" token="$4" method="$5" path="$6" body="${7:-}"
    local args=(-s -o "$WORK/body" -w '%{http_code}' -X "$method"
      -H "Authorization: Bearer $token" -H 'Content-Type: application/json'
      -H 'Prefer: return=minimal' "http://127.0.0.1:$REST_PORT$path")
    [[ -n "$body" ]] && args+=(-d "$body")
    local code; code="$(curl "${args[@]}")"
    local detail; detail="$(head -c 120 "$WORK/body" | tr '\n' ' ')"
    if [[ "$code" =~ ^($want)$ ]]; then
      echo "PASS | $phase | $label | HTTP $code ${detail}"
    else
      echo "FAIL | $phase | $label | expected $want, got HTTP $code ${detail}"; FAILED=1
    fi
  }

  run_probes() {
    local phase="$1" fn_status="$2" auth_rpc="$3" spoof="$4" own_rows="$5"
    probe "$phase" "anon POST /rpc/handle_new_user" "$fn_status" "$ANON" POST /rpc/handle_new_user '{}'
    probe "$phase" "anon POST /rpc/update_anon_session_last_seen" "204" "$ANON" POST \
      /rpc/update_anon_session_last_seen '{"anon_id_param":"5e5e5e5e-0000-4000-8000-0000000000aa"}'
    probe "$phase" "authenticated POST /rpc/update_anon_session_last_seen" "$auth_rpc" "$ATHLETE" POST \
      /rpc/update_anon_session_last_seen '{"anon_id_param":"probe"}'
    probe "$phase" "anon POST /waitlist" "201" "$ANON" POST /waitlist \
      "{\"email\":\"rest-$phase@example.invalid\",\"source\":\"probe\"}"
    probe "$phase" "anon POST /anon_sessions" "201" "$ANON" POST /anon_sessions \
      "{\"anon_id\":\"rest-$phase\"}"
    probe "$phase" "authenticated GET /waitlist returns no rows" "200" "$ATHLETE" GET /waitlist
    [[ "$(cat "$WORK/body")" == "[]" ]] || { echo "FAIL | $phase | waitlist rows visible"; FAILED=1; }
    probe "$phase" "authenticated POST /profiles for another account" "$spoof" "$OTHER" POST /profiles \
      '{"id":"aaaaaaaa-0000-4000-8000-000000000003","user_id":"aaaaaaaa-0000-4000-8000-000000000002","role":"admin","full_name":"Spoofed"}'
    probe "$phase" "owner GET /profiles" "200" "$ATHLETE" GET '/profiles?select=id,role'
    local n; n="$(grep -o '"id"' "$WORK/body" | wc -l || true)"
    if [[ "$n" == "$own_rows" ]]; then
      echo "PASS | $phase | owner sees $n own profile row(s)"
    else
      echo "FAIL | $phase | owner sees $n own profile row(s), expected $own_rows"; FAILED=1
    fi
  }

  start_postgrest
  run_probes before "400|404" "204" "201" 0
  stop_postgrest
  psql_db rest -c "DELETE FROM public.profiles WHERE full_name = 'Spoofed'" >/dev/null
  apply_hardening rest
  start_postgrest
  run_probes after "401|403|404" "401|403" "401|403" 1
  stop_postgrest
fi

echo
if [[ "$FAILED" == 0 ]]; then echo "ALL CHECKS PASSED"; else echo "CHECKS FAILED"; exit 1; fi
