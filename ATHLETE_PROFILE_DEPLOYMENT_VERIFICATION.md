# Athlete Profile Deployment Verification Guide

## Overview

This guide provides step-by-step instructions to verify that athlete profile persistence is working correctly in your deployed Supabase instance. Follow these steps to confirm the table exists, RLS policies are correct, and the app can successfully save/load profiles.

## Prerequisites

- Access to Supabase Dashboard (SQL Editor)
- Access to deployed application
- A test user account (or ability to create one)

---

## Phase 1: Database Verification (Run in Supabase SQL Editor)

### Step 1: Run Verification Queries

1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Open the file: `SUPABASE_VERIFICATION_QUERIES.sql`
4. Run each query section and compare results with expected output below

### Expected Results Summary

#### Query 1A: Table exists + RLS enabled
```
schemaname | tablename        | rowsecurity
-----------+------------------+------------
public     | athlete_profiles | t (true)
```

✅ **PASS**: Table exists with RLS enabled  
❌ **FAIL**: If no rows returned → table doesn't exist → run fix script  
❌ **FAIL**: If `rowsecurity = f` → RLS disabled → run fix script

#### Query 1B: Column names + types
```
column_name | data_type                | is_nullable | column_default
------------+--------------------------+-------------+----------------
user_id     | uuid                     | NO          | 
profile     | jsonb                    | NO          | '{}'::jsonb
created_at  | timestamp with time zone | NO          | now()
updated_at  | timestamp with time zone | NO          | now()
```

✅ **PASS**: All 4 columns present with correct types  
❌ **FAIL**: Missing columns or wrong types → run fix script

#### Query 1C: Primary key
```
constraint_name               | column_name
------------------------------+-------------
athlete_profiles_pkey         | user_id
```

✅ **PASS**: Primary key exists on `user_id`  
❌ **FAIL**: No result → run fix script

#### Query 1D: Foreign key
```
constraint_name              | column_name | foreign_schema | foreign_table | foreign_column | delete_rule
-----------------------------+-------------+----------------+---------------+----------------+-------------
athlete_profiles_user_id_fkey| user_id     | auth           | users         | id             | CASCADE
```

✅ **PASS**: Foreign key exists with CASCADE delete  
❌ **FAIL**: No result or wrong delete_rule → run fix script

#### Query 1E: RLS Policies
```
policyname                         | cmd    | roles           | using_expression        | with_check_expression
-----------------------------------+--------+-----------------+-------------------------+-------------------------
Allow users to delete own profile  | DELETE | {authenticated} | (user_id = auth.uid())  | NULL
Allow users to insert own profile  | INSERT | {authenticated} | NULL                    | (user_id = auth.uid())
Allow users to read own profile    | SELECT | {authenticated} | (user_id = auth.uid())  | NULL
Allow users to update own profile  | UPDATE | {authenticated} | (user_id = auth.uid())  | (user_id = auth.uid())
```

✅ **PASS**: All 4 policies present (DELETE, INSERT, SELECT, UPDATE)  
✅ **PASS**: All use `user_id = auth.uid()` predicate  
❌ **FAIL**: Missing policies or wrong predicates → run fix script

#### Query 1F: Trigger
```
trigger_name                      | table_name        | function_name  | tgenabled
----------------------------------+-------------------+----------------+----------
trg_athlete_profiles_updated_at   | athlete_profiles  | set_updated_at | O (origin)
```

✅ **PASS**: Trigger exists and is enabled  
❌ **FAIL**: No result → run fix script

#### Query 1H: Auth Check (as authenticated user)
```
current_user_id
--------------------------------------
550e8400-e29b-41d4-a716-446655440000
```

✅ **PASS**: Returns a valid UUID  
❌ **FAIL**: Returns NULL → not authenticated

---

## Phase 2: Fix Issues (If Verification Failed)

### If ANY verification query failed:

1. Open Supabase Dashboard → SQL Editor
2. Copy/paste the entire contents of: `SUPABASE_FIX_ATHLETE_PROFILES.sql`
3. Click "Run" (or press Cmd/Ctrl+Enter)
4. Review the output messages
5. Re-run verification queries (Phase 1) to confirm fixes applied

### Alternative: Run Migration

If you prefer to use migrations:

