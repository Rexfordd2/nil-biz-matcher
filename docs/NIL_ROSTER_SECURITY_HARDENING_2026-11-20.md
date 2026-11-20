# NIL Roster security hardening (proposed, not applied)

**Prepared:** 2026-11-20
**Remote project:** Athlete Ledger `duuvyyvfqbzozuhzlbek`
**Builds on:** `20261115064747_private_intake_read_containment` (applied; not reapplied, not renamed)
**Status:** Proposed. None of these migrations has been applied to production.
**Secrets:** none in this document

## Evidence limits

This run had no Supabase credentials, so production grants, policies, and function definitions were not read directly. The findings come from three sources:

- The 2026-11-15 production evidence in `NIL_ROSTER_PRIVATE_INTAKE_RECONCILIATION_2026-11-15.md`. It records that `anon` and `authenticated` have `TRUNCATE` on both private tables, and that both `SECURITY DEFINER` functions are executable by `anon` and `authenticated`.
- The repository migrations, `supabase/schema.sql`, and the production-shaped fixture.
- A disposable PostgreSQL 16 cluster with synthetic Supabase-like roles, plus PostgREST 12.2.3.

Each migration starts with a preflight that aborts if production differs from the modeled shape. Run the read-only queries at the end of this document before approving.

## Proposed migrations

Each one is a separate approval and runs in its own transaction.

| Version | File | SHA-256 |
| --- | --- | --- |
| `20261120213000` | `revoke_private_intake_truncate.sql` | `4218b0900dc1be0083ba029991b9e8296f2ccc2e32329b5f442f0be7faea4840` |
| `20261120213100` | `restrict_security_definer_execute.sql` | `fef4c677a9012dd61d19398294450a7d969f6b39c72519ff49db6ed0cc0ac0a2` |
| `20261120213200` | `profiles_owner_policies_by_id.sql` | `2269f2b5a9e2d5d7dd21314393d38608be941cb3ef8b5e171a23cb3b018491eb` |

All three sort after `20261115064747`. None repeats the private-intake policy drops.

## 1. TRUNCATE on `waitlist` and `anon_sessions`

**Source of the grant.** Supabase default privileges give `ALL` on new `public` tables to `anon`, `authenticated`, and `service_role`. `ALL` includes `TRUNCATE`, `REFERENCES`, and `TRIGGER`.

**Why RLS does not cover it.** Row policies do not apply to `TRUNCATE`. Any session running as `anon` or `authenticated` can empty either table. PostgREST has no truncate operation, so the exposure is a direct-SQL path (for example, through a future `SECURITY INVOKER` function). It is a defense-in-depth gap, not a REST-reachable bug.

**Paths checked.** A `REVOKE` run by the table owner removes only grants that the owner made, and only from the named grantees. The migration therefore:

1. Revokes `TRUNCATE` from `PUBLIC`, `anon`, and `authenticated`.
2. Aborts if `TRUNCATE` is still reachable by `anon` or `authenticated` through any role they belong to, a grant from another grantor, or `PUBLIC`. `SET ROLE` paths count even for `NOINHERIT` roles.

**Preserved:**

- Rows.
- RLS policies, including the 2026-11-15 containment.
- Every non-`TRUNCATE` table privilege.
- `service_role` `TRUNCATE`.

**Not changed:** default privileges, so new tables still get `TRUNCATE` for the API roles.

## 2. SECURITY DEFINER functions

| Function | Who can invoke today | Reachable through PostgREST RPC | Legitimate caller |
| --- | --- | --- | --- |
| `handle_new_user()` (trigger) | `PUBLIC`, `anon`, `authenticated`, `service_role` | No. PostgREST returns 404 `PGRST202` because it does not expose trigger functions. A direct SQL call fails with `0A000`. | The `on_auth_user_created` trigger only |
| `update_anon_session_last_seen(text)` | `PUBLIC`, `anon`, `authenticated`, `service_role` | Yes, `POST /rpc/update_anon_session_last_seen` | `anon`, from `src/lib/userData.ts` when signed out |

**Change:**

- Revoke `EXECUTE` on `handle_new_user()` from `PUBLIC`, `anon`, and `authenticated`. Trigger firing does not check `EXECUTE`. The tests confirm that sign-up as `supabase_auth_admin` still creates the profile.
- Remove `PUBLIC` and `authenticated` from `update_anon_session_last_seen(text)`, and keep `anon` and `service_role`.
- Function bodies and `search_path` are unchanged. Both functions already pin `search_path = public`.

**Residual, not changed:** `anon` can still create or refresh any `anon_id` string, either through this RPC or through the existing `anon_sessions` insert policy, and the text length is not bounded.

## 3. `profiles` role and ownership

