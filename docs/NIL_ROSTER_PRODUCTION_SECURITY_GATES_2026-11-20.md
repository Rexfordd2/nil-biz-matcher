# NIL Roster production security gates: release preparation

**Prepared:** 2026-11-20
**Remote project:** Athlete Ledger `duuvyyvfqbzozuhzlbek`
**Baseline:** PR #18 at `bf93f6e2221ad859820c6aa5c87439594ff7cc5e`
**Evidence:** `ATHLETE_LEDGER_PRODUCTION_SECURITY_PREFLIGHT_2026-11-20.md`, as summarized in the founder decisions of 2026-11-20. That file is not in this repository, and this run had no production access. No production SQL was read or run. All results below come from the disposable PostgreSQL 16 model.
**Status:** Prepared for approval. Nothing here has been applied. Each migration needs its own founder approval.
**Secrets:** none in this document

## Execution set

| Order | Version | File | SHA-256 | Status |
| --- | --- | --- | --- | --- |
| applied | `20261115064747` | `private_intake_read_containment.sql` | `245f5d619384cadd0d3b69ae70987cf6eedcf6e1a8115735b78cad1e61598ba5` | Recorded once. Do not re-run or repair. |
| 1 | `20261120213000` | `revoke_private_intake_truncate.sql` | `4218b0900dc1be0083ba029991b9e8296f2ccc2e32329b5f442f0be7faea4840` | Prepared. Bytes unchanged from PR #18. |
| 2 | `20261120213100` | `restrict_security_definer_execute.sql` | `fef4c677a9012dd61d19398294450a7d969f6b39c72519ff49db6ed0cc0ac0a2` | Prepared. Bytes unchanged from PR #18. |
| — | `20261120213200` | `profiles_owner_policies_by_id.sql` | `2269f2b5a9e2d5d7dd21314393d38608be941cb3ef8b5e171a23cb3b018491eb` | **Withdrawn.** Removed from `supabase/migrations`. The runner refuses it, and its ledger guard aborts if the version ever appears. |
| 3 | `20261120233000` | `drop_dormant_profiles_anon_insert.sql` | `ecb426a66197d86f3b26cc1c0d0cecc9f5456624d61c9858f02a95e37212ec90` | Candidate. The runner refuses it until the manifest says `approved`. |

The manifest is `supabase/release/approved_migrations.tsv`. Only versions listed there with status `prepared` or `approved` can run.

## How every migration is executed

Never run `supabase db push` or `supabase migration repair`. Use only:

```bash
supabase/release/apply_approved_migration.sh --version <V> --sha256 <S>            # dry run, rolled back
supabase/release/apply_approved_migration.sh --version <V> --sha256 <S> --commit   # only after approval
```

**Connection.** The runner reads the standard libpq environment and takes no secret on the command line. Use the session pooler (port 5432) with user `postgres.duuvyyvfqbzozuhzlbek`. The earlier `28P01` came from this user-format mismatch. Keep the password in `~/.pgpass` or let `psql` prompt for it. No rotation is needed.

```bash
export PGHOST=<session-pooler-host> PGPORT=5432 PGDATABASE=postgres \
       PGUSER=postgres.duuvyyvfqbzozuhzlbek PGSSLMODE=require
```

**What one run does.** Everything happens in a single transaction:

1. Sets `lock_timeout 5s` and `statement_timeout 120s`, and takes an advisory lock plus a lock on the ledger table.
2. Refuses before any SQL runs if the version is not in the manifest, its status is not runnable, or the file's SHA-256 differs from either the manifest or the `--sha256` argument.
3. Runs the ledger guard, `supabase/release/ledger_guard.sql`. It aborts if:
   - the version is already recorded;
   - `20261115064747` is not recorded exactly once;
   - a withdrawn version (`20261113214126` or `20261120213200`) is recorded;
   - a later version is already recorded, which would make history out of order.
