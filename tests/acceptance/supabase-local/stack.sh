#!/usr/bin/env bash
# Local, disposable release-acceptance stack. Never contacts a remote service.
#
#   PostgreSQL 16 (temp dir)  <- Supabase Auth (GoTrue) + PostgREST
#   server.mjs on one origin: built app + /auth/v1 + /rest/v1 + compiled /api
#   SMTP and Athlete Houze sinks that only count connections
#
#   GOTRUE_BIN=/path/to/auth POSTGREST_BIN=/path/to/postgrest \
#   PG_BIN=/usr/lib/postgresql/16/bin tests/acceptance/supabase-local/stack.sh start
#   tests/acceptance/supabase-local/stack.sh stop
#
# The database is built from DB_REF (default: the security-gates branch): the
# production-shaped fixture, the applied migration ledger and the audited
# profiles shape. MIGRATIONS=pending also applies the three prepared security
# migrations before the stack starts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HERE="$ROOT/tests/acceptance/supabase-local"
STATE="${STACK_STATE:-/tmp/nil-acceptance-stack}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
DB_REF="${DB_REF:-origin/cursor/production-security-gates-90d7}"
PG_PORT=55440 AUTH_PORT=55441 REST_PORT=55442 APP_PORT=55450

stop() {
  [[ -d "$STATE" ]] || return 0
  for f in "$STATE"/*.pid; do [[ -f "$f" ]] && kill "$(cat "$f")" 2>/dev/null || true; done
  "$PG_BIN/pg_ctl" -D "$STATE/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$STATE"
}

wait_http() {
  for _ in $(seq 1 150); do curl -s -o /dev/null "$1" && return 0; sleep 0.2; done
  echo "timed out waiting for $1" >&2; return 1
}

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() {
  local h p s
  h="$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)"
  p="$(printf '%s' "$1" | b64url)"
  s="$(printf '%s.%s' "$h" "$p" | openssl dgst -binary -sha256 -hmac "$JWT_SECRET" | b64url)"
  printf '%s.%s.%s' "$h" "$p" "$s"
}

psql_su() { "$PG_BIN/psql" -X -q -h "$STATE" -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

start() {
  stop
  mkdir -p "$STATE"
  JWT_SECRET="$(openssl rand -hex 32)"
  local exp=$(( $(date +%s) + 86400 ))
  ANON_KEY="$(jwt "{\"role\":\"anon\",\"iss\":\"supabase\",\"exp\":$exp}")"
  SERVICE_KEY="$(jwt "{\"role\":\"service_role\",\"iss\":\"supabase\",\"exp\":$exp}")"

  "$PG_BIN/initdb" -D "$STATE/data" -U postgres -A trust >/dev/null
  "$PG_BIN/pg_ctl" -D "$STATE/data" -l "$STATE/pg.log" -w \
    -o "-p $PG_PORT -k $STATE -c listen_addresses=127.0.0.1" start >/dev/null

  psql_su -f "$HERE/sql/00_roles.sql" >/dev/null

  local auth_env=(
    GOTRUE_DB_DRIVER=postgres
    GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin@127.0.0.1:$PG_PORT/postgres?sslmode=disable"
    GOTRUE_DB_MIGRATIONS_PATH="$(dirname "$GOTRUE_BIN")/migrations"
    GOTRUE_API_HOST=127.0.0.1 GOTRUE_API_PORT=$AUTH_PORT PORT=$AUTH_PORT
    API_EXTERNAL_URL="http://127.0.0.1:$APP_PORT/auth/v1"
    GOTRUE_SITE_URL="http://127.0.0.1:$APP_PORT"
    GOTRUE_URI_ALLOW_LIST="http://127.0.0.1:$APP_PORT/**"
    GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
    GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
    GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true
    GOTRUE_EXTERNAL_PHONE_ENABLED=false GOTRUE_RATE_LIMIT_EMAIL_SENT=1000
    GOTRUE_SMTP_ADMIN_EMAIL=admin@example.invalid GOTRUE_LOG_LEVEL=warn
  )
  env "${auth_env[@]}" "$GOTRUE_BIN" migrate >"$STATE/auth-migrate.log" 2>&1
  env "${auth_env[@]}" "$GOTRUE_BIN" serve >"$STATE/auth.log" 2>&1 &
  echo $! >"$STATE/auth.pid"
  wait_http "http://127.0.0.1:$AUTH_PORT/health"

  # Database shape and migrations come from the security-gates branch, which
  # carries the production-shaped fixture and the full migration ledger.
  mkdir -p "$STATE/db"
  git -C "$ROOT" archive "$DB_REF" supabase/migrations supabase/tests | tar -x -C "$STATE/db"
  local db="$STATE/db/supabase"
  psql_su -f "$db/tests/security/00_supabase_like_bootstrap.sql" >/dev/null 2>&1
  psql_su -f "$db/tests/fixtures/production_shaped_baseline.sql" >/dev/null 2>&1
  for f in "$db"/migrations/*.sql; do
    case "$(basename "$f")" in 20261120213000_*|20261120213100_*|20261120233000_*) continue ;; esac
    # Same tolerance as supabase/tests/security/run.sh for the production shape.
    "$PG_BIN/psql" -X -q -h "$STATE" -p "$PG_PORT" -U postgres -d postgres -f "$f" >/dev/null 2>&1 || true
  done
  psql_su -f "$db/tests/security/10_auth.sql" >/dev/null 2>&1
  psql_su -f "$db/tests/security/16_profiles_audited_shape.sql" >/dev/null
  if [[ "${MIGRATIONS:-current}" == pending ]]; then
    for m in 20261120213000 20261120213100 20261120233000; do
      psql_su -1 -f "$(ls "$db"/migrations/${m}_*.sql)" >/dev/null
    done
  fi

  PGRST_DB_URI="postgres://authenticator@127.0.0.1:$PG_PORT/postgres" \
  PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" \
  PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=$REST_PORT PGRST_ADMIN_SERVER_PORT=$((REST_PORT + 100)) \
  PGRST_LOG_LEVEL=crit "$POSTGREST_BIN" >"$STATE/rest.log" 2>&1 &
  echo $! >"$STATE/rest.pid"
  wait_http "http://127.0.0.1:$((REST_PORT + 100))/ready"

  # Production build of the app against the local stack.
  (cd "$ROOT" && rm -rf "$STATE/dist" && \
    VITE_SUPABASE_URL="http://127.0.0.1:$APP_PORT" VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
    VITE_PUBLIC_MODE=false VITE_APP_MODE=beta VITE_DEBUG_KEY=acceptance \
    npx vite build --outDir "$STATE/dist" --emptyOutDir >"$STATE/build.log" 2>&1)
  node "$HERE/compile-api.mjs" "$ROOT" "$STATE/api-out" >"$STATE/compile.log" 2>&1

  # Production-like API runtime: every variable that used to enable the legacy
  # session, the public-mode bypass or the mail relay is present.
  NODE_ENV=production VERCEL_ENV=production \
  DATABASE_URL="file:$STATE/legacy.db" AUTH_SECRET="$(openssl rand -hex 32)" JWT_SECRET="$(openssl rand -hex 32)" \
  VITE_PUBLIC_MODE=true NEXT_PUBLIC_PUBLIC_MODE=true PUBLIC_MODE=true \
  APP_URL="http://127.0.0.1:$APP_PORT" \
  SMTP_HOST=127.0.0.1 SMTP_PORT=55460 SMTP_USER=acceptance SMTP_PASS=acceptance SMTP_FROM=noreply@example.invalid \
  VITE_SUPABASE_URL="http://127.0.0.1:$APP_PORT" VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
  APP_PORT=$APP_PORT AUTH_PORT=$AUTH_PORT REST_PORT=$REST_PORT DIST="$STATE/dist" API_OUT="$STATE/api-out" \
  SINK_LOG="$STATE/sinks.json" \
    node "$HERE/server.mjs" >"$STATE/server.log" 2>&1 &
  echo $! >"$STATE/server.pid"
  wait_http "http://127.0.0.1:$APP_PORT/"

  cat >"$STATE/env" <<EOF
BASE_URL=http://127.0.0.1:$APP_PORT
ACCEPTANCE_SUPABASE_URL=http://127.0.0.1:$APP_PORT
ACCEPTANCE_ANON_KEY=$ANON_KEY
ACCEPTANCE_SERVICE_KEY=$SERVICE_KEY
ACCEPTANCE_PG="host=$STATE port=$PG_PORT user=postgres dbname=postgres"
ACCEPTANCE_SINK_LOG=$STATE/sinks.json
ACCEPTANCE_MIGRATIONS=${MIGRATIONS:-current}
EOF
  echo "stack ready: http://127.0.0.1:$APP_PORT (migrations: ${MIGRATIONS:-current}); env in $STATE/env"
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  *) echo "usage: $0 start|stop" >&2; exit 2 ;;
esac
