# Production Deployment Proof

## Test Results - Production Endpoints Return HTML

**Date**: 2026-01-20  
**Production URL**: https://athlete-ledger.vercel.app

### Test 1: `/api/ping`
```
Status: HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Body: <!doctype html>... (index.html)
```
**Result**: ❌ Returns HTML instead of JSON

### Test 2: `/api/healthz`
```
Status: HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Body: <!doctype html>... (index.html)
```
**Result**: ❌ Returns HTML instead of JSON

### Test 3: `/healthz`
```
Status: HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Body: <!doctype html>... (index.html)
```
**Result**: ❌ Returns HTML instead of JSON

## Root Cause Confirmed

**Issue**: All `/api/*` endpoints return HTML (index.html) instead of JSON

**Root Cause**: 
- `vercel.json` has `outputDirectory: "dist"`
- Vercel treats `dist/` as the deployment root
- API functions at `api/` (repo root) are not found
- Vercel falls back to serving `dist/index.html` (SPA fallback)

## Fix Applied

**File**: `package.json`
**Script**: `vercel-build`
**Change**: Added `node scripts/build-api.mjs` to compile TypeScript API functions

**Current Configuration**:
```json
"vercel-build": "tsc -b && cross-env VITE_BUILD_ID=$VERCEL_GIT_COMMIT_SHA vite build && node scripts/build-api.mjs"
```

**What `build-api.mjs` does**:
- Compiles `api/*.ts` → `dist/api/*.js` using esbuild
- Targets Node.js 20
- Bundles dependencies
- Outputs to `dist/api/` directory

## Next Steps

1. **Set valid Vercel token**:
   ```powershell
   $env:VERCEL_TOKEN = "your-actual-vercel-token"
   ```

2. **Deploy to production**:
   ```powershell
   cd "C:\Users\13109\Desktop\Monster Collective"
   npx vercel deploy --prod --yes --token $env:VERCEL_TOKEN
   ```

3. **Verify endpoints return JSON**:
   ```powershell
   curl.exe -i "https://athlete-ledger.vercel.app/api/ping"
   curl.exe -i "https://athlete-ledger.vercel.app/api/healthz"
   curl.exe -i "https://athlete-ledger.vercel.app/healthz"
   ```

## Expected Results After Fix

- `/api/ping` → `{"ok":true}` (Content-Type: application/json)
- `/api/healthz` → `{"buildId":"...","timestamp":"...","configPresence":{...}}` (Content-Type: application/json)
- `/healthz` → Same as `/api/healthz` (Content-Type: application/json)

## Root Directory Configuration

- **Vercel Root Directory**: `.` (repo root) - Must be set in Vercel Project Settings
- **vercel.json outputDirectory**: `dist` - Static files served from `dist/`
- **API Functions**: `api/*.ts` → `dist/api/*.js` (compiled during build)