```bash
# Apply the migration to your Supabase project
supabase db push

# Or manually run the migration file:
# Copy contents of supabase/migrations/20260203_create_athlete_profiles_table.sql
# Paste into Supabase SQL Editor and run
```

---

## Phase 3: Application Testing

### Step 1: Test Profile Creation (New User)

1. **Navigate to app** (deployed URL)
2. **Log in** with a test account (or create new account)
3. **Go to Athlete Profile tab**
4. **Fill in required fields:**
   - Name: "Test Athlete"
   - School: "Test University"
   - Add at least one sport (e.g., "Football" with position "QB")
5. **Click "Save Profile" button**
6. **Expected result:**
   - ✅ Toast message: "Athlete profile saved"
   - ✅ Status shows: "All changes saved"
   - ✅ Timestamp updates: "Last saved at [time]"
7. **If save fails:**
   - Check browser console for errors
   - Add `?debug=1` to URL to see raw Supabase error
   - Note the error code/message for troubleshooting

### Step 2: Test Profile Persistence (Page Refresh)

1. **After saving (Step 1)**, note the values you entered
2. **Refresh the page** (F5 or Cmd/Ctrl+R)
3. **Expected result:**
   - ✅ Form repopulates with saved values
   - ✅ All fields match what you entered
   - ✅ Status shows: "All changes saved"
4. **If form is empty:**
   - Check Supabase database directly (see Phase 4)
   - Check browser console for load errors
   - Use `?debug=1` to see error details

### Step 3: Test Autosave (Debounced)

1. **Edit a field** (e.g., change name to "Test Athlete Modified")
2. **Wait 1 second** (debounce delay - do NOT click Save)
3. **Expected result:**
   - ✅ Status changes to "Saving…" briefly
   - ✅ Then shows "All changes saved"
   - ✅ Timestamp updates
4. **Refresh page**
5. **Expected result:**
   - ✅ Modified value is persisted

### Step 4: Test Complex Profile (Multiple Sections)

Fill out all available sections:
- ✅ Basic info (name, school, sports, social handles)
- ✅ Media kit (add 1-2 sample posts)
- ✅ Support team (add 1 contact)
- ✅ Decision circle (add 1 contact)
- ✅ Academics & life
- ✅ Availability windows
- ✅ Performance story (add 1 milestone)
- ✅ Physical attributes (height, weight)

**Save and refresh:**
- ✅ All sections should persist correctly

### Step 5: Test Error Handling

**Simulate save failure** (requires Supabase admin access):

1. In Supabase SQL Editor, temporarily disable UPDATE policy:
   ```sql
   DROP POLICY IF EXISTS "Allow users to update own profile" ON public.athlete_profiles;
   ```
2. In app, edit profile and try to save
3. **Expected result:**
   - ❌ Save fails
   - ✅ Toast shows error: "Save failed: Permission denied (RLS)..."
   - ✅ Status shows: "Couldn't save. Will retry."
   - ✅ With `?debug=1`: Raw error details visible (code, message, details)
4. **Restore policy:**
   ```sql
   CREATE POLICY "Allow users to update own profile"
     ON public.athlete_profiles FOR UPDATE
     TO authenticated
     USING (user_id = auth.uid())
     WITH CHECK (user_id = auth.uid());
   ```
5. Try save again
6. **Expected result:**
   - ✅ Save succeeds

---

## Phase 4: Direct Database Verification

### Check saved profile data in Supabase

1. Open Supabase Dashboard → Table Editor
2. Select `athlete_profiles` table
3. Find row with your `user_id`
4. **Verify:**
   - ✅ `user_id` matches your auth user ID
   - ✅ `profile` JSONB contains your data
   - ✅ `created_at` timestamp is reasonable
   - ✅ `updated_at` timestamp matches recent save

### SQL Query to inspect profile:

```sql
-- Replace with your actual user_id
SELECT 
  user_id,
  jsonb_pretty(profile) AS profile_formatted,
  created_at,
  updated_at
FROM athlete_profiles
WHERE user_id = auth.uid();
```

**Expected output:**
- ✅ One row with your profile data
- ✅ `profile_formatted` shows readable JSON with your form values
- ✅ Timestamps are recent

---

## Phase 5: Regression Testing

### Ensure other features still work:

#### Test Saved Businesses (Known Working Feature)

1. Navigate to "Discover" tab
2. Search for a business (e.g., "coffee shop")
3. Click "Save" on a result
4. **Expected result:**
   - ✅ Business saves successfully
   - ✅ Can view saved businesses
   - ✅ Can remove saved businesses

