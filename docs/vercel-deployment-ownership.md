# Vercel deployment ownership

## Production project

- **Project:** `athleteledger/athlete-ledger`
- **Project ID:** `prj_h2A1iIMWow5RMu3qTPyrR9NTnZEy`
- **Git repository:** `Rexfordd2/nil-biz-matcher`
- **Production branch:** `main`
- **Automatic deployment owner:** **Vercel Git integration** (sole owner)

## Responsibilities

| Surface | Owner |
|---|---|
| Pull request Preview deployments | Vercel Git integration |
| `main` Production deployments | Vercel Git integration |
| Tests, type checking, flag-off build | GitHub Actions (`NIL Roster CI`) |
| Vercel CLI deploy from GitHub Actions | **None** (removed) |

GitHub Actions must **not** call `vercel pull`, `vercel build`, or `vercel deploy` for this project.

## Secondary project: athlete-ledger-beta

- **Project:** `athleteledger/athlete-ledger-beta`
- **Classification:** EXPECTED SECONDARY BETA DEPLOYMENT
- Linked to the same GitHub repository and also receives Preview builds for PR branches.
- Do not treat beta as the user-facing Production owner.
- Configuration for beta is intentionally unchanged by the NIL Roster Production release work.

## Rollback

- Prefer Vercel dashboard rollback / promote previous Ready Production deployment for `athlete-ledger`.
- Application defects: revert the Git commit on `main` so Vercel Git redeploys.
- Do not use deleted or legacy GitHub Actions CLI workflows for routine rollback.

## Feature flags and follow-ons

- Workflow cloud persistence remains **absent/false** in Production.
- Account-level canary remains a **separate future change**.
- Do not enable `VITE_WORKFLOW_CLOUD_PERSISTENCE=true` via CI or deployment ownership changes.

## Secrets

- Never print `VERCEL_TOKEN`, org/project IDs, Supabase secrets, or environment values in logs.
- GitHub Actions validation CI does not require Vercel deploy secrets.
- Legacy CLI deploy secret names may still exist in the repository settings; they are not used by `NIL Roster CI`.

## Legacy workflows

- Automatic Vercel CLI Production deploy on `push` to `main` was removed (`vercel-production.yml` deleted; history retained in Git).
- `deploy-vercel.yml` was converted to validation-only (`NIL Roster CI`).
- Do not reintroduce automatic CLI deploys while Vercel Git integration owns Production.