4. Runs `checks/<V>_pre.sql`, then the exact migration file, then `checks/<V>_post.sql`.
5. Inserts one ledger row: `version`, `name`, and `statements = ARRAY[<exact file bytes>]`. The stored statement hashes to the approved SHA-256. This is tested.
6. Rolls back on a dry run. With `--commit` it commits only if every step passed. Any error rolls back the migration and the ledger row together.

## 1. Migration 1 (`20261120213000`): execution and postconditions

**Scope:** `REVOKE TRUNCATE ON public.waitlist, public.anon_sessions FROM PUBLIC, anon, authenticated`. The migration aborts if `TRUNCATE` is still reachable by `anon` or `authenticated` through any membership or grantor.

**Execution, after approval:**

```bash
supabase/release/apply_approved_migration.sh --version 20261120213000 \
  --sha256 4218b0900dc1be0083ba029991b9e8296f2ccc2e32329b5f442f0be7faea4840            # dry run
supabase/release/apply_approved_migration.sh --version 20261120213000 \
  --sha256 4218b0900dc1be0083ba029991b9e8296f2ccc2e32329b5f442f0be7faea4840 --commit
```

**Preconditions** (`checks/20261120213000_pre.sql`, in the same transaction): `service_role` holds `TRUNCATE` on both tables. The check also snapshots row counts, policies, RLS flags, and every non-`TRUNCATE` ACL entry, with grantor.

**Postconditions** (`checks/20261120213000_post.sql`, in the same transaction; any failure rolls back):

| Must hold | Preserves |
| --- | --- |
| `waitlist` and `anon_sessions` row counts are unchanged. | Stored rows |
| Every policy on both tables is byte-identical in `pg_policies`, and the RLS enabled/forced flags are unchanged. | Existing RLS policies |
| `anon` INSERT on `waitlist` and `anon_sessions`, and `authenticated` INSERT on `waitlist`, are still granted. All non-`TRUNCATE` ACL entries are unchanged. | Existing INSERT workflows |
| `service_role` still has `TRUNCATE` on both tables. | `service_role` privileges |
| No role reachable by `anon` or `authenticated` holds `TRUNCATE` on either table. | The fix itself |

**After commit (read-only):** run `supabase/release/privilege_inventory.sql`. The `waitlist` and `anon_sessions` rows must no longer list `TRUNCATE` under `db_only_destructive`. Then run the 2026-11-15 REST acceptance again: an anonymous insert returns 201, and anonymous and signed-in reads return 0 rows.

**Rollback:** the transaction rolls back on any failure. A deliberate reversal after commit would be a new reviewed migration (`GRANT TRUNCATE ... TO anon, authenticated`) with its own version. Do not delete the ledger row.

## 2. Migration 2 (`20261120213100`): execution and postconditions

**Scope:**

- Revoke `EXECUTE` on `handle_new_user()` from `PUBLIC`, `anon`, and `authenticated`.
- Revoke `EXECUTE` on `update_anon_session_last_seen(text)` from `PUBLIC` and `authenticated`.
- Grant it explicitly to `anon` and `service_role`.

Function bodies are unchanged.

**Execution, after approval:** run the same two commands as migration 1, with `--version 20261120213100 --sha256 fef4c677a9012dd61d19398294450a7d969f6b39c72519ff49db6ed0cc0ac0a2`.

**Preconditions** (`checks/20261120213100_pre.sql`):

- An enabled `auth.users` trigger calls `handle_new_user()`.
- Both functions are `SECURITY DEFINER`.
- The check snapshots each function's OID, owner, return type, `prosecdef`, volatility, `proconfig`, and `md5(prosrc)`; the trigger definitions; and the profile and session counts.

**Postconditions** (`checks/20261120213100_post.sql`, in the same transaction):