**Why test this?**
- Confirms `saved_businesses` table/policies weren't affected
- Validates auth system is working
- Ensures no regression from profile changes

---

## Troubleshooting Guide

### Issue 1: "Table does not exist" error

**Symptoms:**
- Error in browser console: `relation "athlete_profiles" does not exist`
- Status shows error
- Debug mode shows code: `42P01`

**Solution:**
1. Run `SUPABASE_FIX_ATHLETE_PROFILES.sql` in SQL Editor
2. Verify table creation with Query 1A
3. Refresh app and retry

---

### Issue 2: "Permission denied" / RLS error

**Symptoms:**
- Error: "Permission denied (RLS)"
- Debug mode shows code: `42501` or `PGRST301`
- Can log in but can't save

**Solution:**
1. Verify RLS is enabled (Query 1A)
2. Check policies exist (Query 1E)
3. Verify you're authenticated (Query 1H)
4. If policies missing: run `SUPABASE_FIX_ATHLETE_PROFILES.sql`
5. If still failing: check `auth.uid()` returns your user_id:
   ```sql
   SELECT auth.uid() AS my_id,
          EXISTS(SELECT 1 FROM auth.users WHERE id = auth.uid()) AS user_exists;
   ```

---

### Issue 3: Profile saves but doesn't persist after refresh

**Symptoms:**
- Save succeeds (toast shows success)
- Refresh shows empty form
- No errors in console

**Possible causes:**

**A) Saving to localStorage only (not Supabase)**
- Check if `supabaseEnvConfigured` is `false`
- Verify env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

**B) RLS blocking SELECT**
- Check SELECT policy exists (Query 1E)
- Verify policy uses correct column name: `user_id = auth.uid()`

**C) Wrong user_id**
- Compare saved row's `user_id` with `auth.uid()`:
  ```sql
  SELECT 
    ap.user_id AS saved_user_id,
    auth.uid() AS current_user_id,
    ap.user_id = auth.uid() AS ids_match
  FROM athlete_profiles ap
  WHERE ap.user_id = auth.uid();
  ```

**Solution:**
1. Add `?debug=1` to URL
2. Check "Last saved" timestamp updates on save
3. Check "Raw Supabase Error" section for clues
4. Run Query 1I to see if row exists for your user

---

### Issue 4: Autosave doesn't trigger

**Symptoms:**
- Editing fields doesn't trigger autosave
- Status remains "idle"
- Must click "Save Profile" manually

**This is expected behavior if:**
- Less than 800ms since last edit (debounce delay)
- No actual changes to profile data

**To test autosave:**
1. Make a change (e.g., edit name)
2. Wait **2 full seconds** without further edits
3. Status should change to "Saving…" then "All changes saved"

---

### Issue 5: Raw error shows "column does not exist"

**Symptoms:**
- Debug mode error: `column "user_id" does not exist`
- Or: `column "profile" does not exist`

**Solution:**
1. Run Query 1B to check column names
2. Compare with app code expectations (see below)
3. If columns wrong: run `SUPABASE_FIX_ATHLETE_PROFILES.sql`

**App expects these exact column names:**
- `user_id` (uuid, primary key)
- `profile` (jsonb)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

---

### Issue 6: Multiple profiles for same user

**Symptoms:**
- Duplicate rows in `athlete_profiles` table
- Inconsistent profile loads

**Diagnosis:**
```sql
SELECT user_id, COUNT(*) as profile_count
FROM athlete_profiles
GROUP BY user_id
HAVING COUNT(*) > 1;
```

**Solution:**
1. **Identify which profile to keep** (usually most recent):
   ```sql
   SELECT user_id, created_at, updated_at, 
          jsonb_pretty(profile) AS data
   FROM athlete_profiles
   WHERE user_id = '[your-user-id]'
   ORDER BY updated_at DESC;
   ```
2. **Delete duplicates** (keep the newest):
   ```sql
   DELETE FROM athlete_profiles
   WHERE user_id = '[your-user-id]'
     AND created_at < (
       SELECT MAX(created_at) 
       FROM athlete_profiles 
       WHERE user_id = '[your-user-id]'
     );
   ```
3. **Prevent future duplicates**: Verify primary key exists (Query 1C)

