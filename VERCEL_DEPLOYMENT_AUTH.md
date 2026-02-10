# Vercel Deployment Guide - Email/Password Auth

Complete guide for deploying the Athlete Ledger app with Supabase email/password authentication to Vercel.

## Required Environment Variables

### 🔑 Essential for Auth (REQUIRED)

Set these in Vercel Dashboard → Project Settings → Environment Variables:

```bash
# Supabase Auth - Get from Supabase Dashboard > Project Settings > API
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# For API endpoints (same values, without VITE_ prefix)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find these:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Settings → API
4. Copy "Project URL" → `VITE_SUPABASE_URL` and `SUPABASE_URL`
5. Copy "anon public" key → `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`

### 🛡️ Security Note: Service Role Key

**NOT REQUIRED for email/password auth.** Only needed for admin operations:

```bash
# OPTIONAL - Only for /api/waitlist and admin operations
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **NEVER expose service role key to the client!** It bypasses Row Level Security (RLS).

### 📋 Optional Environment Variables

```bash
# App URL (for email links, password reset)
APP_URL=https://your-app.vercel.app

# Google Maps (optional, for business discovery)
VITE_GOOGLE_MAPS_API_KEY=your-key-here
GOOGLE_MAPS_API_KEY=your-key-here

# SMTP (optional, for recruiting emails)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM="Athlete Ledger <no-reply@yourdomain.com>"

# App Mode (demo | beta)
APP_MODE=beta
```

---

## Pre-Deployment Checklist

### ✅ Supabase Configuration

1. **Enable Email Auth in Supabase:**
   - Dashboard → Authentication → Providers
   - Ensure "Email" is enabled
   - Configure email templates if needed

