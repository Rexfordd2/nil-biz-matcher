# Workflow cloud persistence rollout (account-level canary)

## Status

This document describes the **local PR-4B2** account-level canary contract.

**NOT ENABLED BY THIS COMMIT** in Production or Preview.

- No Production / Preview environment variables are changed by this commit.
- No Auth `app_metadata` claims are granted remotely by this commit.
- Signup remains disabled under public release mode unless separately authorized.

## Flags

| Variable | Safe default | Meaning |
|---|---|---|
| `VITE_WORKFLOW_CLOUD_PERSISTENCE` | `false` | Master kill switch. Exact `"true"` required (plus Supabase configured). |
| `VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE` | `off` | `off` \| `canary` \| `all`. Missing/empty/unknown → `off`. |
| `VITE_EXISTING_USER_LOGIN_ENABLED` | `false` | Exact `"true"` allows existing-user password login while public signup stays disabled. |

Master alone does **not** globally activate cloud persistence.

## Mode semantics

### Master off

When `VITE_WORKFLOW_CLOUD_PERSISTENCE != true`, cloud persistence is always disabled, regardless of mode or canary claim.

### Mode `off`

All users remain local-only.

### Mode `canary`

Cloud persistence is enabled only when all are true:

1. Master enabled
2. User authenticated
3. Active athlete ID valid (non-blank, not `anonymous`)
4. Auth `app_metadata.workflow_cloud_persistence_canary === true` (exact boolean)

### Mode `all`

Cloud persistence is enabled for every otherwise eligible authenticated user with a valid athlete ID.

Future full-cloud Preview tests must set:

```text
VITE_WORKFLOW_CLOUD_PERSISTENCE=true
VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE=all
```

## Canary claim

- Source: Supabase Auth **`app_metadata` only**
- Key: `workflow_cloud_persistence_canary`
- Type: exact boolean `true`
- Rejected: `user_metadata`, strings (`"true"`), numbers (`1`), localStorage, query params, email/user/athlete allowlists
- Client: read-only sanitized boolean on AuthContext (`workflowCloudPersistenceCanary`)
- Browser code must never write Auth metadata
- Sign-out resets the claim to false; session refresh / new login updates it

This is a **rollout-control boundary**, not a substitute for ownership RLS. RLS remains the data-security boundary.

## Existing-user login

Production public release currently disables login and signup together via `VITE_PUBLIC_MODE=true`.

`VITE_EXISTING_USER_LOGIN_ENABLED=true` reopens the existing-user password login route without enabling signup.

## Proposed Production canary (future authorization only)

```text
VITE_WORKFLOW_CLOUD_PERSISTENCE=true
VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE=canary
VITE_EXISTING_USER_LOGIN_ENABLED=true
```

Signup must remain disabled. Admin grants the app_metadata claim only to selected accounts.

**NOT ENABLED BY THIS COMMIT.**
