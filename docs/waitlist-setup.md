# Waitlist Setup Guide

This guide covers the setup required to enable the `/api/waitlist` serverless function in production.

## Overview

The waitlist feature allows anonymous users to sign up for notifications on the public landing page. It consists of:

1. **Client-side**: `src/lib/waitlist.ts` - submits emails to `/api/waitlist`
2. **Serverless API**: `api/waitlist.ts` - validates and stores emails
3. **Database**: `public.waitlist` table in Supabase with RLS policies

## Prerequisites

- Supabase project with database access
- Vercel project deployed (or access to set environment variables)
- Supabase Service Role Key or Anon Key

## Step 1: Apply Database Schema

The waitlist table must exist in your Supabase database before the API function can store emails.

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy the contents of `supabase/migrations/20260128_update_waitlist_schema.sql`
6. Paste into the SQL editor
7. Click **Run** to execute

This migration is **idempotent** (safe to run multiple times).

### Option B: Using Supabase CLI

If you have Supabase CLI installed and configured:

```bash
# Apply all pending migrations
supabase db push

# Or apply this specific migration
psql $DATABASE_URL -f supabase/migrations/20260128_update_waitlist_schema.sql
```

### What the Migration Creates

- `public.waitlist` table with columns:
  - `id` (uuid, primary key)
  - `email` (text, required)
  - `anon_id` (text, nullable) - for analytics tracking
  - `source` (text, nullable) - e.g., 'landing', 'demo'
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` (text, nullable)
  - `created_at` (timestamptz, default now())
- **Unique constraint** on `lower(email)` - prevents duplicate emails (case-insensitive)
- **RLS policies**:
  - Anonymous users: INSERT only (for signup)
  - Authenticated users: INSERT + SELECT (for admin)
  - Anonymous users: CANNOT select, update, or delete

### Verification

After applying the migration, verify the table exists:

```sql
-- Run in Supabase SQL Editor
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'waitlist';

-- Check the unique constraint exists
SELECT indexname FROM pg_indexes WHERE tablename = 'waitlist' AND indexname = 'idx_waitlist_email_lower_unique';
```

Expected results:
- First query returns: `waitlist`
- Second query returns: `idx_waitlist_email_lower_unique`

## Step 2: Configure Vercel Environment Variables

The serverless function needs Supabase credentials to write to the database.

### Required Variables

Set these in your Vercel project:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Add the following variables:

#### Option A: Server-Side Service Role Key (Recommended for Production)

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Benefits**:
- Bypasses RLS (more reliable for server-side writes)
- No client exposure risk
- Recommended for production

**Where to find**:
- Supabase Dashboard → **Settings** → **API**
- Copy **Project URL** → `SUPABASE_URL`
- Copy **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

#### Option B: Anonymous Key (Works but uses RLS)

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Benefits**:
- Works with existing RLS policy (`Allow anonymous waitlist inserts`)
- Same key as client-side (if already set)

**Where to find**:
- Supabase Dashboard → **Settings** → **API**
- Copy **Project URL** → `SUPABASE_URL`
- Copy **anon public** → `SUPABASE_ANON_KEY`

### Important Notes

- **Do NOT use `VITE_` prefix** for server-side variables (e.g., `SUPABASE_URL` not `VITE_SUPABASE_URL`)
- These variables are **server-only** and not exposed to the client
- The function will check for `SUPABASE_URL` + (`SUPABASE_SERVICE_ROLE_KEY` || `SUPABASE_ANON_KEY`)
- If neither key is set, the function returns `{ ok: true, status: "accepted_no_storage" }` (graceful no-op)

### Setting Environment Variables

**Via Vercel Dashboard**:
1. Settings → Environment Variables
2. Add each variable with:
   - **Name**: Variable name (e.g., `SUPABASE_URL`)
   - **Value**: Your Supabase value
   - **Environment**: Select **Production**, **Preview**, and **Development** (or as needed)
3. Click **Save**

**Via Vercel CLI**:

```bash
# Production only
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# All environments
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

## Step 3: Redeploy to Apply Changes

After setting environment variables, redeploy your application:

### Via Vercel Dashboard

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click **⋯** (three dots) → **Redeploy**
4. **Optional**: Check **"Use existing Build Cache"** OFF to force fresh build
5. Confirm

### Via Vercel CLI

```bash
# Production deployment with fresh build
vercel --prod

# Or force rebuild
vercel --prod --force
```

### Via Git Push

If you have auto-deploy enabled:

```bash
git push origin main
```

The GitHub Actions workflow (`.github/workflows/deploy-vercel.yml`) will automatically deploy.

## Step 4: Verify the API Works

After deployment, test the waitlist endpoint:

### Test with cURL

```bash
# Test POST /api/waitlist
curl -X POST https://your-app.vercel.app/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","source":"manual_test"}'

# Expected success response:
# {"ok":true,"status":"created"}

# Test duplicate email (should also succeed):
curl -X POST https://your-app.vercel.app/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","source":"manual_test"}'

# Expected duplicate response:
# {"ok":true,"status":"already_registered"}
```

### Test with Browser DevTools

1. Open your production site
2. Open DevTools (F12) → **Console** tab
3. Run:

```javascript
fetch('/api/waitlist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'devtools-test@example.com', source: 'devtools' })
})
  .then(r => r.json())
  .then(console.log)

// Expected: { ok: true, status: "created" }
```

### Verify Database Insert

1. Go to Supabase Dashboard → **Table Editor**
2. Select `waitlist` table
3. Verify your test email appears in the table
4. Note: Email should be stored in lowercase (normalized)

## Troubleshooting

### Issue: `{"ok":true,"status":"accepted_no_storage"}`

**Cause**: Supabase environment variables are not set correctly

**Fix**:
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`) are set in Vercel
2. Redeploy after setting variables
3. Check Vercel logs for any environment variable warnings

### Issue: `{"ok":false,"error":"Failed to save email"}`

**Cause**: Database error (table doesn't exist, RLS policy blocking, or invalid credentials)

**Fix**:
1. Verify `public.waitlist` table exists (run Step 1)
2. Check RLS policies allow anonymous inserts
3. Verify your service role key or anon key is correct
4. Check Vercel function logs for detailed error

### Issue: `{"ok":false,"error":"Invalid email address"}`

**Cause**: Email validation failed (malformed email)

**Fix**: Ensure email matches format `user@domain.com`

### Issue: Duplicate emails not detected

**Cause**: Unique constraint not applied

**Fix**:
1. Verify `idx_waitlist_email_lower_unique` index exists
2. Re-run migration if needed

## Security Notes

- **Service Role Key**: Keep this secret! Never expose in client-side code or commit to git
- **RLS Policies**: Even if anon key is compromised, RLS prevents reads/updates/deletes
- **Email Normalization**: Emails are stored in lowercase to prevent case-sensitive duplicates
- **Validation**: Both client (`src/lib/waitlist.ts`) and server (`api/waitlist.ts`) validate email format

## Related Files

- **API Function**: `api/waitlist.ts`
- **Client Helper**: `src/lib/waitlist.ts`
- **Schema Migration**: `supabase/migrations/20260128_update_waitlist_schema.sql`
- **Original Schema**: `supabase/waitlist.sql`
- **Environment Example**: `.env.example` (update to include `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`)

## Next Steps

After setup is complete:

1. Test the waitlist signup flow on your production site
2. Monitor Supabase logs for any errors
3. Set up email notifications (optional) to notify you of new signups
4. Export waitlist data periodically for marketing campaigns
