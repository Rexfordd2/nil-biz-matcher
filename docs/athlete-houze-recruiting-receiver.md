# Athlete Houze recruiting receiver

NIL Roster accepts recruiting events from Athlete Houze at `POST /api/recruiting/houze-receive`.

This route is inactive unless all of the following are true:

- `NIL_RECRUITING_RECEIVER_MODE=development`
- `VERCEL_ENV` is not `production` or `preview`
- `NODE_ENV` is not `production`
- `NIL_RECRUITING_RECEIVER_HMAC_SECRET` is set
- `NIL_RECRUITING_RECEIVER_DATABASE_URL` is a localhost Postgres URL whose database name does not contain `prod`

Public mode does not turn the route on. The route does not send email.

## Signature

The signature is the same construction as NIL Roster's outbound Athlete Houze report (`signAthleteHouzeBody`):

- Header `x-ah-timestamp`: unix seconds
- Header `x-ah-signature`: `sha256=` plus HMAC-SHA256 over `timestamp + "." + original body bytes`
- Header `content-type`: `application/json`
- Body limit: 65536 bytes

The receiver reads those original bytes before it touches the parsed body. `JSON.stringify` of the parsed body is not a signature input.

## Event `athlete-houze.recruiting.event.v1`

Required fields: `schemaVersion`, `eventId`, `idempotencyKey`, `houzeAthleteId`, `entityType`, `entityId`, `revision`, `occurredAt`, `payload`.

Optional fields: `claimedNilAccountId` (Supabase `auth.users.id`), `claimedClerkUserId` (Clerk `user_…`).

`payload` allows `title`, `status` (`prospect`, `contacted`, `visiting`, `committed`, `paused`), and `note`. Any other field is rejected and nothing is stored.

`entityType` is `recruiting_record`.

`houzeAthleteId` is resolved through `recruiting_houze_athlete_links`. A valid signature and well-formed ids do not apply an event when that mapping is missing, revoked, or different from `claimedNilAccountId` / `claimedClerkUserId`. Clerk ids are not Supabase account ids.

## Acknowledgement `athlete-houze.recruiting.ack.v1`

HTTP 200 body:

- `schemaVersion`, `eventId`, `idempotencyKey`, `houzeAthleteId`
- `nilAccountId` — mapped Supabase account
- `entityType`, `entityId`
- `requestedRevision`, `currentRevision`
- `revisionOutcome`: `applied`, `current_revision_matches`, or `current_revision_newer`
- `applied` — true only when this commit advanced the entity

`current_revision_newer` means the event was valid and the stored revision is newer. The entity is left unchanged. `currentRevision` is that newer revision and `applied` is false.

An identical retry returns that same acknowledgement. Reusing an event id or idempotency key with different ownership or content returns HTTP 409 `{"error":"conflict"}` and does not change stored rows or return the stored acknowledgement.

Equal entity revision with different content is the same 409 conflict. A stale revision still succeeds with `current_revision_newer`.

## Native PostgreSQL gate (2026-10-02)

This section is the candidate report for the recovered NIL receiver. It is not a production cutover proposal.

### Source pair

| Side | What was actually present |
| --- | --- |
| NIL Roster | `/workspace`, repository `Rexfordd2/nil-biz-matcher`. Work started from `main` at `2534a012806c9190fd1c7b34a9bc8fd48731fb51`, working tree clean. Branch `cursor/native-postgres-recruiting-gate-62ba` holds the recovered receiver plus the login checks below. |
| Athlete Houze | Not present. No checkout, bundle, or patch was on this machine. Desktop path `C:\Users\13109\Desktop\athlete-houze-recruiting-candidate`, commit `85ce43e5f8ee0e4be5305fb5be5bf79f69536e95`, bundle head `2f10e05a3ed9c613c0ce4cf02d74c8c999a62948`, and `nil-sender-repair.patch` were not opened. |

The NIL files were restored from the edit record of cloud agent `bc-8685fff8-dd65-4a40-8b2e-b4e1b9109772`. Commit `a8886e8a299376bec0bad43affc93f711679075e` is not an object in this clone and was not pushed to GitHub. These blobs match the hashes recorded for that candidate before the login checks were added:

| File | Blob |
| --- | --- |
| `supabase/migrations/20261001_nil_recruiting_houze_receiver.sql` | `e3c0b862518c032da2d2529f7f34425042facc85` |
| `api/_lib/athleteHouzeRecruitingContract.ts` | `eabfc39cbbb7f27b0d41cb088fcf1fbd7d7283ac` |
| `api/recruiting/houze-receive.ts` | `2bcec6f5257a90d1174891562e7520b1673a9b57` |
| `scripts/recruiting-receiver/node-runtime-regression.mjs` before the login checks | `116afb331564f0a75a5c28912ca5848749da129b` |