---

## Debug Mode Reference

### Using Debug Mode (`?debug=1`)

Add `?debug=1` to any app URL to enable debug panel:

Example: `https://your-app.com/app?debug=1`

**Debug panel shows:**
- User ID
- Env configured status
- Last saved timestamp
- Current status
- Friendly error message
- **Raw Supabase Error** (when save fails):
  - `code`: Postgres/PostgREST error code
  - `status`: HTTP status code
  - `message`: Error message
  - `details`: Additional details
  - `hint`: Postgres hint (if available)

**Common error codes:**
- `42P01`: Table doesn't exist
- `42501`: Permission denied (RLS)
- `23503`: Foreign key violation (user doesn't exist in auth.users)
- `23505`: Unique constraint violation (duplicate key)
- `PGRST301`: JWT invalid/expired
- `PGRST302`: Row-level security policy violation

---

## Success Criteria Checklist

Mark each item when verified:

### Database Structure
- [ ] Table `athlete_profiles` exists in `public` schema
- [ ] RLS is enabled on the table
- [ ] Column `user_id` is type `uuid` and is primary key
- [ ] Column `profile` is type `jsonb` with default `'{}'`
- [ ] Foreign key exists: `user_id` → `auth.users(id)` with CASCADE
- [ ] Trigger `trg_athlete_profiles_updated_at` exists

### RLS Policies
- [ ] SELECT policy: `user_id = auth.uid()`
- [ ] INSERT policy: `user_id = auth.uid()`
- [ ] UPDATE policy: `user_id = auth.uid()` (both USING and WITH CHECK)
- [ ] DELETE policy: `user_id = auth.uid()`

### Application Functionality
- [ ] Can create new profile (save succeeds)
- [ ] Profile persists after page refresh
- [ ] Autosave triggers after editing (with 800ms debounce)
- [ ] All form sections save correctly (test at least 3 sections)
- [ ] Success toast shows on successful save
- [ ] Error toast/status shows on failed save
- [ ] Raw error details visible in debug mode (`?debug=1`)

### Regression Tests
- [ ] Saved businesses still work (no impact from profile changes)
- [ ] User can log in/out without issues
- [ ] Other app features unaffected

### Edge Cases
- [ ] Can handle empty profile (creates with defaults)
- [ ] Can update existing profile multiple times
- [ ] Different users have isolated profiles (no data leakage)
- [ ] Profile size < 5MB (JSONB reasonable size)

---

## Performance Benchmarks

**Expected timings** (approximate):

| Operation | Expected Time | Acceptable Range |
|-----------|--------------|------------------|
| Initial load (cold start) | < 500ms | 100ms - 1000ms |
| Autosave | < 200ms | 50ms - 500ms |
| Explicit save | < 200ms | 50ms - 500ms |
| Page refresh load | < 300ms | 100ms - 800ms |
| Debounce delay | 800ms | N/A (configurable) |

**If slower than expected:**
- Check network latency to Supabase
- Check profile size (large JSONB may be slow)
- Check for missing indexes (though primary key should be sufficient)

---

## Next Steps After Verification

### If all tests pass:
1. ✅ Document success in project logs
2. ✅ Monitor production for any save failures
3. ✅ Set up alerts for RLS policy violations (if available)
4. ✅ Consider adding profile versioning/history (future enhancement)

### If tests fail:
1. 📋 Document which specific tests failed
2. 📋 Capture raw error messages from debug mode
3. 📋 Run troubleshooting steps for that specific issue
4. 📋 Re-run verification after applying fixes
5. 📋 If still failing: check Supabase logs for additional context

---

## Support Resources

### Files to reference:
- Verification queries: `SUPABASE_VERIFICATION_QUERIES.sql`
- Fix script: `SUPABASE_FIX_ATHLETE_PROFILES.sql`
- Migration: `supabase/migrations/20260203_create_athlete_profiles_table.sql`
- Hook implementation: `src/hooks/useAutosaveProfile.ts`
- Form component: `src/components/AthleteProfileForm.tsx`

### Supabase Dashboard sections:
- **SQL Editor**: Run verification/fix queries
- **Table Editor**: View raw data
- **Authentication**: Check user accounts
- **Database → Logs**: View query logs and errors
- **Database → Roles**: Verify RLS policies

---

**Last Updated:** 2026-02-03  
**Version:** 1.0
