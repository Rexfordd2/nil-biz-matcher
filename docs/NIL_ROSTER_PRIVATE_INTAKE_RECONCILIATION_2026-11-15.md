# NIL Roster private intake reconciliation

**Evidence date:** 2026-11-15
**Remote project:** Athlete Ledger `duuvyyvfqbzozuhzlbek`
**Organization:** Velox `xxxrgtqkxrrfajerybyd`
**Plan:** Free
**Project status at evidence time:** `ACTIVE_HEALTHY`
**Secrets:** none in this document

This records the already-applied production migration. It does not reapply SQL, change grants, change authentication, or accept a NIL Roster release.

## Migration identity

| Item | Value |
| --- | --- |
| Remote version | `20261115064747` |
| Remote name | `private_intake_read_containment` |
| Ledger rows for that version or name | 1 |
| Earlier proposed version `20261113214126` | Not present |
| Stored statement SHA-256 | `245f5d619384cadd0d3b69ae70987cf6eedcf6e1a8115735b78cad1e61598ba5` |
| Approved SHA-256 | Same value. Match is on the stored statement bytes, with no added newline. |

The statement is one guarded preflight plus two `DROP POLICY IF EXISTS` statements. It names only `Allow authenticated waitlist reads` and `Allow authenticated anon_sessions reads`. It does not create a policy, insert rows, delete rows, or drop a table.

## Local history

Supabase `migration repair` changes only `supabase_migrations.schema_migrations`. `--status applied` inserts a history row and does not run SQL. `--status reverted` deletes a history row. Neither was run. The remote row already existed once, so inserting another row would have been the wrong repair. `db push` was not run, and the migration was not executed again.

The local file uses the remote version so the CLI treats it as the applied migration:

`supabase/migrations/20261115064747_private_intake_read_containment.sql`

## Version alignment

The remote ledger has 12 versions. The local `supabase/migrations` directory has 12 files, and each filename starts with one of those versions. There are no local-only or remote-only versions.

| Remote version | Local filename prefix | Form |
| --- | --- | --- |
| `20241231` through `20260724` | Same 8 digits | `YYYYMMDD` |
| `20261115064747` | Same 14 digits | `YYYYMMDDHHMMSS` |

Supabase compares that leading digit run with `schema_migrations.version`. The 11 older files already match the rows recorded when they were applied. Renaming them to 14-digit timestamps would invent versions the ledger does not have, and a later `db push` could treat them as new migrations. They stay at their recorded names.

`20261113214126_private_intake_read_containment.sql` is not added. That version is not in the ledger. Adding it would be a second migration with the same drops.

## Live policy result

RLS is enabled and not forced on `public.waitlist` and `public.anon_sessions`.

Removed:

- `Allow authenticated waitlist reads` (`SELECT`, `authenticated`, `USING (true)`)
- `Allow authenticated anon_sessions reads` (`SELECT`, `authenticated`, `USING (true)`)

No `SELECT` or `ALL` policy remains for `authenticated` on either table. The only `SELECT` policies are anonymous `USING (false)` denies.

Preserved insert policies:

- `Allow anonymous waitlist inserts`
- `Allow authenticated waitlist inserts`
- `Allow anonymous anon_sessions inserts`

## Acceptance

Counts are totals only. No contact or session identifier was exported.

| Check | Result |
| --- | --- |
| Database role `service_role` waitlist count | 3 |
| Database role `authenticated` waitlist and session counts | 0 and 0 |
| Database role `anon` waitlist and session counts | 0 and 0 |
| Rolled-back anonymous waitlist insert | Allowed, then absent |
| Rolled-back anonymous session insert | Allowed, then absent |
| REST anonymous and synthetic signed-in reads | HTTP 200, 0 rows on both collections |
| REST service-role waitlist count | HTTP 206, `Content-Range` `0-0/3` |
| REST anonymous waitlist and session inserts | HTTP 201, then deleted with HTTP 204 |
| Synthetic auth user | Created, signed in, and deleted |
| Ending waitlist rows | 3 |
| Ending session rows | 0 |
| Leftover synthetic waitlist, session, or auth rows | 0 |

## Remaining advisor findings

Reviewed and not modified. 45 security-advisor findings remained. The groups are:

- `public.Accounts` has RLS enabled and no policies.
- `set_updated_at` and `set_workflow_updated_at` have mutable search paths.
- Anonymous and signed-in GraphQL schema visibility remains on `waitlist`, `anon_sessions`, and other public tables because table `SELECT` grants remain. REST and SQL reads of the two private collections still returned no rows.
- `handle_new_user()` and `update_anon_session_last_seen(text)` are `SECURITY DEFINER` and executable by `anon` and `authenticated`. The session function returns `void`.
- Leaked-password protection is disabled.

`anon` and `authenticated` also still have table privileges beyond `SELECT`, including `TRUNCATE`, on both private tables. Row policies do not govern `TRUNCATE`. That grant was not part of this migration and was not changed.

## Release boundary

A recorded policy fix is not NIL Roster release acceptance. Application deployment, billing changes, grant cleanup, and auth-setting changes need separate authorization.
