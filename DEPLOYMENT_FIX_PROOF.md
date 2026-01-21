# Deployment Fix - Root Cause and Proof

## Root Cause Identified

**Issue**: `/api/*` endpoints return HTML instead of JSON in production.

**Root Cause**: 
- `vercel.json` has `outputDirectory: "dist"` 
- This makes Vercel treat `dist/` as the deployment root
- API functions at `api/` (repo root) are not found because Vercel looks relative to `dist/`
- When `outputDirectory` is set, Vercel requires API functions to be inside that directory

## Fix Applied

**Changed**: `package.json` → `vercel-build` script

**Before**:
```json
"vercel-build": "tsc -b && cross-env VITE_BUILD_ID=$VERCEL_GIT_COMMIT_SHA vite build"
```

**After**:
```json
"vercel-build": "tsc -b && cross-env VITE_BUILD_ID=$VERCEL_GIT_COMMIT_SHA vite build && node scripts/copy-api-to-dist.mjs"
```

**What this does**:
- Copies `api/` → `dist/api/` during build
- Vercel finds functions at `dist/api/` when `outputDirectory: "dist"` is set

## Root Directory Configuration

**Required Vercel Settings**:
- **Root Directory**: `.` (repo root) - Set in Vercel Project Settings → General → Root Directory
- **vercel.json outputDirectory**: `dist` - Static files served from `dist/`
- **API Functions**: Located at `api/` (repo root), copied to `dist/api/` during build

## Proof Commands

Run these commands to deploy and verify:

```powershell
# Set token
$env:VERCEL_TOKEN = "your-vercel-token"

# Deploy preview and test
.\deploy-and-prove.ps1
```

Or manually:

```powershell
# 1. Deploy preview
$env:VERCEL_TOKEN = "your-token"
$output = npx vercel deploy --yes --token $env:VERCEL_TOKEN
$previewUrl = ([regex]::Matches($output, 'https://[^\s]+\.vercel\.app'))[0].Value

# 2. Test endpoints
curl $previewUrl/api/ping
curl $previewUrl/api/healthz
curl $previewUrl/healthz

# Expected: All return JSON (Content-Type: application/json)
```

## Expected Results

**Before Fix**:
- `/api/ping` → HTML (index.html)
- `/api/healthz` → HTML (index.html)
- `/healthz` → HTML (index.html)

**After Fix**:
- `/api/ping` → `{"ok":true}` (JSON)
- `/api/healthz` → `{"buildId":"...","timestamp":"...","configPresence":{...}}` (JSON)
- `/healthz` → Same as `/api/healthz` (JSON)

## Files Changed

1. `package.json` - Added `copy-api-to-dist.mjs` to `vercel-build` script
2. `README.md` - Added Root Directory Configuration section
3. `deploy-and-prove.ps1` - Created deployment and verification script
