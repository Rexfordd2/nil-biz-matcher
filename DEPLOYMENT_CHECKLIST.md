# Deployment Checklist - Production Fix

Follow these steps in order to deploy and verify the production fix.

## Pre-Deployment Checklist

- [ ] **Step 1: Set Vercel Environment Variable**
  - Go to Vercel Dashboard → Settings → Environment Variables
  - Add: `VITE_PUBLIC_MODE` = `true` for Production environment
  - See `VERCEL_ENV_FIX.md` for detailed instructions

- [ ] **Step 2: Review Code Changes**
  - ✅ `vercel.json` updated to use `routes` instead of `rewrites`
  - ✅ `routes` includes `{ "handle": "filesystem" }`
  - ✅ SPA fallback excludes `/api/*` paths: `/((?!api/).*)`
  - ✅ No config expects functions in `dist/api/`

- [ ] **Step 3: Commit Changes**
  ```powershell
  git add vercel.json
  git add VERCEL_ENV_FIX.md DEPLOYMENT_MODEL.md SUPABASE_SETUP_QUICK.md
  git add verify-production-fix.ps1 DEPLOYMENT_CHECKLIST.md
  git commit -m "Fix Vercel production: routing + env config
  
  - Update vercel.json to use routes with filesystem handle
  - Prevent SPA fallback from catching /api/* paths
  - Document required VITE_PUBLIC_MODE env var
  - Add verification scripts and deployment docs"
  git push origin main
  ```

## Deployment Steps

### Option 1: Git Push (Automatic)

If you have Vercel connected to your Git repo:

```powershell
# Push to main branch (triggers auto-deploy)
git push origin main
```

Wait for Vercel to:
1. Detect the push
2. Start build
3. Run `npm run vercel-build`
4. Deploy functions from `api/` directory
5. Deploy static files from `dist/`

### Option 2: Manual Deploy (Vercel CLI)

```powershell
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login
vercel login

# Deploy to production with force rebuild
vercel --prod --force
```

The `--force` flag ensures:
- Fresh build (no cached artifacts)
- CDN cache is cleared
- All functions are redeployed

## Post-Deployment Verification

### Step 1: Check Vercel Build Logs

1. Go to Vercel Dashboard → Deployments
2. Click on the latest deployment
3. Check **Build Logs**
4. Look for:
   - ✅ `[prepare-build-env] VITE_BUILD_ID=...`
   - ✅ `vite build` completed successfully
   - ✅ No `[SECURITY] Debug routes must be protected` error
   - ✅ Functions detected: `api/ping.ts`, `api/healthz.ts`, `api/waitlist.ts`, `api/build-id.ts`

### Step 2: Run Verification Script

```powershell
# Run the verification script
.\verify-production-fix.ps1

# Or specify a different URL
.\verify-production-fix.ps1 -BaseUrl "https://your-custom-domain.com"
```

Expected output:
```
✓ All tests PASSED!

Production fix verified successfully:
  • /api/ping returns JSON (not cached HTML)
  • /healthz returns JSON (rewrite works)
  • /api/waitlist accepts POST requests
  • SPA fallback still works for non-API routes
```

### Step 3: Manual Verification (Optional)

If you prefer to test manually:

```powershell
# Test /api/ping
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
curl.exe -i "https://athlete-ledger.vercel.app/api/ping?cb=$ts"
# Expected: Content-Type: application/json, Body: {"ok":true}

# Test /healthz
curl.exe -i "https://athlete-ledger.vercel.app/healthz?cb=$ts"
# Expected: Content-Type: application/json, Body: {"buildId":"...","timestamp":"..."}

# Test POST /api/waitlist
curl.exe -X POST "https://athlete-ledger.vercel.app/api/waitlist" `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","source":"manual_test"}'
# Expected: {"ok":true,"status":"created"|"accepted_no_storage"|"already_registered"}

# Test SPA fallback
curl.exe -i "https://athlete-ledger.vercel.app/?cb=$ts"
# Expected: Content-Type: text/html, Body: <!doctype html>...
```

## Troubleshooting

### Build Still Failing?

**Error**: `[SECURITY] Debug routes must be protected`

**Fix**:
1. Check `VITE_PUBLIC_MODE=true` is set in Vercel Production env
2. Wait 30 seconds for env var to propagate
3. Redeploy (Deployments → ⋯ → Redeploy)

### /api/* Still Returning HTML?

**Symptom**: `/api/ping` returns `Content-Type: text/html`

**Fix**:
1. Check `vercel.json` uses `routes` (not `rewrites`)
2. Check `{ "handle": "filesystem" }` is present
3. Deploy with `--force` to clear CDN cache
4. Wait 5-10 minutes for CDN propagation

### /api/waitlist Returns 404?

**Symptom**: `/api/waitlist` returns `404 Not Found`

**Fix**:
1. Check `api/waitlist.ts` exists in root directory
2. Check Vercel logs show function was detected
3. Check `vercel.json` doesn't have conflicting config
4. Redeploy and check function logs

### Waitlist Returns 500?

**Symptom**: `/api/waitlist` returns `{"ok":false,"error":"..."}`

**Fix**:
1. Check Supabase env vars are correct
2. Check `public.waitlist` table exists (run migration)
3. Check RLS policies allow anonymous inserts
4. Check Vercel function logs for detailed error

## Success Criteria

✅ Build succeeds without security gate error  
✅ `/api/ping` returns JSON (not HTML)  
✅ `/healthz` returns JSON with buildId  
✅ `/api/waitlist` accepts POST requests  
✅ SPA fallback works for non-API routes (e.g., `/`)  
✅ No cached HTML responses on API routes  

## Optional: Supabase Persistence

If you want waitlist emails to be persisted (not just `accepted_no_storage`):

1. Follow `SUPABASE_SETUP_QUICK.md` to set env vars
2. Apply database migration
3. Redeploy
4. Verify with test email submission

## Next Steps After Success

- [ ] Test full app flow in production
- [ ] Monitor Vercel function logs for errors
- [ ] Check waitlist submissions are persisted (if Supabase configured)
- [ ] Update DNS/domain if needed
- [ ] Run smoke tests: `npm run smoke:prod`
- [ ] Announce launch! 🚀