| Must hold | Verifies |
| --- | --- |
| Each function's OID, owner, return type, security mode, volatility, settings, and body hash are unchanged. | Function bodies unchanged |
| The sign-up trigger definition and enabled state are unchanged. | Trigger-based sign-up |
| `anon` can execute `update_anon_session_last_seen(text)`. | Anonymous-session RPC |
| No role reachable by `authenticated` can execute `update_anon_session_last_seen(text)`. | Authenticated RPC restriction |
| `service_role` can execute `update_anon_session_last_seen(text)`. Its `EXECUTE` on `handle_new_user()` equals the pre-snapshot. | Service role |
| Neither ACL has a `PUBLIC` entry or a NULL default ACL, and no role reachable by `anon` or `authenticated` can execute `handle_new_user()`. | No inherited client EXECUTE path |
| Profile and session row counts are unchanged. | Stored rows |

**Separate functional verification after commit:** `psql -X -f supabase/release/checks/20261120213100_verify.sql`. It runs in one transaction ending in `ROLLBACK`.

- As `anon`, it calls the session RPC and confirms the session row appears.
- As `authenticated`, the RPC gets `42501`.
- Direct calls to `handle_new_user()` are denied for `anon` and `authenticated`.
- As `service_role`, the RPC succeeds.

In the model, this script passes after the migration and fails before it, listing all three findings. Trigger firing does not check `EXECUTE`. The model shows sign-up through the `supabase_auth_admin` role still creates the profile, with `user_id = id`. A production end-to-end sign-up needs a synthetic account created, signed in, and deleted through Supabase Auth, the same as the 2026-11-15 acceptance. That writes to `auth.users`, so it needs its own approval.

## 3. Replacement migration 3 (`20261120233000`) and test results

**File:** `supabase/migrations/20261120233000_drop_dormant_profiles_anon_insert.sql`
**SHA-256:** `ecb426a66197d86f3b26cc1c0d0cecc9f5456624d61c9858f02a95e37212ec90`

**What it does:** it drops `profiles_anon_insert` and nothing else. It is a single `DO` block, so it is atomic even outside an explicit transaction (tested). It aborts, with no change, unless all of the following hold:

| Guard | Fails closed when (each tested) |
| --- | --- |
| `profiles_anon_insert` matches the reviewed definition exactly (see below). | `WITH CHECK` differs; roles differ; the command is `ALL`; the policy is absent; it is a re-run. |
| `profiles` has exactly 4 policies. `profiles_insert_own`, `profiles_select_own`, and `profiles_update_own` are permissive, `TO authenticated`, for INSERT, SELECT, and UPDATE. | There is an extra DELETE policy, or an owner policy is widened to `PUBLIC`. |
| Each owner policy depends on `profiles.id` and not on `user_id`, checked through `pg_depend` rather than by matching text. | An owner policy is keyed on `user_id`. |
| `profiles.user_id` is a stored generated column, and RLS is enabled. | `user_id` is a plain column, or RLS is disabled. |
| Effective `anon` INSERT is absent at table or column level, whether direct, through `PUBLIC`, or through any role `anon` can reach. Checked before and after. | Table grant, column grant, `PUBLIC` grant, or inherited role. |
| Row count, triggers, constraints and foreign keys, every column's generation expression, the table ACL, and the three owner policies are identical after the drop. | Any change |

**Reviewed definition: confirm before approval.** The exact production row for `profiles_anon_insert` is in the preflight evidence, which this run could not read. The migration encodes:

| `permissive` | `roles` | `cmd` | `qual` | `with_check` |
| --- | --- | --- | --- | --- |
| `PERMISSIVE` | `{anon}` | `INSERT` | `NULL` | `true` |

It also assumes the three owner policies are `TO authenticated`. If production differs in any of these values, the migration aborts and changes nothing. The candidate must then be recut with the evidence values, which produces a new SHA-256 and needs a new review.

**Why removing it is safe for sign-up:** the app never inserts into `profiles` from a client. Profiles are created by the `on_auth_user_created` trigger (`handle_new_user()`, `SECURITY DEFINER`), which RLS policies do not gate. The only client read is the head-count health check in `src/pages/Status.tsx`.

**Test results**, from `PG_BIN=/usr/lib/postgresql/16/bin POSTGREST_BIN=<postgrest 12.2.3> supabase/tests/security/run.sh` on PostgreSQL 16.16 with synthetic roles: **213 checks passed, 0 failed.** Coverage for migration 3:

