# Vercel-Native Deployment Changes

## Summary
Updated configuration to use Vercel-native approach where:
- SPA static files are served from `dist/`
- API functions remain at repo root `api/` (NOT copied to dist)

## Changes

### vercel.json
**No functional changes** - only formatting improvements. The configuration was already correct:
- `outputDirectory: "dist"` - serves static files from dist
- Routes handle `/healthz` → `/api/healthz`, filesystem, and SPA fallback
- Functions configuration `api/**/*.ts` detects functions at repo root

### package.json
**Changed `vercel-build` script:**

**Before:**
```json
"vercel-build": "tsc -b && cross-env VITE_BUILD_ID=$VERCEL_GIT_COMMIT_SHA vite build && node scripts/copy-api-to-dist.mjs"
```

**After:**
```json
"vercel-build": "tsc -b && cross-env VITE_BUILD_ID=$VERCEL_GIT_COMMIT_SHA vite build"
```

**Removed:** `node scripts/copy-api-to-dist.mjs` - API files are no longer copied to dist

## How Vercel Handles This

1. **Static Files**: Vercel serves files from `dist/` directory (set by `outputDirectory`)
2. **API Functions**: Vercel automatically detects serverless functions in `api/` directory at repo root
3. **Routing**: 
   - `/api/ping` → executes `api/ping.ts`
   - `/api/healthz` → executes `api/healthz.ts`
   - `/healthz` → rewrites to `/api/healthz` (via routes)
   - Any other route → serves `dist/index.html` (SPA fallback)

## Next Steps

1. Deploy preview:
   ```powershell
   $env:VERCEL_TOKEN='your-token'
   .\deploy-and-verify.ps1
   ```

2. Verify endpoints:
   - `/api/ping` should return `{"ok":true}`
   - `/api/healthz` should return JSON with build info
   - `/healthz` should return same as `/api/healthz`
   - `/some/spa/route` should return HTML (index.html)
