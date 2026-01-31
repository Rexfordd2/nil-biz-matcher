# Vercel Project Settings - Configuration Guide

**Purpose**: Ensure Vercel deploys `/api/waitlist.ts` as a Function while serving static files from `dist/`.

## Required Settings Checklist

### 1. General Settings

Navigate to: **Vercel Dashboard → Your Project → Settings → General**

**Root Directory**: 
- **Must be**: `.` (dot, meaning repo root)
- **Why**: This ensures Vercel can detect the root `api/` directory for Functions
- **Common mistake**: Setting this to `dist` will cause Functions to not be detected

### 2. Build & Development Settings

Navigate to: **Vercel Dashboard → Your Project → Settings → Build & Development Settings**

**Framework Preset**: 
- Vite (or "Other" if not detected)

**Build Command**:
- `npm run vercel-build`
- This is already configured in `vercel.json`, but verify it matches

**Output Directory**:
- **Must be**: `dist`
- **Why**: This tells Vercel where to find the static SPA files built by Vite
- **Important**: This does NOT affect Functions location (they're always from repo root `api/`)

**Install Command**:
- Default (`npm install`) or `npm ci` for deterministic builds

### 3. Environment Variables (Critical for Build Success)

Navigate to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

#### Required for Production Builds:

**Variable**: `VITE_PUBLIC_MODE`
- **Value**: `true`
- **Environment**: Production (check this box)
- **Why**: Without this, builds fail with security gate error: `[SECURITY] Debug routes must be protected in production builds`
- **What it enables**: Public release mode where auth is optional and debug routes are denied by default

#### Optional (for Waitlist Persistence):

If you want waitlist emails to be stored in Supabase:

**Variable**: `SUPABASE_URL`
- **Value**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- **Environment**: Production

**Variable**: `SUPABASE_SERVICE_ROLE_KEY` (preferred)
- **Value**: Your Supabase service role key (bypasses RLS)
- **Environment**: Production
- **Alternative**: Use `SUPABASE_ANON_KEY` instead (but RLS policies must allow inserts)

**Note**: Without Supabase configured, `/api/waitlist` will return `{ ok: true, status: "accepted_no_storage" }` - the Function works, but data is not persisted.

### 4. Deployment Configuration Summary

After configuring the above, your deployment will:
- ✅ Build static files to `dist/` (Output Directory setting)
- ✅ Detect Functions in root `api/` directory (Root Directory = `.`)
- ✅ Route `/api/waitlist` to the Function (via `vercel.json` routes)
- ✅ Serve SPA from `dist/index.html` for non-API routes
- ✅ Build succeeds without security errors (via `VITE_PUBLIC_MODE=true`)

## Verification Steps

After configuring settings:

1. **Trigger a new deployment**:
   - Push to main branch, OR
   - Redeploy from Vercel Dashboard (Deployments → ⋯ → Redeploy)

2. **Check Build Logs**:
   - Look for: `✓ Detected API Routes` with `api/waitlist.ts` listed
   - Should NOT see: `[SECURITY] Debug routes must be protected` error

3. **Test the Function**:
   ```powershell
   $env:DOMAIN = "https://your-prod-domain.vercel.app"
   npm run smoke:vercel:prod
   ```

4. **Manual curl test**:
   ```powershell
   curl.exe -i -X POST "https://your-prod-domain.vercel.app/api/waitlist" `
     -H "Content-Type: application/json" `
     -d '{"email":"test@example.com"}'
   ```
   
   Expected response:
   - Status: `200 OK`
   - Content-Type: `application/json` (NOT text/html)
   - Body: `{ "ok": true, "status": "created" }` or `"accepted_no_storage"`

## Common Issues and Fixes

### Issue: `/api/waitlist` returns 404

**Cause**: Functions not detected because Root Directory is wrong or `api/` folder not at repo root

**Fix**: 
- Verify Root Directory = `.` in Vercel settings
- Verify `api/waitlist.ts` exists in repo root (not inside `dist/` or `src/`)
- Redeploy with `--force` flag

### Issue: `/api/waitlist` returns HTML instead of JSON

**Cause**: SPA fallback is catching `/api/*` requests before Functions can execute

**Fix**:
- This is fixed by the updated `vercel.json` routing
- Ensure you've deployed the latest `vercel.json` with `handle: filesystem`
- Clear cache with force deploy

### Issue: Build fails with security error

**Cause**: Missing `VITE_PUBLIC_MODE=true` environment variable

**Fix**:
- Add `VITE_PUBLIC_MODE=true` in Vercel → Settings → Environment Variables → Production
- Wait 30 seconds for propagation
- Redeploy

### Issue: `/api/waitlist` returns `{ ok: false, error: "missing_env" }`

**Cause**: Supabase environment variables not configured, and code expects them in Vercel

**Fix**:
- If persistence needed: Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- If persistence optional: This is expected behavior; data won't be stored but Function works

## Quick Settings Verification Checklist

Before deploying, verify:

- [ ] Root Directory = `.` (dot)
- [ ] Output Directory = `dist`
- [ ] Build Command = `npm run vercel-build`
- [ ] Environment Variable `VITE_PUBLIC_MODE=true` exists for Production
- [ ] (Optional) Supabase env vars if persistence needed

## Next Steps

After configuring settings:
1. Commit the updated `vercel.json` 
2. Deploy to production
3. Run smoke tests with `npm run smoke:vercel:prod`
4. Verify `/api/waitlist` returns JSON (not 404 or HTML)