- **Before:**
  - the policy exists and `anon` has no INSERT privilege;
  - `anon` insert gets `42501`;
  - the owner reads exactly their own sign-up row;
  - a cross-account insert gets `42501`;
  - `user_id = id` for every row;
  - with a temporary `anon` INSERT grant (rolled back), the dormant policy admits a caller-chosen `id` and `role`.
- **After:**
  - the policy is gone and the three owner policies are byte-identical;
  - there is no DELETE or ALL policy;
  - grants (including `authenticated` `TRUNCATE`, which is out of scope), triggers, constraints, columns, and every stored row are identical;
  - with the same temporary `anon` grant, the insert is now denied (`42501`);
  - sign-up through the trigger still creates the profile with `user_id = id`;
  - the owner can read their own profile and update it;
  - a legacy account can insert its own profile;
  - cross-account insert, update, and row move are denied;
  - owner DELETE affects 0 rows.
- **PostgREST 12.2.3, before and after, same results:**

  | Request | Result |
  | --- | --- |
  | `anon POST /profiles` | 401 |
  | Cross-account `POST /profiles` | 403 |
  | Own `POST` for an account without a profile | 201 |
  | Owner `PATCH` | 204 |
  | Owner `GET` | exactly 1 row with `user_id = id` |

- **Negative:** 13 drift cases plus the autocommit and re-run cases. Each aborts and leaves the `profiles` policies, ACL, and row count unchanged.

## 4. Public-table privilege inventory

**Query pack:** `supabase/release/privilege_inventory.sql`. It runs in a `READ ONLY` transaction ending in `ROLLBACK` and reads catalogs only. The harness confirms it leaves every ACL unchanged. For each public relation and each of `anon` and `authenticated`, it reports:

| Column | Meaning |
| --- | --- |
| `db_reachable` | Privileges held directly, via `PUBLIC`, or via any role reachable by `SET ROLE`. |
| `api_reachable` | `SELECT`/`INSERT`/`UPDATE`/`DELETE` that PostgREST or GraphQL can exercise, because RLS is off or a non-constant-false permissive policy covers the role. Rows are still limited by the predicate. |
| `db_only_destructive` | `TRUNCATE`, `TRIGGER`, `REFERENCES`. These have no API verb and are reachable only from SQL running as the role. `TRUNCATE` ignores RLS. |
| `granted_but_rls_blocked` | Granted, but no permitting policy exists. Harmless now, and live the moment a policy is added. |

It also reports default privileges in `public`, which are the source of the broad grants, and `SECURITY DEFINER` functions that client roles can execute.

**Modeled result** (repository schema plus the audited `profiles` shape, after migrations 1 to 3): every public table grants `anon` and `authenticated` `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`, from the default `ALL`. Production must be read with the query pack to confirm. It may also include tables the repository does not create, such as `public."Accounts"`.

**What the application actually uses** (from `src/` and `api/`):

| Table | Client role | Commands the app uses | Unnecessary for clients |
| --- | --- | --- | --- |
| `profiles` | authenticated | SELECT (Status page) | `TRUNCATE`, `TRIGGER`, `REFERENCES`, `DELETE` (no policy); all of `anon`'s grants except possibly `SELECT` |
| `athlete_profiles` | authenticated | SELECT, INSERT/UPDATE (upsert) | `TRUNCATE`, `TRIGGER`, `REFERENCES`; all `anon` grants |
| `user_data` | anon, authenticated | anon INSERT. Anon SELECT of a draft is attempted, denied by RLS, and falls back to local storage. | `TRUNCATE`, `TRIGGER`, `REFERENCES` |
| `waitlist` | none (API route uses the service role) | none from clients | `TRUNCATE` (migration 1); `TRIGGER`, `REFERENCES`; `UPDATE` and `DELETE` (deny policies only) |
| `anon_sessions` | anon (through the RPC) | none directly | `TRUNCATE` (migration 1); `TRIGGER`, `REFERENCES`; all `authenticated` grants |
| `orgs`, `org_contacts`, `user_targets` | authenticated | SELECT, INSERT, UPDATE, upsert | `TRUNCATE`, `TRIGGER`, `REFERENCES`; all `anon` grants. DELETE is not used by the recruiting UI but is policy-permitted. |
| `deals`, `events`, `opportunities` | authenticated | SELECT, upsert, DELETE | `TRUNCATE`, `TRIGGER`, `REFERENCES`; all `anon` grants |
| `saved_businesses`, `user_businesses`, `businesses` | authenticated | SELECT, upsert, UPDATE; DELETE on the first two | `TRUNCATE`, `TRIGGER`, `REFERENCES`; all `anon` grants. `businesses` DELETE has no policy. |
| `search_cache` | none (API route uses the service role) | none from clients | Every client grant |
| `onboarding_progress`, `recruiting_targets`, `athlete_profile` | authenticated, if used | per-owner policies | `TRUNCATE`, `TRIGGER`, `REFERENCES`; all `anon` grants |

