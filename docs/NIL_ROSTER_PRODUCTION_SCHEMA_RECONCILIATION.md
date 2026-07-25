# NIL Roster production schema reconciliation

**Audit date:** 2026-07-24  
**Remote project ref:** `duuvyyvfqbzozuhzlbek`  
**Branch:** `plan/nil-roster-production-reconciliation`  
**Secrets:** none in this document (no passwords, keys, or connection strings)

## 1. Current migration-ledger state

- `supabase_migrations` schema: **absent**
- `schema_migrations` rows for local versions: **none**
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
- Empty migration ledger vs 10+ local migration files

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
| 20241231 | partial + incompatible | mark applied **after** 20260724 | waitlist/profiles/saved/athlete_profiles exist; recruiting bootstrap missing; athlete_profiles type incompatible |
| 20250101 | partial | mark applied **after** 20260724 | waitlist.anon_id exists; anon_sessions/user_data missing |
| 20251227 | not realized | mark applied **after** 20260724 | org_contacts absent; notes/source_url supplied by 20260724 |
| 20260128 | fully realized | mark applied | waitlist indexes/policies match live |
| 20260201 | not realized | mark applied **after** 20260724 | user_data created by 20260724 |
| 20260202 | partial | mark applied **after** 20260724 | profiles.user_id present; orgs/contacts/targets missing until 20260724 |
| 20260203 | incompatible / superseded | mark applied | live text PK + shared set_updated_at already present; must never replay uuid DDL |
| 20260205 | not realized | mark applied **after** 20260724 | search_cache created by 20260724 |
| 20260223 | fully realized | mark applied | businesses + user_businesses match |
| 20260723 | not realized | **remain pending** then apply | workflow tables absent |
| 20260724 | not realized | apply then ledger records it | forward reconciliation |

## 7. Selected baseline strategy

**Option A** — mark historical versions applied (only when realized by live schema and/or 20260724), then apply forward migrations.

Rejected:

- **Option B** squash — higher process risk; local clean history already works
- **Option C** rebuild — production has users/data; not disposable

## 8. Versions proposed to mark applied

After 20260724 SQL is present on production:

`20241231`, `20250101`, `20251227`, `20260128`, `20260201`, `20260202`, `20260203`, `20260205`, `20260223`

## 9. Versions proposed to remain pending (then apply)

`20260723`, and `20260724` unless applied via reviewed SQL ahead of repair

## 10. New forward-only migration purpose

`supabase/migrations/20260724_reconcile_nil_roster_production_schema.sql`

Creates missing recruiting/bootstrap/anon/search objects, RLS, grants, `set_workflow_updated_at()`, and `update_anon_session_last_seen()`. Does not touch `athlete_profiles` type or shared `set_updated_at()`.

## 11. Exact future ledger-repair commands

**NOT EXECUTED**

```bash
# Only after 20260724 objects exist on production:
supabase migration repair --status applied 20241231
supabase migration repair --status applied 20250101
supabase migration repair --status applied 20251227
supabase migration repair --status applied 20260128
supabase migration repair --status applied 20260201
supabase migration repair --status applied 20260202
supabase migration repair --status applied 20260203
supabase migration repair --status applied 20260205
supabase migration repair --status applied 20260223
# If 20260724 was applied via reviewed SQL editor/psql:
supabase migration repair --status applied 20260724
```

## 12. Exact future migration-apply commands

**NOT EXECUTED**

```bash
# Preferred controlled order:
# 1) Apply 20260724 SQL via reviewed method (SQL editor / read-write session)
# 2) Run repairs listed above
# 3) Apply workflow migration only:
supabase db push
# Expect pending: 20260723 (and 20260724 if not manually applied/repaired)
```

Alternative if both remain pending after historical repair only:

```bash
supabase db push
# Applies 20260723 then 20260724 in version order (both additive; OK)
```

## 13. Post-apply verification checklist

- [ ] `opportunities`, `deals`, `events` exist with RLS + four ownership policies each
- [ ] Missing bootstrap/recruiting/anon/search tables exist
- [ ] `athlete_profiles.user_id` still `text`
- [ ] `set_updated_at` dependents on `profiles` and `athlete_profiles` unchanged
- [ ] Workflow triggers call `set_workflow_updated_at`
- [ ] Ledger contains historical + applied forward versions; no pending incompatible SQL
- [ ] `VITE_WORKFLOW_CLOUD_PERSISTENCE` still disabled in Vercel

## 14. Containment / rollback

- Feature flag remains off; no UI cutover (PR-4B not started)
- Forward SQL is additive; rollback = leave new empty tables unused
- Do not DROP newly created tables without a separate reviewed plan
- Do not reverse ledger repairs without founder authorization

## 15. PR-4B prerequisites

- This reconciliation applied successfully on production
- Workflow repository integration green against remote
- Explicit authorization to enable cloud persistence flag
- Import/cutover plan for localStorage keys (`opps.store`, etc.) reviewed separately
