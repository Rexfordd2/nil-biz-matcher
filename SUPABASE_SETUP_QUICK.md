# Supabase Setup for Waitlist Persistence - Quick Guide

## Is This Required?

**No** - The app works without Supabase. When Supabase is not configured:
- ✅ `/api/waitlist` returns `{ ok: true, status: "accepted_no_storage" }`
- ✅ Submissions appear successful to users
- ❌ Emails are NOT persisted (no database storage)

**Yes, if you want to:**
- Store waitlist emails in a database
- Query/export waitlist data
- Track UTM parameters and referral sources
- Enable authenticated user features later

## Quick Setup (3 Steps)

### Step 1: Get Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (or create one)
3. Navigate to **Settings** → **API**
4. Copy these values:
   - **Project URL** → This is `SUPABASE_URL`
   - **service_role secret** → This is `SUPABASE_SERVICE_ROLE_KEY` (recommended)
   - OR **anon public** → This is `SUPABASE_ANON_KEY` (alternative)

### Step 2: Apply Database Migration

**Option A: SQL Editor (Easiest)**
1. Go to **SQL Editor** in Supabase Dashboard
2. Click **New Query**
3. Copy the contents of `supabase/migrations/20260128_update_waitlist_schema.sql`
4. Paste and click **Run**

**Option B: CLI**
```bash
# If you have Supabase CLI installed
supabase db push

# Or use psql directly
psql $DATABASE_URL -f supabase/migrations/20260128_update_waitlist_schema.sql
```

**What This Creates:**
- `public.waitlist` table
- Unique constraint on email (case-insensitive)
- RLS policies (anonymous can INSERT, authenticated can SELECT)

### Step 3: Set Vercel Environment Variables

**Via Vercel Dashboard:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. **Settings** → **Environment Variables**
4. Add these variables:

| Name | Value | Environment |
|------|-------|-------------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` (from step 1) | Production, Preview |

5. **Save** and **Redeploy**

**Via Vercel CLI:**
```powershell
# Set for production
vercel env add SUPABASE_URL production
# Paste: https://your-project.supabase.co

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Redeploy
vercel deploy --prod --force
```

## Verification

After deployment, test the endpoint:

```powershell
# Submit test email
curl.exe -X POST https://athlete-ledger.vercel.app/api/waitlist `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"source\":\"manual_test\"}'

# Expected response:
# {"ok":true,"status":"created"}

# Submit same email again (duplicate)
curl.exe -X POST https://athlete-ledger.vercel.app/api/waitlist `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"source\":\"manual_test\"}'

# Expected response:
# {"ok":true,"status":"already_registered"}
```

Then check Supabase:
1. Go to **Table Editor** → `waitlist`
2. Verify `test@example.com` appears in the table

## Troubleshooting

### Still getting `"accepted_no_storage"`?
- ✅ Check: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel
- ✅ Check: You redeployed after setting env vars
- ✅ Check: Variable names are exact (no `VITE_` prefix for server-side vars)

### Getting 500 error?
- ✅ Check: Migration was applied (table exists)
- ✅ Check: Service role key is correct (not anon key)
- ✅ Check: RLS policies allow anonymous inserts
- ✅ Check: Vercel function logs for detailed error

### Duplicate emails not detected?
- ✅ Check: Unique constraint `idx_waitlist_email_lower_unique` exists
- ✅ Re-run migration if needed (it's idempotent)

## Security Notes

⚠️ **NEVER** commit `SUPABASE_SERVICE_ROLE_KEY` to git  
⚠️ **NEVER** expose service role key to client-side code  
✅ **DO** use server-side env vars (no `VITE_` prefix)  
✅ **DO** enable RLS policies (already in migration)

## Alternative: Use Anon Key Instead

If you prefer to use the anon key (less privileged):

Set `SUPABASE_ANON_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`:

```powershell
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
```

**Trade-offs:**
- ✅ Less risky if key is exposed
- ❌ Relies on RLS policies (more potential failure points)
- ⚠️ Service role key is recommended for reliability

## Full Documentation

For complete details, see:
- `docs/waitlist-setup.md` - Comprehensive setup guide
- `supabase/migrations/20260128_update_waitlist_schema.sql` - Database schema
- `api/waitlist.ts` - Implementation details