**Database-level versus API reachability:**

- **`TRUNCATE`:** API-unreachable everywhere. At the database level it empties a whole table regardless of RLS. Two tables are closed by migration 1. All other public tables, including `profiles` (`authenticated` holds it), remain open at the SQL level.
- **`TRIGGER`:** API-unreachable. At the SQL level it lets the role attach any trigger function it can execute to the table. Unnecessary for every client role.
- **`REFERENCES`:** API-unreachable and low impact, since the client roles cannot create tables. Unnecessary.
- **`UPDATE`/`DELETE`:** API-reachable only where a policy permits. The model shows several tables where they are granted but no policy permits them, for example `businesses` DELETE, `profiles` DELETE, and `waitlist` UPDATE/DELETE. They are blocked today, but adding a permissive policy later would open them.

**Not changed.** The only grants these migrations change are the two approved scopes: `TRUNCATE` on the two intake tables, and `EXECUTE` on the two functions. Revoking the rest, and changing default privileges so new tables stop inheriting `ALL`, would be a separate reviewed migration with its own approval.

## 5. Clean migration ordering without duplicate history

| Ledger state | Versions |
| --- | --- |
| Today (per the 2026-11-15 reconciliation) | 12 rows. `20241231` through `20260724`, and `20261115064747` once. Local files match those 12. |
| After approved runs | Add `20261120213000`, then `20261120213100`, then `20261120233000`, one row each. Local files and the ledger then match at 15. |
| Never | `20261113214126` or `20261120213200`, or a second `20261115064747`. |

The disposable ledger mirrors the 12 production rows. The harness confirms:

- after all three runs: 15 rows, 15 distinct, no withdrawn version;
- the private-intake row is still recorded once;
- a repeated run is refused, and the row count stays 1;
- a dry run writes nothing;
- a failed postcondition rolls back both the migration and the ledger row;
- the stored statement bytes hash to the approved SHA.

**Independent approvals.** Each migration can be approved or rejected on its own. Migration 2 can run without migration 1 (tested). History stays monotonic, so after a later version is recorded, an earlier version cannot be added (tested). If migration 1 were rejected and later approved after migration 2 ran, it would need a new version. Recommended order: 1, 2, 3.

**Why not `supabase db push`:** with three new files present, `db push` applies every pending file in one run and records each one. That would take the decision out of the per-migration approval.

## 6. Application release gate: PR #17, #20 and #23

**Founder decision (2026-11-20): disable legacy authentication.** PR #20 makes the legacy `/api/auth/*`, `/api/recruiting/send` and `/api/recruiting/track` routes loadable again. The founder ruled that a missing Vercel variable is not an acceptable boundary, so they are closed in code by [PR #23](https://github.com/Rexfordd2/nil-biz-matcher/pull/23). PR #23 is stacked on #20, which is stacked on #17.

### What PR #23 changes

