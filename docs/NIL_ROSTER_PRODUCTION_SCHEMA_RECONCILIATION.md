# NIL Roster production schema reconciliation

**Audit date:** 2026-07-24  
**Local rehearsal date:** 2026-07-27  
**Remote project ref (context only):** `duuvyyvfqbzozuhzlbek`  
**Branch:** `plan/nil-roster-production-reconciliation`  
**Secrets:** none in this document (no passwords, keys, or connection strings)

**Status:** Local ledger rehearsal **PASS**. Commands below are the approved remote procedure and are **NOT EXECUTED REMOTELY** in this document or the rehearsal commit.

---

## 0. Local rehearsal result (authoritative)

Disposable local Supabase modeled the verified production condition:

- production-shaped tables present (`waitlist`, richer `profiles`, `athlete_profiles` with `user_id text`, `saved_businesses`, `businesses`, `user_businesses`)
- five synthetic `athlete_profiles` rows (UUID-shaped text IDs only)
- expected bootstrap/recruiting/anon/search/workflow tables absent
- empty `supabase_migrations.schema_migrations` ledger
- all local migration files present on disk
- no localStorage cutover

### Migration dependency (read from committed SQL)

| Question | Result |
|----------|--------|
| Does `20260723` create `public.set_workflow_updated_at()`? | **Yes** |
| Does `20260723` require an object first created by `20260724`? | **No** |
| Can `20260723` run before `20260724`? | **Yes** |
| Can `20260724` run after `20260723`? | **Yes** (additive; `CREATE OR REPLACE` for shared helper) |
| Can `20260724` run manually before `20260723`? | **Yes** |
| Is `20260724` safely rerunnable? | **Yes** (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` / `CREATE OR REPLACE`) |
| Migration-order SQL defect? | **No** — no repository SQL correction required |

### CLI ordering proof

1. Plain `supabase db push` **after** marking `20260724` applied while `20260723` is still pending is **REJECTED**:
   - CLI message: local migration files to be inserted before the last migration; rerun with `--include-all`
2. `supabase db push --include-all` in that state **ACCEPTS** and applies `20260723` exactly once
3. Historical SQL is **never replayed** when those versions are marked applied first
4. Failure/resume: interrupt after reconcile SQL + historical/`20260724` repairs; resume with `db push --include-all` succeeds; synthetic rows intact; no destructive repair needed

---

## 1. Current migration-ledger state (production audit)

- `supabase_migrations` schema: **absent** (or empty relative to local versions)
- Live objects were created outside the CLI migration ledger

## 2. Existing live tables (public)

| Table | Notes |
|-------|-------|
| `Accounts` | Present; out of local migration scope; leave untouched |
| `athlete_profiles` | Present; `user_id text` PK; RLS on |
| `businesses` | Present; matches canonical migration shape |
| `profiles` | Present; richer than bootstrap; RLS on |
| `saved_businesses` | Present |
| `user_businesses` | Present |
| `waitlist` | Present; lower(email) unique + anon_id indexes |

## 3. Missing live tables (audited set)

`athlete_profile`, `onboarding_progress`, `orgs`, `org_contacts`, `user_targets`, `recruiting_targets`, `anon_sessions`, `user_data`, `search_cache`, `opportunities`, `deals`, `events`

## 4. Known schema divergence

- `athlete_profiles.user_id`: live **text** vs historical migration **uuid**
- Live RLS on `athlete_profiles` uses `(auth.uid())::text` casts
- Shared `public.set_updated_at()` exists; dependents: `profiles`, `athlete_profiles`
- Empty migration ledger vs 11 local migration files

## 5. athlete_profiles text-versus-uuid decision

**Preserve `user_id text` remotely** (strategy 1).

Aggregate evidence (no IDs displayed):

- rows: 5
- nulls: 0
- duplicate extras: 0
- valid UUID-format strings: 5
- invalid UUID-format: 0
- matching `auth.users`: 5

Conversion to uuid is deferred to a future dedicated migration if ever required. Workflow activation does not need it.

## 6. Historical migration realization

| Version | Classification | Future ledger action | Reason |
|---------|----------------|----------------------|--------|
| 20241231 | partial + incompatible | mark applied **after** 20260724 SQL exists | waitlist/profiles/saved/athlete_profiles exist; recruiting bootstrap missing; athlete_profiles type incompatible |
| 20250101 | partial | mark applied **after** 20260724 SQL exists | waitlist.anon_id exists; anon_sessions/user_data missing |
| 20251227 | not realized | mark applied **after** 20260724 SQL exists | org_contacts absent; notes/source_url supplied by 20260724 |
| 20260128 | fully realized | mark applied | waitlist indexes/policies match live |
| 20260201 | not realized | mark applied **after** 20260724 SQL exists | user_data created by 20260724 |
| 20260202 | partial | mark applied **after** 20260724 SQL exists | profiles.user_id present; orgs/contacts/targets missing until 20260724 |
| 20260203 | incompatible / superseded | mark applied | live text PK + shared set_updated_at already present; must never replay uuid DDL |
| 20260205 | not realized | mark applied **after** 20260724 SQL exists | search_cache created by 20260724 |
| 20260223 | fully realized | mark applied | businesses + user_businesses match |
| 20260723 | not realized | **remain pending** then apply via tooling | workflow tables absent |
| 20260724 | not realized | apply SQL manually, then mark applied | forward reconciliation |

## 7. Selected baseline strategy

**Option A** — apply forward reconciliation SQL under review, mark historical versions applied (only when realized by live schema and/or 20260724), then apply pending workflow migration with `--include-all`.

Rejected:

- **Option B** squash — higher process risk; local clean history already works
- **Option C** rebuild — production has users/data; not disposable
- **Leaving 20260724 unrepaired after manual apply** — forces tooling to re-run reconcile SQL; additive but unnecessary policy churn; not selected
- **SQL reorder / duplicate helper into only one file** — not required; both migrations already define compatible `set_workflow_updated_at`

## 8. Versions to mark applied (after 20260724 SQL is present)

`20241231`, `20250101`, `20251227`, `20260128`, `20260201`, `20260202`, `20260203`, `20260205`, `20260223`, `20260724`

## 9. Version that remains pending until tooling apply

`20260723` only

## 10. Forward migrations purpose

### `20260724_reconcile_nil_roster_production_schema.sql`

Creates missing recruiting/bootstrap/anon/search objects, RLS, grants, `set_workflow_updated_at()`, and `update_anon_session_last_seen()`. Does not touch `athlete_profiles` type or shared `set_updated_at()`. Does not create workflow tables.

### `20260723_nil_roster_workflow_cloud_persistence.sql`

Creates `opportunities`, `deals`, `events` with ownership RLS and `set_workflow_updated_at` triggers. Independently executable; does not depend on 20260724 objects.

---

## 11. APPROVED REMOTE SEQUENCE

**NOT EXECUTED REMOTELY**

Require founder authorization before any remote step. Confirm target project ref `duuvyyvfqbzozuhzlbek` interactively. Do not paste passwords into tickets or git.

### Phase A — Manual reconcile SQL

1. Apply the exact file `supabase/migrations/20260724_reconcile_nil_roster_production_schema.sql` through a reviewed SQL editor / controlled read-write session against production.
2. **Verify immediately:**
   - tables exist: `athlete_profile`, `onboarding_progress`, `orgs`, `org_contacts`, `user_targets`, `recruiting_targets`, `anon_sessions`, `user_data`, `search_cache`
   - workflow tables still absent: `opportunities`, `deals`, `events`
   - `athlete_profiles.user_id` still `text`
   - existing row counts for waitlist/profiles/athlete_profiles/saved_businesses/businesses/user_businesses unchanged
3. **Stop if** any verification fails. Do not repair the ledger yet.

### Phase B — Ledger repairs (historical + 20260724)

Expected ledger after this phase:

`20241231`, `20250101`, `20251227`, `20260128`, `20260201`, `20260202`, `20260203`, `20260205`, `20260223`, `20260724`

Pending local file still visible: `20260723`

```bash
# NOT EXECUTED REMOTELY
# Confirm linked project ref before running. Never use these against an unverified target.

supabase migration repair --status applied 20241231
supabase migration repair --status applied 20250101
supabase migration repair --status applied 20251227
supabase migration repair --status applied 20260128
supabase migration repair --status applied 20260201
supabase migration repair --status applied 20260202
supabase migration repair --status applied 20260203
supabase migration repair --status applied 20260205
supabase migration repair --status applied 20260223
supabase migration repair --status applied 20260724

supabase migration list
```

4. **Verify:** `migration list` shows Remote filled for historical + `20260724`, and `20260723` present locally with empty Remote column.
5. **Stop if** any unexpected version appears, or if `20260723` is missing from local files.

### Phase C — Apply workflow migration (tooling)

Because `20260724` is already marked applied, plain `supabase db push` is rejected by the CLI for the lower pending version. Local rehearsal proved the required flag is `--include-all`.

```bash
# NOT EXECUTED REMOTELY
supabase db push --include-all
```

Expect tooling to apply **only**:

- `20260723_nil_roster_workflow_cloud_persistence.sql`

6. **Verify immediately:**
   - `opportunities`, `deals`, `events` exist
   - RLS enabled; four ownership policies each for `authenticated`
   - no anon policies on workflow tables (anon CRUD blocked by RLS)
   - triggers call `set_workflow_updated_at`
   - `profiles` / `athlete_profiles` triggers still call `set_updated_at`
   - `athlete_profiles.user_id` still `text`
   - existing production row counts unchanged
   - `migration list` shows all eleven versions applied once; no pending local migrations

### Expected final ledger (exactly once each)

| Version | Status | How recorded |
|---------|--------|--------------|
| 20241231 | applied | `migration repair --status applied` |
| 20250101 | applied | `migration repair --status applied` |
| 20251227 | applied | `migration repair --status applied` |
| 20260128 | applied | `migration repair --status applied` |
| 20260201 | applied | `migration repair --status applied` |
| 20260202 | applied | `migration repair --status applied` |
| 20260203 | applied | `migration repair --status applied` |
| 20260205 | applied | `migration repair --status applied` |
| 20260223 | applied | `migration repair --status applied` |
| 20260723 | applied | `supabase db push --include-all` |
| 20260724 | applied | manual SQL + `migration repair --status applied` |

### Who applies what

| Version | Manual SQL? | Migration tooling? |
|---------|-------------|--------------------|
| 20260724 | **Yes** (Phase A) | No (ledger only via repair) |
| 20260723 | No | **Yes** (`db push --include-all`) |
| 20241231–20260223 | No | Ledger only via repair (SQL must not replay) |

### Stop conditions

- Wrong project ref / unexpected linked project
- `athlete_profiles.user_id` type change
- Row-count regression on existing production-shaped tables
- `db push` without `--include-all` after `20260724` is marked (will fail closed — do not force alternate unsafe repairs)
- Any attempt to replay historical incompatible UUID DDL
- Feature flag / localStorage cutover creeping into this change set

### Recovery / resume (proven locally)

If Phase A+B completed but Phase C did not:

1. Re-check ledger: historical + `20260724` applied; `20260723` pending; workflow tables absent
2. Re-run **only** `supabase db push --include-all`
3. Do not revert repairs; do not drop tables; do not re-apply historical SQL

If Phase A applied SQL but repairs were not done:

1. Verify reconcile objects still present
2. Continue Phase B then Phase C

Rehearsal showed a second `db push --include-all` after success reports up-to-date and does not duplicate objects.

---

## 12. Post-apply verification checklist

- [ ] `opportunities`, `deals`, `events` exist with RLS + four ownership policies each
- [ ] Missing bootstrap/recruiting/anon/search tables exist
- [ ] `athlete_profiles.user_id` still `text`
- [ ] `set_updated_at` dependents on `profiles` and `athlete_profiles` unchanged
- [ ] Workflow triggers call `set_workflow_updated_at`
- [ ] Ledger contains exactly the eleven versions above; no pending incompatible SQL
- [ ] `VITE_WORKFLOW_CLOUD_PERSISTENCE` still disabled in Vercel
- [ ] No localStorage cutover

## 13. Containment / rollback

- Feature flag remains off; no UI cutover (PR-4B not started)
- Forward SQL is additive; rollback = leave new empty tables unused
- Do not DROP newly created tables without a separate reviewed plan
- Do not reverse ledger repairs without founder authorization

## 14. PR-4B prerequisites

- This reconciliation applied successfully on production
- Workflow repository integration green against remote
- Explicit authorization to enable cloud persistence flag
- Import/cutover plan for localStorage keys (`opps.store`, etc.) reviewed separately

## 15. Local rehearsal artifacts

Directory: `test/nil-roster-ledger-reconciliation-rehearsal/`

- production-shaped local baseline/overlay SQL (synthetic only)
- `RESULTS.json` from disposable local runs
- Does not contain credentials or production data
