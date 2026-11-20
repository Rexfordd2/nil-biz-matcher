#!/usr/bin/env bash
# Disposable validation for the 20261120 security hardening migrations and the
# single-migration release runner.
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
  20261120233000_drop_dormant_profiles_anon_insert.sql
)
RELEASE_VERSIONS=(20261120213000 20261120213100 20261120233000)

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
  psql_db "$db" -f "$HERE/16_profiles_audited_shape.sql" >/dev/null
  seed_ledger "$db"
}

# Mirror the production ledger: one row per pre-existing local migration file.
seed_ledger() {
  local db="$1" f v
  psql_db "$db" -c "CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY, statements text[], name text)" >/dev/null
  for f in "$MIGRATIONS"/*.sql; do
    is_new_migration "$f" && continue
    v="$(basename "$f" .sql)"
    psql_db "$db" -c "INSERT INTO supabase_migrations.schema_migrations (version, name)
      VALUES ('${v%%_*}', '${v#*_}')" >/dev/null
  done
}

# Test copy of the release tree with the candidate migration marked approved,
# so the runner can exercise it. The repository manifest stays "candidate".
STAGE="$WORK/stage/supabase"
mkdir -p "$STAGE"
cp -r "$ROOT/supabase/release" "$ROOT/supabase/migrations" "$STAGE/"
M3_SHA="$(sha256sum "$STAGE/migrations/${NEW_MIGRATIONS[2]}" | cut -d' ' -f1)"
sed -i "s/^\(20261120233000\t[^\t]*\t$M3_SHA\)\tcandidate$/\1\tapproved/" "$STAGE/release/approved_migrations.tsv"
grep -q "$M3_SHA	approved" "$STAGE/release/approved_migrations.tsv" \
  || { echo "manifest SHA for ${NEW_MIGRATIONS[2]} does not match the file"; exit 1; }
RUNNER="$STAGE/release/apply_approved_migration.sh"

manifest_sha() { awk -F'\t' -v v="$1" '$1 == v { print $3 }' "$STAGE/release/approved_migrations.tsv"; }

# run_release <db> <runner> <version> <sha> [--commit]; prints runner output, returns its status
run_release() {
  local db="$1" runner="$2" version="$3" sha="$4"; shift 4
  PGHOST="$SOCK" PGPORT="$PORT" PGUSER=postgres PGDATABASE="$db" PSQL="$PG_BIN/psql" \
    bash "$runner" --version "$version" --sha256 "$sha" "$@" >"$WORK/run.out" 2>&1
}

ledger_count() {
  psql_db "$1" -Atc "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '$2'"
}

apply_hardening() {
  for v in "${RELEASE_VERSIONS[@]}"; do
    run_release "$1" "$RUNNER" "$v" "$(manifest_sha "$v")" --commit \
      || { cat "$WORK/run.out" >&2; return 1; }
  done
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

profiles_state() {
  psql_db "$1" -Atc "SELECT md5(coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname)::text
    FROM pg_policies p WHERE tablename = 'profiles'), '') ||
    coalesce((SELECT relacl::text FROM pg_class WHERE oid = 'public.profiles'::regclass), '') ||
    (SELECT count(*) FROM public.profiles)::text)"
}

# expect_m3_abort <db> <label>: migration must abort and leave profiles untouched
expect_m3_abort() {
  local db="$1" label="$2" before
  before="$(profiles_state "$db")"
  expect_migration_failure "$db" "${NEW_MIGRATIONS[2]}" "$label"
  if [[ "$(profiles_state "$db")" == "$before" ]]; then
    echo "PASS | negative | $label: profiles policies, grants and rows untouched"
  else
    echo "FAIL | negative | $label: profiles changed after abort"; FAILED=1
  fi
}

m3_case() {
  local db="$1" label="$2" setup="$3"
  build_db "$db" production
  psql_db "$db" -f "$HERE/20_seed.sql" >/dev/null
  psql_db "$db" -c "$setup" >/dev/null
  expect_m3_abort "$db" "$label"
}

m3_case neg_m3_check "anon policy WITH CHECK differs" \
  "ALTER POLICY profiles_anon_insert ON public.profiles WITH CHECK (auth.uid() IS NULL)"
m3_case neg_m3_roles "anon policy roles differ" \
  "ALTER POLICY profiles_anon_insert ON public.profiles TO anon, authenticated"
m3_case neg_m3_cmd "anon policy is not INSERT" \
  "DROP POLICY profiles_anon_insert ON public.profiles;
   CREATE POLICY profiles_anon_insert ON public.profiles FOR ALL TO anon USING (true) WITH CHECK (true)"
m3_case neg_m3_missing "anon policy absent" \
  "DROP POLICY profiles_anon_insert ON public.profiles"
m3_case neg_m3_grant "anon holds table INSERT (policy not dormant)" \
  "GRANT INSERT ON public.profiles TO anon"
m3_case neg_m3_colgrant "anon holds column INSERT" \
  "GRANT INSERT (id, role) ON public.profiles TO anon"
m3_case neg_m3_public "PUBLIC holds INSERT" \
  "GRANT INSERT ON public.profiles TO PUBLIC"
m3_case neg_m3_member "anon inherits INSERT through a role" \
  "CREATE ROLE legacy_profile_ops NOLOGIN; GRANT INSERT ON public.profiles TO legacy_profile_ops;
   GRANT legacy_profile_ops TO anon"
m3_case neg_m3_userid_policy "owner policy keyed on user_id" \
  "ALTER POLICY profiles_select_own ON public.profiles USING (auth.uid() = user_id)"
m3_case neg_m3_owner_roles "owner policy widened to PUBLIC" \
  "ALTER POLICY profiles_update_own ON public.profiles TO public"
m3_case neg_m3_extra "unexpected DELETE policy" \
  "CREATE POLICY profiles_delete_own ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id)"
m3_case neg_m3_plain_userid "user_id not generated" \
  "ALTER TABLE public.profiles ALTER COLUMN user_id DROP EXPRESSION"
m3_case neg_m3_norls "RLS disabled" \
  "ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY"

# Atomic without an outer transaction: drift found after other reads still
# leaves nothing behind when run in autocommit mode.
build_db neg_m3_autocommit production
psql_db neg_m3_autocommit -c "GRANT INSERT ON public.profiles TO anon" >/dev/null
before="$(profiles_state neg_m3_autocommit)"
if "$PG_BIN/psql" -X -q -h "$SOCK" -p "$PORT" -U postgres -d neg_m3_autocommit -v ON_ERROR_STOP=1 \
     -f "$MIGRATIONS/${NEW_MIGRATIONS[2]}" >/dev/null 2>&1; then
  echo "FAIL | negative | autocommit run applied despite drift"; FAILED=1
elif [[ "$(profiles_state neg_m3_autocommit)" == "$before" ]]; then
  echo "PASS | negative | autocommit run aborts atomically (single DO block)"
else
  echo "FAIL | negative | autocommit run left partial changes"; FAILED=1
fi

build_db neg_m3_rerun production
psql_db neg_m3_rerun -f "$HERE/20_seed.sql" >/dev/null
apply_migration neg_m3_rerun "$MIGRATIONS/${NEW_MIGRATIONS[2]}"
expect_m3_abort neg_m3_rerun "replacement migration is not re-applied"

echo
echo "== release runner (single approved migration, ledger recorded once)"

runner_case() {
  local label="$1" want_status="$2"; shift 2
  local status=0
  run_release "$@" || status=$?
  if [[ "$status" == "$want_status" ]]; then
    echo "PASS | runner | $label | exit $status $(grep -m1 -oE '(refused|ERROR|result):.*' "$WORK/run.out" || true)"
  else
    echo "FAIL | runner | $label | expected exit $want_status, got $status"; cat "$WORK/run.out"; FAILED=1
  fi
}
runner_check() {
  if [[ "$2" == "$3" ]]; then echo "PASS | runner | $1"; else echo "FAIL | runner | $1 (got $2, want $3)"; FAILED=1; fi
}
anon_truncate() { psql_db "$1" -Atc "SELECT has_table_privilege('anon','public.waitlist','TRUNCATE')"; }

M1=20261120213000 M2=20261120213100 M3=20261120233000
build_db rr production
psql_db rr -f "$HERE/20_seed.sql" >/dev/null
ledger_before="$(psql_db rr -Atc "SELECT count(*) FROM supabase_migrations.schema_migrations")"
runner_check "disposable ledger mirrors production (12 rows, private intake once)" \
  "$ledger_before/$(ledger_count rr 20261115064747)" "12/1"

runner_case "repository manifest refuses the unapproved candidate" 3 \
  rr "$ROOT/supabase/release/apply_approved_migration.sh" "$M3" "$M3_SHA"
runner_case "withdrawn 20261120213200 is not runnable" 3 \
  rr "$RUNNER" 20261120213200 2269f2b5a9e2d5d7dd21314393d38608be941cb3ef8b5e171a23cb3b018491eb
runner_case "operator SHA mismatch refused" 4 \
  rr "$RUNNER" "$M1" 0000000000000000000000000000000000000000000000000000000000000000
runner_case "dry run of $M1 passes all checks" 0 rr "$RUNNER" "$M1" "$(manifest_sha "$M1")"
runner_check "dry run left no ledger row and no grant change" \
  "$(ledger_count rr "$M1")/$(anon_truncate rr)" "0/t"

psql_db rr -c "REVOKE INSERT ON public.anon_sessions FROM anon" >/dev/null
runner_case "postcondition failure (anon intake INSERT missing) aborts" 3 rr "$RUNNER" "$M1" "$(manifest_sha "$M1")"
runner_check "failed postcondition rolled back migration and ledger row" \
  "$(ledger_count rr "$M1")/$(anon_truncate rr)" "0/t"
psql_db rr -c "GRANT INSERT ON public.anon_sessions TO anon" >/dev/null

runner_case "commit $M1" 0 rr "$RUNNER" "$M1" "$(manifest_sha "$M1")" --commit
runner_check "$M1 recorded once; TRUNCATE revoked" "$(ledger_count rr "$M1")/$(anon_truncate rr)" "1/f"
runner_check "ledger statement bytes hash to the approved SHA-256" \
  "$(psql_db rr -Atc "SELECT encode(sha256(convert_to(statements[1], 'UTF8')), 'hex')
                      FROM supabase_migrations.schema_migrations WHERE version = '$M1'")" "$(manifest_sha "$M1")"
runner_case "re-running $M1 refused by the ledger guard" 3 rr "$RUNNER" "$M1" "$(manifest_sha "$M1")" --commit
runner_check "$M1 still recorded once" "$(ledger_count rr "$M1")" "1"
runner_case "commit $M2" 0 rr "$RUNNER" "$M2" "$(manifest_sha "$M2")" --commit
runner_case "commit $M3" 0 rr "$RUNNER" "$M3" "$M3_SHA" --commit
runner_check "ledger: 12 existing + 3 approved, each once, no withdrawn version" \
  "$(psql_db rr -Atc "SELECT count(*) || '/' || count(DISTINCT version) || '/' ||
       count(*) FILTER (WHERE version IN ('20261120213200', '20261113214126'))
     FROM supabase_migrations.schema_migrations")" "15/15/0"

build_db rr_order production
psql_db rr_order -f "$HERE/20_seed.sql" >/dev/null
runner_case "commit $M2 without $M1 (independent approval)" 0 rr_order "$RUNNER" "$M2" "$(manifest_sha "$M2")" --commit
runner_case "$M1 after a later version is refused (no out-of-order history)" 3 \
  rr_order "$RUNNER" "$M1" "$(manifest_sha "$M1")" --commit
runner_check "out-of-order attempt left TRUNCATE and ledger unchanged" \
  "$(ledger_count rr_order "$M1")/$(anon_truncate rr_order)" "0/t"

build_db rr_withdrawn production
psql_db rr_withdrawn -c "INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('20261120213200', 'profiles_owner_policies_by_id')" >/dev/null
runner_case "ledger containing withdrawn 20261120213200 is refused" 3 \
  rr_withdrawn "$RUNNER" "$M1" "$(manifest_sha "$M1")" --commit

sessions_before="$(psql_db rr -Atc "SELECT count(*) FROM public.anon_sessions")"
if psql_db rr -f "$ROOT/supabase/release/checks/20261120213100_verify.sql" >"$WORK/verify.out" 2>&1; then
  echo "PASS | runner | $M2 functional verification passes after commit $(grep -o 'verification passed.*' "$WORK/verify.out")"
else
  echo "FAIL | runner | $M2 functional verification"; cat "$WORK/verify.out"; FAILED=1
fi
runner_check "$M2 verification rolled back (no session rows left)" \
  "$(psql_db rr -Atc "SELECT count(*) FROM public.anon_sessions")" "$sessions_before"
build_db rr_unverified production
if psql_db rr_unverified -f "$ROOT/supabase/release/checks/20261120213100_verify.sql" >"$WORK/verify.out" 2>&1; then
  echo "FAIL | runner | $M2 verification passed before the migration"; FAILED=1
else
  echo "PASS | runner | $M2 verification fails before the migration: $(grep -o 'verification failed.*' "$WORK/verify.out")"
fi

echo
echo "== privilege inventory (read-only, modeled schema after all three migrations)"
inv="$WORK/inventory.txt"
acl_before="$(psql_db rr -Atc "SELECT md5(string_agg(relname || coalesce(relacl::text, ''), ',' ORDER BY relname)) FROM pg_class")"
if psql_db rr -P pager=off -f "$ROOT/supabase/release/privilege_inventory.sql" >"$inv" 2>&1; then
  echo "PASS | inventory | query pack runs in a READ ONLY transaction"
else
  echo "FAIL | inventory | query pack failed"; cat "$inv"; FAILED=1
fi
runner_check "inventory changed no grants" \
  "$(psql_db rr -Atc "SELECT md5(string_agg(relname || coalesce(relacl::text, ''), ',' ORDER BY relname)) FROM pg_class")" "$acl_before"
inv_row() {
  psql_db rr -Atc "$(sed -n '/^WITH api/,/^ORDER BY rel.relname, priv.role;/p' "$ROOT/supabase/release/privilege_inventory.sql" \
    | sed '$ s/;$//') " -F '|' | awk -F'|' -v t="$1" -v r="$2" '$1 == t && $6 == r'
}
row="$(inv_row profiles authenticated)"
[[ "$(cut -d'|' -f10 <<<"$row")" == *TRUNCATE* ]] \
  && echo "PASS | inventory | flags authenticated TRUNCATE on profiles as DB-only destructive" \
  || { echo "FAIL | inventory | profiles/authenticated row: $row"; FAILED=1; }
row="$(inv_row waitlist anon)"
[[ "$(cut -d'|' -f10 <<<"$row")" != *TRUNCATE* && "$(cut -d'|' -f9 <<<"$row")" == *INSERT* ]] \
  && echo "PASS | inventory | waitlist/anon: TRUNCATE gone, INSERT API-reachable" \
  || { echo "FAIL | inventory | waitlist/anon row: $row"; FAILED=1; }
[[ -n "${INVENTORY_OUT:-}" ]] && cp "$inv" "$INVENTORY_OUT"

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
  LEGACY="$(jwt "{\"role\":\"authenticated\",\"sub\":\"aaaaaaaa-0000-4000-8000-000000000003\",\"exp\":$EXP}")"
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
    local phase="$1" fn_status="$2" auth_rpc="$3"
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
    probe "$phase" "anon POST /profiles" "401" "$ANON" POST /profiles \
      '{"id":"aaaaaaaa-0000-4000-8000-000000000003","role":"admin"}'
    probe "$phase" "authenticated POST /profiles for another account" "403" "$OTHER" POST /profiles \
      '{"id":"aaaaaaaa-0000-4000-8000-000000000003","role":"admin","full_name":"Spoofed"}'
    probe "$phase" "account without a profile POSTs its own /profiles" "201" "$LEGACY" POST /profiles \
      '{"id":"aaaaaaaa-0000-4000-8000-000000000003","role":"athlete","full_name":"Legacy"}'
    probe "$phase" "owner PATCH own /profiles" "204" "$ATHLETE" PATCH \
      '/profiles?id=eq.aaaaaaaa-0000-4000-8000-000000000001' '{"display_name":"Renamed"}'
    probe "$phase" "owner GET /profiles" "200" "$ATHLETE" GET '/profiles?select=id,user_id,role'
    local n; n="$(grep -o '"id"' "$WORK/body" | wc -l || true)"
    if [[ "$n" == 1 ]] && grep -q '"user_id":"aaaaaaaa-0000-4000-8000-000000000001"' "$WORK/body"; then
      echo "PASS | $phase | owner sees exactly own profile row with user_id = id"
    else
      echo "FAIL | $phase | owner sees $n row(s): $(cat "$WORK/body")"; FAILED=1
    fi
    probe "$phase" "authenticated GET /profiles (Status page health check)" "200|206" "$ATHLETE" GET \
      '/profiles?select=id&limit=1'
  }

  start_postgrest
  run_probes before "400|404" "204"
  stop_postgrest
  psql_db rest -c "DELETE FROM public.profiles WHERE id = 'aaaaaaaa-0000-4000-8000-000000000003'" >/dev/null
  apply_hardening rest
  start_postgrest
  run_probes after "401|403|404" "401|403"
  stop_postgrest
fi

echo
if [[ "$FAILED" == 0 ]]; then echo "ALL CHECKS PASSED"; else echo "CHECKS FAILED"; exit 1; fi