- `/api/auth/login`, `/register` and `/me` always return `410 LEGACY_AUTH_DISABLED`: no cookie, no Prisma access, no account creation.
- The `dev-secret-change-me` fallback is removed. Signing needs a secret of at least 32 characters and otherwise throws; verification returns null.
- The public-mode bypass helpers and `getAuthenticatedSupabaseUser.ts` are removed.
- The client's simulated local accounts exist only in `import.meta.env.DEV` builds.
- `/api/recruiting/send` always returns `503 OUTREACH_DISABLED`, with no auth lookup, public-mode check or SMTP. Drafts, templates and copy-to-clipboard are unchanged.
- `/api/recruiting/track` ignores `url`, and clicks return `410` with no `Location`. The open pixel is unchanged.
- No environment flag re-enables any of this. Re-enabling needs a code change and review.
- `/api/auth/logout`, Supabase auth, Athlete Houze and database grants are untouched.

### Release commit

The release head is `4387992905c5d24700586041b3fa03de3d9b8d76`, the head of PR #23. It is a linear descendant of production `main` `2534a012806c9190fd1c7b34a9bc8fd48731fb51`. Its five commits are:

| Commit | Source |
| --- | --- |
| `512509b`, `ed60c72` | PR #17 (head `ed60c729`) |
| `f66b0b5` | PR #20 (head `f66b0b59`) |
| `2d8ad15` | Security patch |
| `4387992` | Local acceptance suite |

`main` can therefore be fast-forwarded to exactly this commit, and production builds that same tree once.

### Results on the release head

| Check | Result |
| --- | --- |
| `tsc --noEmit` | Passes |
| Vitest | 43 files, 324/324 tests pass. 23 are new and run with a production-like env: `DATABASE_URL`, strong `AUTH_SECRET`/`JWT_SECRET`, all three public-mode flags, `APP_URL`, `SMTP_*`. 17 of them fail on the unpatched #20 head. |
| `api/esmRoutes.test.ts` | Every API route loads under native Node ESM |
| `npm run build` | Passes |
| CI and Vercel previews on `4387992` | NIL Roster CI green. Both Vercel previews built. On the `athlete-ledger` preview (`/api/build-id` reports `gitCommitSha` `4387992905c5…`): login, register and me return 410 with no `Set-Cookie`; send returns 503; click tracking returns 410 with no `Location` for absolute, `//` and `javascript:` URLs; Houze without a token returns 401; healthz and `/auth/signup` return 200. The `athlete-ledger-beta` preview is behind Vercel Authentication and was not probed. |
| Local acceptance (`tests/acceptance/supabase-local/`) | 9/9 Playwright tests pass on the current production schema, and again with migrations 1–3 applied. 0 SMTP connections. |
| Negative control: the same suite on unpatched #20 | Exactly the 3 security tests fail: one SMTP connection from the public-mode relay, a 307 to `https://evil.example/phish`, and the legacy login running instead of returning 410 |

The local acceptance stack is a disposable PostgreSQL 16 built from this branch's production-shaped fixture, migration ledger and audited `profiles` shape. It adds:
- real Supabase Auth v2.198.0 and PostgREST 12.2.3;
- the release head's production build;
- the compiled API handlers, running with production-like secrets and public-mode flags, and with SMTP pointed at a sink that counts connections.

It covers:
- signup creating the `profiles` row;
- invalid and valid login;
- session restore on reload, and logout;
- board persistence;
- blast drafts;
- cross-account isolation of `user_targets`, `orgs`, `org_contacts` and `profiles`;
- legacy, outreach and redirect denial;
- Houze returning 503 for a signed-in user;
- every route loading.

Synthetic accounts only; no email or report leaves the machine.

### Deployment mechanics (read-only findings)

- **Production is deployed by the Vercel Git integration** on every push to `main`, for two projects: `athlete-ledger` and `athlete-ledger-beta`. The GitHub workflows only validate (`deployment_owner=Vercel Git integration`).
- **Merging #17 or #20 into `main` on its own would deploy them to production without the patch.** That is not allowed.
- **Current production, the rollback target:** `main` `2534a012`, deployed 2026-08-10 22:43 PDT:
  - `athlete-ledger-ey2yoq85g-athleteledger.vercel.app` (GitHub deployment 5845063526);
  - `athlete-ledger-beta-60kcu4tyx-athleteledger.vercel.app` (GitHub deployment 5845069216).
