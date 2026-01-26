# API Routing Fix - Summary

## Problem
- `/api/ping` returns `text/html` (cached `index.html`) instead of `application/json`
- `X-Vercel-Cache: HIT` with huge Age (~12 days) confirms stale cached SPA fallback
- SPA fallback route `/(.*)` was catching `/api/*` paths before functions could execute

## Root Cause
The SPA fallback route `/(.*)` → `/index.html` was matching `/api/*` paths before Vercel could route them to the functions in `dist/api/**/*.js`. Once cached, subsequent requests hit the stale HTML cache.

## Fixes Applied

### 1. Build Script Enhancement
**File:** `package.json`
- Updated `vercel-build` to include `node scripts/verify-dist-api.mjs` for build-log proof

**File:** `scripts/verify-dist-api.mjs` (NEW)
- Prints complete directory tree of `dist/api/` in build logs
- Verifies `dist/api/ping.js` and `dist/api/healthz.js` exist
- Exits with error if critical files are missing

### 2. Routing Fix
**File:** `vercel.json`
- Changed SPA fallback from `/(.*)` to `/((?!api/).*)` 
- This uses negative lookahead regex to exclude `/api/*` paths from SPA fallback
- Routes now:
  1. `/healthz` → `/api/healthz` (rewrite)
  2. `handle: filesystem` (serves static files)
  3. `/((?!api/).*)` → `/index.html` (SPA fallback, excludes `/api/*`)
  4. Functions in `dist/api/**/*.js` are automatically detected for `/api/*` paths

## Final vercel.json

```json
{
  "version": 2,
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "dist",
  "functions": {
    "dist/api/**/*.js": {
      "runtime": "nodejs20.x"
    }
  },
  "routes": [
    { "src": "/healthz", "dest": "/api/healthz" },
    { "handle": "filesystem" },
    { "src": "/((?!api/).*)", "dest": "/index.html" }
  ]
}
```

## Build Script Proof

The `vercel-build` script now includes:
```bash
node scripts/verify-dist-api.mjs
```

This will print in Vercel build logs:
```
=== BUILD PROOF: dist/api contents ===
📄 ping.js (XXX bytes)
📄 healthz.js (XXX bytes)
📁 _lib/
  📄 auth.js (XXX bytes)
  ...
=== Verification ===
✅ dist/api/ping.js exists
✅ dist/api/healthz.js exists
=== Build proof complete ===
```

## Deployment & Verification

### Deploy to Production
```powershell
$env:VERCEL_TOKEN='your-token'
npx vercel deploy --prod --force --yes --token $env:VERCEL_TOKEN
```

The `--force` flag ensures cache is cleared.

### Verification Commands

After deployment, verify with cache-busting queries:

```powershell
# Test /api/ping
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
curl.exe -i "https://athlete-ledger.vercel.app/api/ping?cb=$timestamp"

# Expected:
# - Status: 200 OK
# - Content-Type: application/json
# - Body: {"ok":true}

# Test /api/healthz
curl.exe -i "https://athlete-ledger.vercel.app/api/healthz?cb=$timestamp"

# Expected:
# - Status: 200 OK
# - Content-Type: application/json
# - Body: {"buildId":"...","timestamp":"...","configPresence":{...}}

# Test /healthz (rewritten to /api/healthz)
curl.exe -i "https://athlete-ledger.vercel.app/healthz?cb=$timestamp"

# Expected:
# - Status: 200 OK
# - Content-Type: application/json
# - Body: Same as /api/healthz
```

## Current State (Before Fix)

**Proof of issue:**
```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Disposition: inline; filename="index.html"
X-Vercel-Cache: HIT
Age: 1032716

<!doctype html>
<html lang="en">
...
```

## Expected State (After Fix)

All `/api/*` endpoints should return:
```
HTTP/1.1 200 OK
Content-Type: application/json
X-Vercel-Cache: MISS (on first request after deployment)

{"ok":true}  # or appropriate JSON response
```

## Why Cache Was Serving index.html on /api/*

1. **Routing Order Issue**: The SPA fallback `/(.*)` matched `/api/ping` before Vercel could route it to `dist/api/ping.js`
2. **Caching**: Once Vercel/CDN cached the fallback response (index.html) for `/api/ping`, subsequent requests hit the cache
3. **Stale Cache**: The `X-Vercel-Cache: HIT` with `Age: 1032716` (12+ days) shows the cache was never invalidated because the routing was wrong from the start

## Files Changed

1. `vercel.json` - Updated SPA fallback regex to exclude `/api/*`
2. `package.json` - Added `verify-dist-api.mjs` to build script
3. `scripts/verify-dist-api.mjs` - NEW: Build proof script
