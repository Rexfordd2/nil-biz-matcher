# Vercel-Native Deployment Configuration

## Changes Made

### 1. vercel.json
The configuration now uses Vercel-native approach:
- **outputDirectory**: `dist` - Serves static SPA files from dist directory
- **API Functions**: Automatically detected from `api/` directory at repo root (NOT copied to dist)
- **Routes**:
  - `/healthz` → `/api/healthz` (rewrite)
  - Filesystem routing (serves static files from dist)
  - `/(.*)` → `/index.html` (SPA fallback)

### 2. package.json
- **Removed**: `node scripts/copy-api-to-dist.mjs` from `vercel-build` script
- API functions now stay at repo root and are detected natively by Vercel

## How It Works

When Vercel deploys:
1. **Static Files**: Served from `dist/` directory (SPA build output)
2. **API Functions**: Detected from `api/` directory at repo root level
3. **Routing**:
   - `/api/ping` → `api/ping.ts` function
   - `/api/healthz` → `api/healthz.ts` function  
   - `/healthz` → rewrites to `/api/healthz`
   - `/some/spa/route` → serves `dist/index.html` (SPA fallback)

## Verification

After deployment, verify:
- ✅ `/api/ping` returns JSON
- ✅ `/api/healthz` returns JSON
- ✅ `/healthz` returns JSON (rewritten to `/api/healthz`)
- ✅ `/some/spa/route` returns HTML (SPA fallback)

## Deployment

Deploy preview with:
```powershell
$env:VERCEL_TOKEN='your-token'
.\deploy-and-verify.ps1
```

Or manually:
```powershell
npx vercel deploy --yes
```
