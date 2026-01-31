# Vercel Rollback Guide

**Purpose**: Quickly rollback to a previous working deployment if the waitlist Function fix causes issues in production.

## When to Rollback

Rollback immediately if:
- ❌ `/api/waitlist` returns 404 (Function not found)
- ❌ `/api/waitlist` returns HTML instead of JSON
- ❌ SPA routing is broken (homepage returns 404/500)
- ❌ Build errors prevent deployment
- ❌ Any critical functionality is broken

## Rollback Methods

### Method 1: Instant Rollback (Recommended - Fastest)

**Vercel Dashboard (Web UI)**:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **Deployments** tab
4. Find the **previous production deployment** (before the fix was deployed)
   - Look for deployments with "Production" badge
   - Check timestamp to confirm it's before your recent deployment
5. Click the **⋯** (three dots) menu on that deployment
6. Select **Promote to Production** (or **Rollback**)
7. Confirm the action

**Result**: 
- ✅ Instant switch (no rebuild)
- ✅ Takes 30 seconds to propagate
- ✅ Previous working state restored

**Limitations** (Hobby Plan):
- Can only rollback to the **immediately previous** production deployment
- Older deployments may not be available

### Method 2: CLI Rollback (Fast, Scriptable)

**Prerequisites**:
- Vercel CLI installed: `npm i -g vercel`
- Authenticated: `vercel login` OR set `$env:VERCEL_TOKEN`

**Steps**:

1. **List recent production deployments**:
   ```powershell
   vercel ls --prod
   ```
   
   Output shows:
   ```
   Production Deployments
   age  url                                 state
   2m   https://athlete-ledger-abc123.vercel.app  READY
   1h   https://athlete-ledger-xyz789.vercel.app  READY  (previous)
   ```

2. **Rollback to previous deployment**:
   ```powershell
   # Use the URL or deployment ID of the previous working deployment
   vercel rollback https://athlete-ledger-xyz789.vercel.app
   
   # Or just rollback to the immediate previous (Hobby plan)
   vercel rollback
   ```

3. **Verify rollback succeeded**:
   ```powershell
   vercel ls --prod
   ```
   
   The previous deployment should now show as current Production.

**Non-interactive rollback**:
```powershell
$env:VERCEL_TOKEN = "your-vercel-token"
vercel rollback <deployment-url> --yes --token $env:VERCEL_TOKEN
```

### Method 3: Git Revert + Redeploy (Slower, Clean History)

If you want to revert the code changes and have a clean git history:

1. **Revert the commit**:
   ```powershell
   # Find the commit that introduced the fix
   git log --oneline
   
   # Revert it (creates a new commit that undoes the changes)
   git revert <commit-hash>
   
   # Or, if it's the most recent commit
   git revert HEAD
   ```

2. **Push the revert**:
   ```powershell
   git push origin main
   ```

3. **Wait for automatic deployment**:
   - Vercel will auto-deploy from the reverted git state
   - Takes 2-5 minutes (full rebuild)

**Downsides**:
- ❌ Slower (requires rebuild)
- ❌ Leaves revert commits in git history
- ✅ But: Clean path forward for fixing issues

## Post-Rollback Verification

After rolling back, verify the previous state is working:

```powershell
$env:DOMAIN = "https://your-prod-domain.vercel.app"
npm run smoke:vercel:prod
```

Or manual curl:
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

# Test /api/waitlist
curl.exe -i -X POST "https://your-prod-domain.vercel.app/api/waitlist?cb=$ts" `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com"}'
```

**Expected after rollback**:
- ✅ Previous behavior restored (even if Function wasn't working before)
- ✅ Homepage loads correctly
- ✅ No 500 errors

## Troubleshooting Rollback Issues

### Issue: Rollback command fails

**Error**: `vercel rollback: command not found`

**Fix**: 
```powershell
npm i -g vercel
```

**Error**: `You don't have access to rollback this deployment`

**Fix**:
- Ensure you're logged in: `vercel login`
- Or set token: `$env:VERCEL_TOKEN = "your-token"`
- Check you have access to the Vercel project

### Issue: Rollback succeeded but issue persists

**Cause**: CDN cache not cleared

**Fix**:
1. Wait 5-10 minutes for CDN propagation
2. Use cache-busting query params: `?cb=<timestamp>`
3. Force new deployment with `vercel --prod --force`

### Issue: Can't find previous working deployment

**Cause**: No previous production deployment exists (first deploy)

**Fix**:
- Use Method 3 (Git Revert) to undo changes
- Or fix the issue forward (see VERCEL_PROJECT_SETTINGS.md)

## After Rollback: Fix Forward

Once rolled back and stable, diagnose and fix the issue:

1. **Review build logs** in Vercel Dashboard
   - Look for errors during build
   - Check if Functions were detected

2. **Verify Vercel Project Settings** (see VERCEL_PROJECT_SETTINGS.md):
   - Root Directory = `.`
   - Output Directory = `dist`
   - `VITE_PUBLIC_MODE=true` is set

3. **Test locally first**:
   ```powershell
   npm run build
   npm run preview
   ```

4. **Deploy to preview first** (before production):
   ```powershell
   vercel deploy  # Creates preview deployment
   # Test the preview URL
   # If good, promote to production
   ```

## Quick Reference

| Method | Speed | Plan Limit | Use When |
|--------|-------|------------|----------|
| Dashboard Instant Rollback | ⚡ 30s | Hobby: 1 previous | Quick fix, any issue |
| CLI Rollback | ⚡ 1min | Hobby: 1 previous | Scriptable, automated |
| Git Revert | 🐌 5min | None | Want clean history |

## Emergency Contacts

If rollback fails and production is down:

1. **Check Vercel Status**: https://www.vercel-status.com/
2. **Vercel Support**: https://vercel.com/support
3. **Review docs**: https://vercel.com/docs/instant-rollback

## Prevention for Next Time

Before deploying changes that affect routing:

1. ✅ Test locally with `npm run build && npm run preview`
2. ✅ Deploy to preview environment first (`vercel deploy` without `--prod`)
3. ✅ Test the preview URL thoroughly
4. ✅ Only promote to production after verification
5. ✅ Keep rollback commands handy
6. ✅ Document the working state before changes

---

**TL;DR - Emergency Rollback**:
```powershell
# Fastest rollback (Dashboard):
# Vercel Dashboard → Deployments → Previous Production → ⋯ → Promote

# Fast rollback (CLI):
vercel rollback

# Verify:
$env:DOMAIN = "https://your-domain.vercel.app"
npm run smoke:vercel:prod
```
