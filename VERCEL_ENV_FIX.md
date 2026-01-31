# Vercel Environment Variable Fix - CRITICAL

## Problem
Production builds are failing due to missing security gate environment variable.

## Required Action
Set `VITE_PUBLIC_MODE=true` in Vercel Production environment **immediately**.

## Option 1: Vercel Dashboard (Recommended - Fastest)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (Monster Collective / Athlete Ledger)
3. Navigate to **Settings** → **Environment Variables**
4. Add new variable:
   - **Name**: `VITE_PUBLIC_MODE`
   - **Value**: `true`
   - **Environment**: Check **Production** (and optionally Preview)
5. Click **Save**
6. Redeploy: Go to **Deployments** → latest deployment → **⋯** → **Redeploy**

## Option 2: Vercel CLI (if you have VERCEL_TOKEN)

```powershell
# Set for production environment
vercel env add VITE_PUBLIC_MODE production
# When prompted, enter: true

# Trigger redeploy
vercel deploy --prod --force
```

## Option 3: Using npm script (if configured)

```powershell
npm run vercel:env
```

## Why This Is Required

The build fails with this error if the variable is not set:

```
[SECURITY] Debug routes must be protected in production builds.
To enable debug access in production, set one of:
  - VITE_DIAGNOSTICS=true (enables all debug routes)
  - VITE_DEBUG_KEY=<secret> (enables access via ?debugKey=<secret> query param)
  - VITE_PUBLIC_MODE=true (public release; debug routes deny-by-default)
```

This security gate is enforced in `vite.config.ts` to prevent accidentally exposing debug routes.

## What This Variable Does

When `VITE_PUBLIC_MODE=true`:
- ✅ Allows production builds to succeed
- ✅ Debug routes are denied by default (secure)
- ✅ Authentication is optional (graceful degradation)
- ✅ Anonymous users can access the app
- ✅ All features work with or without Supabase

## Verification After Setting

After setting the variable and redeploying, check:

```powershell
# Check if build succeeds (look for "Build succeeded" in Vercel logs)
# Then verify the app loads:
curl.exe https://athlete-ledger.vercel.app/ -I
# Should return: HTTP/1.1 200 OK
```

## Next Steps

After this variable is set and deployment succeeds, proceed with routing fixes in `vercel.json`.