2. **Set Site URL:**
   - Dashboard → Authentication → URL Configuration
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/**`

3. **Run Migrations:**
   ```bash
   # Apply the user_id migration for user_data table
   supabase migration up
   ```
   Or run manually in SQL Editor:
   - `supabase/migrations/20260201_add_user_id_to_user_data.sql`

4. **Verify RLS Policies:**
   - Check `athlete_profiles`, `saved_businesses`, `user_data` tables have RLS enabled
   - Policies should filter by `user_id = auth.uid()`

### ✅ Vercel Configuration

1. **Install Vercel CLI (if not already):**
   ```bash
   npm i -g vercel
   ```

2. **Link to Existing Project:**
   ```bash
   vercel link
   # Select: "Athlete Ledger" project
   ```

3. **Set Environment Variables:**
   ```bash
   # Option A: Via Vercel Dashboard
   # Go to: Settings → Environment Variables → Add

   # Option B: Via CLI
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   ```

   **Important:** Set for all environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

4. **Deploy:**
   ```bash
   # Deploy to preview
   vercel

   # Deploy to production
   vercel --prod
   ```

---

## Post-Deployment Smoke Test

### 1. Health Check
```bash
# Test environment configuration
curl https://your-app.vercel.app/api/healthz

# Expected response:
{
  "buildId": "abc1234",
  "timestamp": "2026-02-01T...",
  "configPresence": {
    "hasViteSupabaseUrl": true,
    "hasViteSupabaseAnonKey": true,
    ...
  },
  "supabase": {
    "configured": true,
    "connected": true,
    "error": null
  }
}
```

**✅ Pass criteria:** 
- `configPresence.hasViteSupabaseUrl` = `true`
- `configPresence.hasViteSupabaseAnonKey` = `true`
- `supabase.configured` = `true`
- `supabase.connected` = `true`

### 2. Sign Up Flow

1. **Visit:** `https://your-app.vercel.app/auth/signup`
2. **Fill form:**
   - Display name: "Test User"
   - Email: `test-${Date.now()}@example.com`
   - Password: `TestPass123!`
   - Accept terms: ✅
3. **Click:** "Create my Athlete Ledger account"
4. **Check email:** Verify confirmation email received (if email confirmation enabled)
5. **Verify redirect:** Should redirect to `/app` after signup

**✅ Pass criteria:**
- No console errors
- Signup completes successfully
- User is logged in (see name in header)
- Redirected to `/app`

### 3. Login Flow

1. **Log out:** Click Account menu → "Log out"
2. **Verify redirect:** Should stay on current page or redirect to login
3. **Visit:** `/app` (should redirect to `/auth/login?returnTo=/app`)
4. **Fill login form:**
   - Email: (use email from signup)
   - Password: (use password from signup)
5. **Click:** "Log in"
6. **Verify redirect:** Should redirect to `/app`

**✅ Pass criteria:**
- Login completes successfully
- User is authenticated
- Redirected to original protected route (`/app`)

### 4. Password Reset Flow

1. **Visit:** `https://your-app.vercel.app/auth/login`
2. **Click:** "Forgot password?"
3. **Enter email:** `test@example.com`
4. **Check email:** Verify reset email received
5. **Click reset link:** Should open `/auth/reset` with session token
6. **Enter new password:** `NewPass123!`
7. **Click:** "Save password"
8. **Verify redirect:** Should redirect to `/app`
9. **Log out and log back in** with new password

**✅ Pass criteria:**
- Reset email received
- Reset link works
- New password is accepted
- Can log in with new password

### 5. Protected Routes

1. **Open incognito/private window**
2. **Visit:** `https://your-app.vercel.app/app`
3. **Verify redirect:** Should redirect to `/auth/login?returnTo=/app`
4. **Visit public routes:**
   - `/` → Should load without redirect
   - `/demo` → Should load without redirect
   - `/waitlist` → Should load without redirect

**✅ Pass criteria:**
- `/app` redirects to login when unauthenticated
- Public routes accessible without auth
- After login, redirected back to `/app`

### 6. User Data Isolation

1. **Log in as User A**
2. **Save a business:** Go to Discover → Search → Save a business
3. **Note saved business ID**
4. **Log out**
5. **Log in as User B** (different account)
6. **Check saved businesses:** Should NOT see User A's businesses

**✅ Pass criteria:**
- Each user only sees their own data
- No cross-user data leakage

### 7. API Endpoint Security

Test ownership verification:

```bash
# Get auth token (from browser dev tools after login)
# Application → Local Storage → sb-xxx-auth-token

# Test /api/recruiting/send with valid ownership
curl -X POST https://your-app.vercel.app/api/recruiting/send \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-xxx-auth-token=..." \
  -d '{
    "athlete": {"fullName": "Test", "email": "test@example.com", "id": "your-user-id"},
    "clipUrl": "https://example.com/clip",
    "coaches": [{"name": "Coach", "email": "coach@example.com"}],
    "subject": "Test",
    "body": "Test"
  }'

# Expected: 200 OK (if SMTP configured) or 503 (if SMTP not configured)

# Test with wrong athlete ID
curl -X POST https://your-app.vercel.app/api/recruiting/send \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-xxx-auth-token=..." \
  -d '{
    "athlete": {"fullName": "Test", "email": "test@example.com", "id": "wrong-user-id"},
    ...
  }'

# Expected: 403 Forbidden
```

**✅ Pass criteria:**
- Authenticated requests with correct ownership succeed
- Requests with wrong athlete ID return 403
- Unauthenticated requests return 401

---

## Troubleshooting

### Issue: "Supabase not configured" banner in dev

**Cause:** Environment variables not loaded in development.

**Fix:**
```bash
# Create .env.local with values from .env.example
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### Issue: Auth works locally but not on Vercel

**Cause:** Environment variables not set in Vercel.

**Fix:**
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set for **all environments**
3. Redeploy: `vercel --prod`

### Issue: "Invalid login credentials" error

**Causes:**
- Wrong email/password
- User not confirmed (if email confirmation required)
- Supabase user doesn't exist

**Fix:**
1. Check Supabase Dashboard → Authentication → Users
2. Verify user exists and is confirmed
3. Try password reset flow

### Issue: Redirect loop on /app

**Cause:** Auth state not loading properly.

**Fix:**
1. Check browser console for errors
2. Verify cookies are enabled
3. Check `/api/healthz` shows `supabase.connected: true`
4. Clear browser cache and cookies

### Issue: Service role key errors

**Cause:** Using service role key for client-side auth.

**Fix:**
- **Client-side (src/):** ONLY use `VITE_SUPABASE_ANON_KEY`
- **Server-side (api/):** Use `SUPABASE_SERVICE_ROLE_KEY` if needed, otherwise `SUPABASE_ANON_KEY`
- This project correctly separates them - service role only used in `api/waitlist.ts`

---

## Security Best Practices

### ✅ DO

- ✅ Use anon key for all client-side auth operations
- ✅ Enable RLS on all user tables
- ✅ Filter queries by `user_id = auth.uid()`
- ✅ Set proper Supabase redirect URLs
- ✅ Use HTTPS in production
- ✅ Verify ownership in API endpoints

### ❌ DON'T

- ❌ Expose service role key to client
- ❌ Skip RLS policies
- ❌ Trust client-provided user IDs without verification
- ❌ Store passwords in plaintext (Supabase handles this)
- ❌ Use same password for service role and user accounts

---

## Rollback Plan

If deployment fails or auth breaks:

1. **Check previous deployment:**
   ```bash
   vercel ls
   ```

2. **Promote previous deployment:**
   ```bash
   vercel promote <deployment-url>
   ```

3. **Verify rollback:**
   ```bash
   curl https://your-app.vercel.app/api/healthz
   ```

---

## Monitoring

### Key Metrics to Monitor

1. **Auth Success Rate:**
   - Supabase Dashboard → Logs → Auth logs
   - Watch for failed login attempts

2. **API Errors:**
   - Vercel Dashboard → Project → Logs
   - Filter for 401/403 errors

3. **Client Errors:**
   - Browser console in production
   - Monitor for auth-related errors

4. **Database Performance:**
   - Supabase Dashboard → Database → Performance
   - Check query performance on user tables

---

## Support

- **Supabase Docs:** https://supabase.com/docs/guides/auth
- **Vercel Docs:** https://vercel.com/docs
- **Project Repo:** Internal documentation

Last updated: 2026-02-01