**Does `profiles.role` grant privileges?** No. Nothing in the API, the client, or the SQL policies authorizes on `profiles.role` or on `user_metadata`. Privileged gates read only admin-controlled `app_metadata`: the workflow canary and the Athlete Houze canary. Onboarding copy says roles grant no elevated access.

**Is role assignment validated?** No. `handle_new_user()` copies `raw_user_meta_data->>'role'` unvalidated, so any self-registered account can store `admin`. An owner can also update their own row's `role`. This is harmless only while `role` stays display-only. Any future privileged check must read `app_metadata`.

**Can anonymous visitors insert profiles?** The `anon` database role cannot: `auth.uid()` is NULL, and the policy check fails with `42501`. Supabase anonymous-auth users run as `authenticated` and follow the same rules as signed-in users.

**Ownership defect (production shape).** In the production-shaped schema, `profiles.user_id` is an ordinary nullable column, not generated from `id`. With the current `auth.uid() = user_id` policies:

- A signed-in user can insert a profile whose `id` is another account that has no profile yet, with any `role` and `full_name`. Tested: HTTP 201 through PostgREST.
- Profiles created at sign-up have `user_id` NULL, so their owners cannot read them.

**Fix.** Key the four owner policies on `id`, the `auth.users` key, scoped `TO authenticated`. Insert and update also require `user_id` to be NULL or equal to `id`. The preflight requires the four current policies to match exactly, so the migration aborts on drift or if run twice.

## Test evidence

Command (local and disposable only):

`PG_BIN=/usr/lib/postgresql/16/bin POSTGREST_BIN=/path/to/postgrest supabase/tests/security/run.sh`

Result: 115 checks passed, 0 failed. The checks cover:

- **Both schemas:** clean migration replay, and the production-shaped fixture plus migrations.
- **Before the fix:** each finding reproduced.
- **After the fix:**
  - `TRUNCATE` is denied to `anon`, `authenticated`, and `authenticator` via `SET ROLE`, and `service_role` keeps it.
  - Inserts into `waitlist` and `anon_sessions` still succeed, and reads by client roles still return 0 rows.
  - Stored rows, policies, and non-`TRUNCATE` grants are unchanged.
  - Sign-up still runs the trigger, and the `anon` session RPC still creates and refreshes sessions.
  - `authenticated` gets 42501 on the session RPC.
  - The `profiles` cross-account insert, row move, and cross-account update are all denied, and owners can read and update their own row.
- **Negative preflights:**
  - The `TRUNCATE` migration aborts and leaves grants untouched when the privilege comes through a role membership or another grantor.
  - A `PUBLIC` `TRUNCATE` grant is removed.
  - The `EXECUTE` migration aborts when the privilege is inherited.
  - The `profiles` migration aborts on policy drift and on re-run.
- **PostgREST 12.2.3:** run before and after on the production-shaped schema.

## Read-only production preflight

Run these as the database owner before approving. They change nothing.

```sql
SELECT c.relname, a.grantor::regrole, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee, a.privilege_type
FROM pg_class c, aclexplode(c.relacl) a
WHERE c.oid IN ('public.waitlist'::regclass, 'public.anon_sessions'::regclass)
ORDER BY 1, 3, 4;

SELECT r.rolname AS member_of FROM pg_roles r
WHERE pg_has_role('anon', r.oid, 'MEMBER') OR pg_has_role('authenticated', r.oid, 'MEMBER');

SELECT p.oid::regprocedure, p.prosecdef, p.proconfig, p.proacl, md5(p.prosrc)
FROM pg_proc p WHERE p.oid IN ('public.handle_new_user()'::regprocedure, 'public.update_anon_session_last_seen(text)'::regprocedure);

SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles' ORDER BY policyname;

SELECT attname, attgenerated FROM pg_attribute
WHERE attrelid = 'public.profiles'::regclass AND attname IN ('id', 'user_id');

SELECT count(*) FILTER (WHERE user_id IS NULL) AS null_user_id,
       count(*) FILTER (WHERE user_id IS NOT NULL AND user_id <> id) AS user_id_differs_from_id,
       count(*) AS total
FROM public.profiles;
```

Expected for the migrations to apply as written:

- Owner-granted `TRUNCATE` entries for `anon` and `authenticated`.
- No membership roles that hold `TRUNCATE`.
- The four `profiles` policies exactly as listed in the migration preflight.

If `user_id_differs_from_id` is non-zero, do not apply migration 3. Review those rows first: ownership would move from `user_id` to `id`.

## Release boundary

Approving or applying these migrations is separate from NIL Roster release acceptance. Production deployment, migration application, secret installation, and reporting activation each need separate founder authorization.
