#!/usr/bin/env bash
# Apply ONE approved migration and record it once in
# supabase_migrations.schema_migrations, in a single transaction.
#
#   supabase/release/apply_approved_migration.sh --version V --sha256 S [--commit]
#
# Without --commit the whole transaction (pre checks, migration, post checks,
# ledger row) runs and is rolled back. With --commit it is committed only if
# every check passes.
#
# Connection comes from the standard libpq environment (PGHOST, PGPORT,
# PGUSER, PGDATABASE, PGSSLMODE, and PGPASSWORD or ~/.pgpass). Nothing secret is
# accepted on the command line.
#
# Only versions listed in approved_migrations.tsv with status "prepared" or
# "approved" can run. This never runs `supabase db push` or `migration repair`.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$(cd "$HERE/../migrations" && pwd)"
MANIFEST="$HERE/approved_migrations.tsv"
PSQL="${PSQL:-psql}"

version="" sha_arg="" commit=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) version="$2"; shift 2 ;;
    --sha256) sha_arg="$2"; shift 2 ;;
    --commit) commit=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$version" && -n "$sha_arg" ]] || { echo "usage: $0 --version V --sha256 S [--commit]" >&2; exit 2; }
[[ "$version" =~ ^[0-9]{14}$ ]] || { echo "refused: version must be 14 digits" >&2; exit 2; }

row="$(awk -F'\t' -v v="$version" 'NR > 1 && $1 == v' "$MANIFEST")"
[[ -n "$row" ]] || { echo "refused: $version is not in approved_migrations.tsv" >&2; exit 3; }
IFS=$'\t' read -r _ file manifest_sha status <<<"$row"
case "$status" in
  prepared|approved) ;;
  *) echo "refused: $version has status '$status'" >&2; exit 3 ;;
esac

path="$MIGRATIONS/$file"
[[ -f "$path" ]] || { echo "refused: $path not found" >&2; exit 3; }
actual_sha="$(sha256sum "$path" | cut -d' ' -f1)"
if [[ "$actual_sha" != "$manifest_sha" || "$actual_sha" != "$sha_arg" ]]; then
  echo "refused: SHA-256 mismatch for $file" >&2
  echo "  file     $actual_sha" >&2
  echo "  manifest $manifest_sha" >&2
  echo "  operator $sha_arg" >&2
  exit 4
fi

name="${file#"${version}"_}"
name="${name%.sql}"
pre="$HERE/checks/${version}_pre.sql"
post="$HERE/checks/${version}_post.sql"
script="$(mktemp)"
trap 'rm -f "$script"' EXIT

{
  echo '\set ON_ERROR_STOP 1'
  echo 'BEGIN;'
  echo "SET LOCAL lock_timeout = '5s';"
  echo "SET LOCAL statement_timeout = '120s';"
  echo "SELECT set_config('release.version', :'version', true) \\g /dev/null"
  echo "SELECT pg_advisory_xact_lock(hashtext('nil-roster-approved-migration')) \\g /dev/null"
  echo 'LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;'
  echo "\\i $HERE/ledger_guard.sql"
  [[ -f "$pre" ]] && echo "\\i $pre"
  echo "\\i $path"
  [[ -f "$post" ]] && echo "\\i $post"
  echo "INSERT INTO supabase_migrations.schema_migrations (version, name, statements)"
  echo "  VALUES (:'version', :'name', ARRAY[convert_from(decode(:'content_b64', 'base64'), 'UTF8')]);"
  echo "SELECT 'ledger rows for ' || :'version' || ': ' || count(*) FROM supabase_migrations.schema_migrations WHERE version = :'version';"
  if [[ "$commit" == 1 ]]; then echo 'COMMIT;'; else echo 'ROLLBACK;'; fi
} >"$script"

echo "target: ${PGUSER:-?}@${PGHOST:-?}:${PGPORT:-5432}/${PGDATABASE:-?}"
echo "migration: $file"
echo "sha256: $actual_sha"
echo "mode: $([[ "$commit" == 1 ]] && echo COMMIT || echo 'DRY RUN (rolled back)')"

"$PSQL" -X -q -At -v ON_ERROR_STOP=1 \
  -v version="$version" -v name="$name" \
  -v content_b64="$(base64 -w0 "$path")" \
  -f "$script"

recorded="$("$PSQL" -X -q -At -v ON_ERROR_STOP=1 -c \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '$version'")"
expected=$([[ "$commit" == 1 ]] && echo 1 || echo 0)
if [[ "$recorded" != "$expected" ]]; then
  echo "ERROR: ledger has $recorded row(s) for $version after run; expected $expected" >&2
  exit 5
fi
echo "result: ledger rows for $version = $recorded"