- **The previous production before that** is `cddbb2df`.

### Gated deployment procedure (needs founder approval; not performed)

1. **Freeze.** Do not merge #17 or #20 to `main` individually. Approve #17, #20 and #23 together as one release.
2. **Confirm the release head.**
   - The head of PR #23 is still `4387992905c5d24700586041b3fa03de3d9b8d76`, or a reviewed successor.
   - `git merge-base --is-ancestor origin/main <head>` succeeds, and `origin/main` is still `2534a012`.
   - NIL Roster CI and both Vercel previews are green on that SHA.
3. **Preview checks on the `athlete-ledger` preview of that SHA**, with synthetic accounts only:
   - Supabase sign-up, then log in, refresh, and log out.
   - `POST /api/auth/login` returns 410 with no `Set-Cookie`.
   - `POST /api/recruiting/send` returns 503.
   - `/api/recruiting/track?type=click&id=x&url=https://example.com` returns 410 with no `Location`.
   - `/api/integrations/athlete-houze/report` with a signed-in token returns 503.
4. **Single production change.** Fast-forward `main` to the approved SHA in one push, for example `git push origin <sha>:main` with no merge commit. Equivalently, merge the stack top-down so that only the final merge lands on `main`:
   - retarget #23 onto #20, and #20 onto #17;
   - merge #17 into `main` only once its branch contains #20 and #23.

   Either way, `main` moves from `2534a012` straight to a tree containing all three PRs. No intermediate production deployment exists. GitHub's "Rebase and merge" or "Squash" rewrite the SHA, so if either is used, re-verify the resulting tree against `4387992` with `git diff --stat 4387992 origin/main`, which must be empty.
5. **Watch the production builds** of both Vercel projects for the new SHA. Then repeat the step-3 checks against production, with synthetic accounts.
6. **Rollback** if any check fails:
   - Use Vercel Instant Rollback (dashboard, or `vercel rollback <deployment>`) to `athlete-ledger-ey2yoq85g` and `athlete-ledger-beta-60kcu4tyx`, which are `2534a012`. This needs no git change, and the database is unaffected: the application release contains no migrations.
   - Then revert `main` with a reviewed revert. Do not force-push. After an Instant Rollback, Vercel stops assigning new production builds to the domains until someone promotes one.
7. **Migrations stay separate.** The application release does not depend on migrations 1–3. The acceptance suite passes before and after them. Apply each one only under its own approval (section 7).

**Readiness: GO for the combined release once a founder approves it, after the step-3 preview checks pass. NO-GO for #17 or #20 deployed without #23.**

### Release record (2026-11-20, founder-authorized)

**Gate 2.** The founder set `athlete-ledger-beta` Production `ATHLETE_HOUZE_REPORTING_MODE=off` through their Vercel account, and verified it from the variable's metadata. No other variables changed. The agent had no Vercel access and could not read the value. The deployed code treats any value other than `canary` as disabled.

**Gate 3.** `main` was moved from `2534a012` to `4387992905c5d24700586041b3fa03de3d9b8d76` at 16:33 PST:
- One push, with an expected-SHA lease; it was a fast-forward and nothing was forced.
- Beforehand: 5 ahead, 0 behind, and CI plus both Vercel checks green.
- No intermediate commit reached `main`.
- GitHub marked PR #17 merged. PRs #20 and #23 still show as open against their stack bases, but their commits are in `main`.

**Production deployments** of `4387992`, created 16:36 PST:

| Project | Deployment ID (GitHub) | URL | `/api/build-id` |
| --- | --- | --- | --- |
| `athlete-ledger` | 7955893109 | `athlete-ledger-ef3229nif-athleteledger.vercel.app`, served at `athlete-ledger.vercel.app` | `4387992905c5…` |
| `athlete-ledger-beta` | 7955893034 | `athlete-ledger-beta-ehlzwhme9-athleteledger.vercel.app`, served at `athlete-ledger-beta.vercel.app` | `4387992905c5…` |

