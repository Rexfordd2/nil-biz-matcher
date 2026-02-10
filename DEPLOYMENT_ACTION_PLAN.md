# Deployment Action Plan - Execute in Order

**Target**: Athlete Ledger Vercel Project (Production)  
**Goal**: Enable authenticated app with user data scoping

---

## ✅ Step 1: Set VITE_DEBUG_KEY on Vercel (Production)

### Manual Steps (Vercel Dashboard):

1. Go to: https://vercel.com/dashboard
2. Select project: **"Monster Collective"** or **"Athlete Ledger"**
3. Navigate to: **Settings → Environment Variables**
4. Click **"Add New"**
5. Configure:
   - **Name**: `VITE_DEBUG_KEY`
   - **Value**: `SECURE_KEY_GENERATED_BELOW`
   - **Environment**: ✅ Production (check this box only)
6. Click **"Save"**

**Generated Secure Key** (copy this):
```
7e6a627f018770895176a7c45373eba4e1b921c3fca72098d5f2d31844f76ea5
```

---

## ✅ Step 2: Confirm Frontend Env Vars ✓

**Status**: COMPLETE  
All frontend env var names match between code and `.env.example`:

- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`
- ✅ `VITE_DEBUG_KEY`
- ✅ `VITE_GOOGLE_MAPS_API_KEY`
- ✅ `VITE_APP_MODE`
- ✅ `VITE_PUBLIC_MODE`
- ✅ `VITE_DIAGNOSTICS`
- ✅ `VITE_WAITLIST_EMBED_HTML` / `VITE_WAITLIST_EMBED_URL`

No changes needed.

---

## ✅ Step 3: Run Migration in Supabase

### Target Supabase Project:
**Athlete Ledger Production** (the same project used for auth)

### What the migration does:
- Adds `user_id` columns to all tables (idempotent)
- Enables RLS on all app tables
- Creates owner-only policies (each user can only see their own data)

### Execute in Supabase Dashboard:

1. Go to: https://app.supabase.com
2. Select your **Athlete Ledger** project
3. Navigate to: **SQL Editor**
4. Click: **"New Query"**
5. Copy the ENTIRE contents of: `supabase/migrations/20260202_app_user_scoping.sql`
6. Paste into the SQL editor
7. Click: **"Run"** (or press Ctrl+Enter)
8. Wait for: **"Success. No rows returned"** message

### Verification:
Run this query to confirm RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'profiles', 'athlete_profile', 'onboarding_progress', 
    'athlete_profiles', 'recruiting_targets', 'saved_businesses', 
    'user_data', 'orgs', 'org_contacts', 'user_targets'
  );
```

All rows should show `rowsecurity = true`

---

## ✅ Step 4: Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY on Vercel

### Get Your Supabase Credentials:

1. In Supabase Dashboard: **Settings → API**
2. Copy these values:
   - **Project URL** → This is `VITE_SUPABASE_URL`
   - **anon public** key → This is `VITE_SUPABASE_ANON_KEY`

### Add to Vercel (same steps as Step 1):

1. Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables
2. Click **"Add New"** for each variable:

**Variable 1:**
- **Name**: `VITE_SUPABASE_URL`
- **Value**: `https://xxxxx.supabase.co` (from Supabase Dashboard)
- **Environment**: ✅ Production

**Variable 2:**
- **Name**: `VITE_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGc...` (from Supabase Dashboard)
- **Environment**: ✅ Production

3. Click **"Save"** for each

---

## ✅ Step 5: Redeploy

### Option A: Via Vercel Dashboard (Easiest)

1. Go to: https://vercel.com/dashboard → Your Project → **Deployments**
2. Find the latest deployment
3. Click the **"⋯"** menu (three dots)
4. Click **"Redeploy"**
5. Click **"Redeploy"** again to confirm
6. Wait 2-3 minutes for build to complete

### Option B: Via Git Push

```powershell
git commit --allow-empty -m "Trigger redeploy with new env vars"
git push origin main
```

### Verification:
- Build should succeed (no errors)
- Look for "Build completed" in Vercel dashboard
- Production URL should update

---

## ✅ Step 6: Signup/Login + Data Isolation Test

### Test A: Basic Auth Flow

1. **Open production site**: https://[your-domain].vercel.app
2. **Sign up User A**:
   - Email: `testuser1@example.com`
   - Password: `TestPass123!`
3. **Verify login** works and app loads

### Test B: Data Isolation (Critical)

**As User A** (`testuser1@example.com`):
1. Navigate to **"Discover Businesses"** (if available)
2. Save a business or create a recruiting target
3. Note the item name/details
4. **Sign out**

**Create User B**:
5. Sign up with: `testuser2@example.com` / `TestPass456!`
6. **Verify User B cannot see User A's data**:
   - Go to saved businesses → should be empty
   - Go to recruiting targets → should be empty
   - Go to any user-specific page → should show no data from User A

**Expected Behavior**:
- ✅ User B sees ONLY their own empty state
- ✅ User B cannot access User A's saved items
- ❌ FAIL if User B sees any of User A's data

### Test C: User A Data Persistence

7. **Sign out User B**
8. **Log back in as User A** (`testuser1@example.com`)
9. **Verify User A still sees their original data**:
   - Saved businesses should show the item from step 2
   - Data persists across sessions

### Test D: Cross-Contamination Check

10. **As User A**: Save another item
11. **Sign out, log in as User B**
12. **Verify User B still sees zero items** (no cross-contamination)

---

## 📋 Completion Checklist

- [ ] Step 1: VITE_DEBUG_KEY set in Vercel Production
- [ ] Step 2: Env var names confirmed (auto-complete)
- [ ] Step 3: Migration run in Supabase (RLS verified)
- [ ] Step 4: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set in Vercel
- [ ] Step 5: Production redeployed successfully
- [ ] Step 6A: User A signup/login works
- [ ] Step 6B: User B cannot see User A's data
- [ ] Step 6C: User A data persists
- [ ] Step 6D: No cross-contamination

---

## 🚨 Troubleshooting

### If signup fails:
- Check Vercel build logs for errors
- Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly
- Test Supabase credentials manually in code

### If User B sees User A's data:
- ❌ **CRITICAL SECURITY ISSUE**
- Check Supabase RLS policies are enabled: Run verification query from Step 3
- Check migration was applied: Look for `user_id` columns in tables
- Re-run migration if needed (it's idempotent)

### If build fails:
- Check for `VITE_PUBLIC_MODE=true` in Vercel env vars
- Verify all VITE_ variables are in Production environment (not just Preview)

---

## 🎯 Success Criteria

Deployment is successful when:
1. ✅ Two users can sign up independently
2. ✅ Each user only sees their own data
3. ✅ No data leaks between users
4. ✅ Data persists across login sessions
5. ✅ All tables have RLS enabled in Supabase
