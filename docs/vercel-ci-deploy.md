# Vercel CI notes (superseded)

> **Superseded.** Automatic GitHub Actions → Vercel CLI Production deployment is **no longer** the deployment owner.

See **[vercel-deployment-ownership.md](./vercel-deployment-ownership.md)** for the current model:

- Sole automatic deployment owner: **Vercel Git integration** for `athleteledger/athlete-ledger`
- GitHub Actions: validation only (`NIL Roster CI`)
- No `vercel deploy` from Actions for routine Preview or Production

Historical CLI secret setup instructions below are retained for emergency reference only and must not be treated as the default release path.

---

# Legacy: Vercel CLI Deployment Setup (archived)

This document previously instructed operators to deploy to Vercel Production from GitHub Actions on every push to `main` using the Vercel CLI. That path duplicated Vercel’s native Git integration and is retired.

## Required GitHub Repository Secrets (legacy)

Secrets may still exist in the repository. They are **not** required by `NIL Roster CI`.

### 1. VERCEL_TOKEN

Legacy personal access token for Vercel CLI authentication. Do not print its value.

### 2. VERCEL_ORG_ID

Legacy Vercel team/organization ID. Do not print its value.

### 3. VERCEL_PROJECT_ID

Legacy project ID. For Production, the canonical project is `prj_h2A1iIMWow5RMu3qTPyrR9NTnZEy` (`athlete-ledger`). Do not print secret values from GitHub.

## Current release path

1. Open / update a PR targeting `main`.
2. Wait for **NIL Roster CI** (lint, tests, flag-off build) and Vercel Preview checks.
3. After founder acceptance, merge to `main`.
4. Vercel Git integration deploys Production for `athlete-ledger`.
5. Keep `VITE_WORKFLOW_CLOUD_PERSISTENCE` absent/false (and mode off / existing-user login false) until a separately authorized activation. See [workflow-cloud-persistence-rollout.md](./workflow-cloud-persistence-rollout.md). **NOT ENABLED BY THIS COMMIT.**