**Gate 4.** Both production hosts gave identical results. No accounts were created and no mail or reports were sent.
- **Legacy auth:** login, register and me return 410 with no `Set-Cookie`.
- **Outreach and tracking:** send returns 503. Click tracking returns 410 with no `Location` for absolute, `//`, `javascript:`, relative and empty URLs.
- **Athlete Houze:** GET returns 405, and POST without a token returns 401.
- **Other routes:** healthz (Supabase connected) and ping return 200. places-search without a query returns 400. business/search and recruiting/search return 405 to POST, which proves they load without a Google call. waitlist with an invalid email returns 400.
- **Browser:**
  - signup renders with Supabase configured (not submitted);
  - a login with a nonexistent synthetic address reaches Supabase (`POST /auth/v1/token` returns 400) and shows "Invalid email or password", with no session stored;
  - `/app/recruiting/board` and `/blast` load behind the auth gate;
  - no page or console errors.

**Not verified in production** (would need an authorized synthetic account):
- a successful Supabase sign-in and signup;
- session restore;
- an existing board or drafts while signed in;
- the authenticated `503 Integration unavailable` path of the report route.

These are covered by the local acceptance suite above. Rollback was not needed. The targets remain `athlete-ledger-ey2yoq85g` and `athlete-ledger-beta-60kcu4tyx` (`2534a012`).

## 7. Outstanding founder approvals

1. **Migration 3 definition:** confirm the five `profiles_anon_insert` values above, and the owner policies' `{authenticated}` roles, against the preflight's `pg_policies` output. If they match, approve SHA `ecb426a6…12ec90` and change its manifest status to `approved` in a reviewed commit. If they differ, request a recut.
2. **Migration 1 execution:** dry run, then commit, at an approved time.
3. **Migration 2 execution:** dry run, then commit. Separately approve `20261120213100_verify.sql`; it performs rolled-back writes as `anon` and `service_role`.
4. **Migration 3 execution:** dry run, then commit, after item 1.
5. **Production sign-up smoke:** a synthetic account created, signed in, and deleted through Supabase Auth after migrations 2 and 3.
6. **Inventory read:** run `privilege_inventory.sql` against production (read-only) and review it.
7. **Follow-up least-privilege migration:** decide whether to prepare a separate migration for the remaining `TRUNCATE`/`TRIGGER`/`REFERENCES` grants and default privileges. Nothing is prepared or authorized here.
8. **Application release of PR #17 + #20 + #23:** one approval for one production deployment of the combined head, following the gated procedure in section 6.
9. **Legacy authentication:** decided on 2026-11-20: disabled in code by PR #23. Re-enabling it would need a new reviewed change.

Not requested: merges, deployment, credential rotation, billing changes, or Athlete Houze reporting activation. Reporting stays disabled.

## 8. GO/NO-GO

| Gate | Decision |
| --- | --- |
| Migration 1 | **GO for execution approval.** SHA matches. Pre/post checks and dry-run path tested. |
| Migration 2 | **GO for execution approval.** SHA matches. Pre/post checks and separate verification tested. |
| Migration 3 (replacement) | **NO-GO until approval item 1.** Tested and fail-closed, but its expected definition has not been checked against the preflight evidence by anyone who can read it. |
| Combined application release #17 + #20 + #23 (`4387992`) | **Released to production 2026-11-20 (GO).** Both projects serve `4387992`, and the production acceptance in section 6 passed. Authenticated Supabase flows are pending an authorized synthetic account. |
| #17 or #20 to production without #23 | **NO-GO.** It would restore the legacy session, outreach relay and open redirect. |
| Database migrations 1–3 | Unchanged by the application release. Each still needs its own approval. |
| Withdrawn `20261120213200` | Out of the execution set and refused by the runner. |
| Blanket `db push` / `migration repair` | **NO-GO.** |
| Production SQL changes now | **NO-GO.** Not authorized by this instruction. |