The branch commit SHA is the tested NIL tree and is printed by `git rev-parse HEAD` on `cursor/native-postgres-recruiting-gate-62ba` after this report is committed. There is no Athlete Houze SHA to pair with it.

### Command, runtime, engine

```text
node scripts/recruiting-receiver/node-runtime-regression.mjs
```

- Node `v22.14.0`
- Supabase CLI `2.119.0`, `supabase db push --db-url <local nil_recruiting_receiver_dev> --include-all --yes` twice
- PostgreSQL `16.15` (Ubuntu `16.15-0ubuntu0.24.04.1`) on `127.0.0.1`
- Database name `nil_recruiting_receiver_dev`
- HTTP receiver: `@vercel/node` dev server loading the esbuild bundle of `api/recruiting/houze-receive.ts`, then Vite `5.4.21` on `127.0.0.1:4179`
- `SUPABASE_DB_PASSWORD` unset. No hosted database was contacted.

Compatibility adapter, not a migration: `scripts/recruiting-receiver/disposable-auth-bootstrap.sql` creates local `auth.users` and `auth.uid()` before the real migration files run. Historical migration files were not edited. After the run, `supabase_migrations.schema_migrations` contained each version once:

`20241231`, `20250101`, `20251227`, `20260128`, `20260201`, `20260202`, `20260203`, `20260205`, `20260223`, `20260723`, `20260724`, `20261001`.

The second push returned `upToDate: true` and an empty migration list. Replaying `20261001_nil_recruiting_houze_receiver.sql` left one `recruiting_received_entities_select_own` policy. This is the full local chain, not a prerequisite subset.

This tree has no embedded-PostgreSQL rehearsal, so the native script was not combined with one. The script still refuses `SUPABASE_DB_PASSWORD`, a non-local database URL, and a database name containing `prod`. The earlier report of 22 full-schema checks and 16 workspace SQL checks on embedded PostgreSQL is not this run and is not used as native proof. The two earlier Windows launcher failures happened before database checks and are not part of this result. This Linux launch reached the database. The entry check uses `pathToFileURL`; this tree has no `` file://${path} `` concatenation. Windows itself was not retested.

### Passed (34), failed (0)

Existing assertions were kept. Two login checks were added and the gate was rerun.

Passed:

- second migration run is up to date
- replayed migration did not duplicate policies
- node apply, owner is the Supabase id, identical retry
- conflicting event id, conflicting idempotency key, equal revision conflict
- mismatched account, Clerk id is not the Houze athlete, unknown field
- newer revision, stale revision
- revoked mapping, missing mapping
- original request bytes verify; a signature over `JSON.stringify` is rejected
- bounded body
- concurrent identical HTTP deliveries: one entity row and one receipt, through the receiver pool (`max: 8`) in one Node process
- anon select denied
- authenticated user cannot read another account; can read own rows; cannot insert
- receipts are not user-facing
- receiver role cannot insert directly; can execute `commit_recruiting_inbound_event`; rollback leaves the entity count unchanged
- authenticated cannot execute commit; service role cannot write receipts
- receiver login as `nil_recruiting_receiver` succeeds; a wrong password fails with SQLSTATE `28P01`
- Vite original bytes, reconstructed signature rejected, unknown field

Also passed, outside the database gate: `tsc -p tsconfig.node.json --noEmit`, `tsc --noEmit`, and `npm test` (41 files, 292 tests).

### Not run

| Check | Why |
| --- | --- |
| Houze decision and outbox commit or roll back together | Athlete Houze source is not on this machine. No outbox module was invented. |
| Pairing-code races, disconnect/reconnect ownership | No pairing-code implementation is in the recovered NIL tree, and the Houze side is absent. |
| Delayed acknowledgement or revocation replay reactivating the wrong binding | A new event for a revoked link returns `mapping_revoked`. There is no pairing binding to reactivate. |
| Linker role permissions | This schema has `nil_recruiting_receiver` and `nil_recruiting_receiver_owner`. It has no linker role. |
| Real Clerk/Supabase sign-in, consented pairing, NIL Board, draft, refresh, second-account isolation, disconnect/retry/reconnect | No `.env` file and no Clerk or Supabase variables are set. `.env.example` names `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `ATHLETE_HOUZE_REPORT_*` only. The receiver stays off when `VERCEL_ENV` is `production` or `preview`, when `NODE_ENV` is `production`, or when the database URL is not local. Those guards were not weakened. Mocked authentication is not a pass. |

### Release decision

Not ready for production, merge, or cutover. No email was sent and no hosted database, DNS, or deployment setting was changed.

Next action: put the Athlete Houze candidate tree on disk, then run its decision/outbox and pairing-code checks against that tree and this receiver. For the browser journey, add an untracked development env with a non-production Clerk project, two synthetic users, and NIL `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for a non-production Supabase project. Keep `NIL_RECRUITING_RECEIVER_DATABASE_URL` on `127.0.0.1` and do not set `VERCEL_ENV` to `preview` or `production`.
