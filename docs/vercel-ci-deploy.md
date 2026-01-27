# Vercel CI Deployment Setup

This document provides exact instructions for setting up GitHub Actions to deploy to Vercel Production automatically.

## Overview

The `.github/workflows/vercel-production.yml` workflow deploys to Vercel Production on every push to the `main` branch using the Vercel CLI. This bypasses Vercel's Git integration and ensures deployments happen reliably.

## Required GitHub Repository Secrets

You must configure the following secrets in your GitHub repository:

### 1. VERCEL_TOKEN

**What it is:** Personal access token for Vercel CLI authentication.

**How to obtain:**
1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Give it a name (e.g., "GitHub Actions Deploy")
4. Select scope: **Full Account** (or at minimum, the specific project)
5. Click "Create"
6. **Copy the token immediately** (you won't see it again)

**How to set in GitHub:**
1. Go to your GitHub repository: https://github.com/Rexfordd2/nil-biz-matcher
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `VERCEL_TOKEN`
5. Value: Paste the token from Vercel
6. Click **Add secret**

### 2. VERCEL_ORG_ID

**What it is:** Your Vercel team/organization ID.

**How to obtain:**

**Method A - From project.json (easiest):**
```bash
# In your local repo:
cat .vercel/project.json
```
Look for the `"orgId"` field. Example:
```json
{"projectId":"prj_xxx","orgId":"team_3afvMrd9BHXAk9ULFIuSRIfo","projectName":"athlete-ledger"}
```
Copy the value of `orgId` (e.g., `team_3afvMrd9BHXAk9ULFIuSRIfo`).

**Method B - From Vercel dashboard:**
1. Go to https://vercel.com/
2. Click on your team/account name in the top-left
3. Click **Settings**
4. Your Team ID is shown under "Team ID" or in the URL (e.g., `team_xxxxx`)

**How to set in GitHub:**
1. Go to: **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `VERCEL_ORG_ID`
4. Value: Paste the org/team ID (e.g., `team_3afvMrd9BHXAk9ULFIuSRIfo`)
5. Click **Add secret**

### 3. VERCEL_PROJECT_ID

**What it is:** Your Vercel project ID for this specific project.

**How to obtain:**

**Method A - From project.json (easiest):**
```bash
# In your local repo:
cat .vercel/project.json
```
Look for the `"projectId"` field. Example:
```json
{"projectId":"prj_omEmNLLhHETdIZqmBSEkAeJCu0ha","orgId":"team_xxx","projectName":"athlete-ledger"}
```
Copy the value of `projectId` (e.g., `prj_omEmNLLhHETdIZqmBSEkAeJCu0ha`).

**Method B - From Vercel project settings:**
1. Go to https://vercel.com/rexfordd2s-projects/athlete-ledger
2. Click **Settings**
3. Scroll to "General" section
4. Copy the **Project ID**

**How to set in GitHub:**
1. Go to: **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `VERCEL_PROJECT_ID`
4. Value: Paste the project ID (e.g., `prj_omEmNLLhHETdIZqmBSEkAeJCu0ha`)
5. Click **Add secret**

## Quick Setup Commands

For this repository, use these values (already extracted from `.vercel/project.json`):

```bash
# Navigate to GitHub repository settings:
# https://github.com/Rexfordd2/nil-biz-matcher/settings/secrets/actions

# Add these three secrets:
VERCEL_TOKEN          = <get from https://vercel.com/account/tokens>
VERCEL_ORG_ID         = team_3afvMrd9BHXAk9ULFIuSRIfo
VERCEL_PROJECT_ID     = prj_omEmNLLhHETdIZqmBSEkAeJCu0ha
```

## Verification

After setting up the secrets:

1. Push a commit to the `main` branch
2. Go to the **Actions** tab in GitHub
3. Watch the "Vercel Production Deployment" workflow run
4. The workflow will:
   - Deploy to Vercel Production
   - Print the deployment URL
   - Verify the deployment by hitting `/api/healthz` and `/api/build-id`
   - Fail if the deployment doesn't match the current commit

## Troubleshooting

### Error: "Missing required environment variable"
- Ensure all three secrets are set correctly in GitHub repository settings
- Check that secret names match exactly (case-sensitive)

### Error: "Invalid token"
- Regenerate the Vercel token at https://vercel.com/account/tokens
- Update the `VERCEL_TOKEN` secret in GitHub

### Deployment succeeds but verification fails
- Wait 1-2 minutes for Vercel's CDN to propagate the new deployment
- Check that the `/api/build-id` endpoint exists in your code
- Manually verify: `curl https://athlete-ledger.vercel.app/api/build-id`

## Manual Verification

After a successful deployment, verify locally:

```powershell
# PowerShell (Windows):
powershell -ExecutionPolicy Bypass -File .\verify-production-api.ps1
```

```bash
# Bash (Linux/Mac):
curl https://athlete-ledger.vercel.app/api/build-id
curl https://athlete-ledger.vercel.app/api/healthz
```

## Workflow Details

The workflow runs two jobs:

1. **deploy**: Builds and deploys to Vercel Production
   - Installs dependencies via `npm ci`
   - Uses Vercel CLI to pull, build, and deploy
   - Outputs the deployment URL

2. **verify**: Verifies the deployment is live
   - Waits 30 seconds for CDN propagation
   - Hits `/api/healthz` and `/api/build-id`
   - Fails if build ID is still `ac87f4b` (old build)
   - Fails if build ID doesn't match current commit SHA

## Links

- Vercel Tokens: https://vercel.com/account/tokens
- Vercel CLI Docs: https://vercel.com/docs/cli
- GitHub Actions Secrets: https://docs.github.com/en/actions/security-guides/encrypted-secrets
