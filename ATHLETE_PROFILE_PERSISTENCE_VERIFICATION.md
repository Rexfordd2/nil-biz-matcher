# Athlete Profile Persistence - Verification Guide

## Summary

The athlete profile persistence system is **already implemented** and follows best practices. This guide helps you verify it's working correctly in your Supabase instance.

## Architecture Overview

### 1. Form Component
- **File:** `src/components/AthleteProfileForm.tsx`
- **State Management:** React `useState` for all form fields
- **Callbacks:** 
  - `onChange(draft)` - fires on every field change (debounced autosave)
  - `onSave(profile)` - fires on explicit "Save Profile" button click

### 2. Persistence Hook
- **File:** `src/hooks/useAutosaveProfile.ts`
- **Responsibilities:**
  - Load profile from Supabase on mount
  - Debounced autosave (800ms default)
  - Explicit save via `saveNow()`
  - Error handling with RLS detection
  - localStorage backup/draft storage
  - Status indicators for UI

### 3. Integration
- **File:** `src/App.tsx` (lines 496-517)
- **Hook usage:** `useAutosaveProfile({ user, debounceMs: 800 })`
- **Data flow:**
  1. User is authenticated → hook fetches profile from DB
  2. Profile populates form via `value` prop
  3. User edits form → `onChange` triggers debounced autosave
  4. User clicks "Save Profile" → `onSave` calls `saveNow()` for immediate save

### 4. Database Schema
- **Table:** `athlete_profiles`
- **Structure:**
  ```sql
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
  profile jsonb NOT NULL DEFAULT '{}'::jsonb
  created_at timestamptz NOT NULL DEFAULT now()
  updated_at timestamptz NOT NULL DEFAULT now()
  ```
- **Storage:** Entire `AthleteProfile` TypeScript object serialized to JSONB
- **Benefits:** 
  - No field mapping needed
  - No snake_case conversion
  - Schema-flexible (JSONB adapts to structure changes)

### 5. RLS Policies
All policies use `user_id = auth.uid()` pattern:
- `Allow users to read own profile` (SELECT)
- `Allow users to insert own profile` (INSERT)
- `Allow users to update own profile` (UPDATE)
- `Allow users to delete own profile` (DELETE)

## Verification Checklist

### Step 1: Verify Supabase Table Exists

Run this in your Supabase SQL Editor:

```sql
-- Check if table exists and has correct structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'athlete_profiles'
ORDER BY ordinal_position;
```

**Expected output:**
- `user_id` | `uuid` | NO | (null)
- `profile` | `jsonb` | NO | `'{}'::jsonb`
- `created_at` | `timestamp with time zone` | NO | `now()`
- `updated_at` | `timestamp with time zone` | NO | `now()`

**If table doesn't exist**, run the schema setup:
```bash
# Apply the athlete_profiles schema
psql $DATABASE_URL -f supabase/athlete_profiles.sql

# OR use Supabase dashboard:
# Copy contents of supabase/athlete_profiles.sql and paste into SQL Editor
```

### Step 2: Verify RLS is Enabled

```sql
-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'athlete_profiles';
```

**Expected:** `rowsecurity = true`

**If not enabled:**
```sql
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
```

### Step 3: Verify All RLS Policies Exist

```sql
-- List all policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'athlete_profiles'
ORDER BY policyname;
```

**Expected 4 policies:**
1. `Allow users to delete own profile` | DELETE | `user_id = auth.uid()`
2. `Allow users to insert own profile` | INSERT | `user_id = auth.uid()`
3. `Allow users to read own profile` | SELECT | `user_id = auth.uid()`
4. `Allow users to update own profile` | UPDATE | `user_id = auth.uid()` + WITH CHECK

**If policies are missing**, run:
```bash
# Apply the complete RLS setup
psql $DATABASE_URL -f supabase/VERIFY_ATHLETE_PROFILES_RLS.sql
```

### Step 4: Test Authentication Flow

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser to** `http://localhost:5173/app?debug=1`
   - The `?debug=1` parameter shows autosave status

3. **Log in** with a test account (or create one via `/auth/signup`)

4. **Navigate to "Athlete Profile" tab**

5. **Check debug info at top of page:**
   - Should show: `Env configured: true`
   - Should show: `Status: Loading…` → `All changes saved`
   - Should NOT show permission errors

### Step 5: Test Profile Persistence

**Test 1: Create new profile**
1. Fill in required fields (name, school, sport)
2. Click "Save Profile"
3. Check status indicator → should show "All changes saved"
4. Check timestamp → "Last saved at [time]"

**Test 2: Verify autosave**
1. Change a field (e.g., edit name)
2. Wait 1 second (debounce delay)
3. Status should change to "Saving…" → "All changes saved"

**Test 3: Verify persistence across page reload**
1. Fill in profile data
2. Wait for "All changes saved"
3. Refresh the page (F5)
4. Verify: All form fields are populated with saved data

**Test 4: Verify localStorage backup**
1. Open DevTools Console
2. Run: `localStorage.getItem('athleteProfileDraft:[your-user-id]')`
3. Should return a JSON string with your profile data

### Step 6: Test Error Handling

**Test with Supabase SQL Editor (simulate permission error):**

```sql
-- Temporarily break RLS policy (as admin)
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.athlete_profiles;

-- Now try to save profile in UI
-- Should see error message: "Permission denied (RLS)..."

-- Restore policy
CREATE POLICY "Allow users to update own profile"
  ON public.athlete_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

The UI should show:
- Status: "Couldn't save. Will retry."
- Error message in debug panel
- Data preserved in localStorage as backup

### Step 7: Verify Data in Database

As an authenticated user, query your profile:

```sql
-- Replace with your actual user_id from auth.users
SELECT 
  user_id,
  profile->>'name' as name,
  profile->>'school' as school,
  created_at,
  updated_at
FROM athlete_profiles
WHERE user_id = '[your-user-id]';
```

Or use the Supabase Table Editor:
1. Open Supabase Dashboard
2. Navigate to Table Editor
3. Select `athlete_profiles` table
4. View your profile data

## Common Issues & Solutions

### Issue 1: "Cloud sync unavailable"

**Symptoms:**
- Header shows "Cloud sync unavailable" even when logged in
- Status shows "Cloud sync unavailable"

**Causes & Solutions:**

A. **Environment variables missing**
   ```bash
   # Check .env file has:
   VITE_SUPABASE_URL=https://[project-ref].supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

B. **User not authenticated**
   - Log out and log back in
   - Check DevTools Console for auth errors

C. **Supabase client initialization failed**
   - Check `src/lib/supabaseClient.ts`
   - Verify env vars are loaded correctly

### Issue 2: "Permission denied (RLS)"

**Symptoms:**
- Status shows error with "permission" or "RLS"
- Save fails silently or with error toast

**Solutions:**

A. **Verify user is authenticated:**
   ```sql
   SELECT auth.uid(); -- Should return your user UUID, not NULL
   ```

B. **Check RLS policies exist:**
   ```sql
   -- Run Step 3 verification query above
   ```

C. **Verify user_id matches auth.uid():**
   ```sql
   -- Check if your profile row exists
   SELECT user_id, created_at
   FROM athlete_profiles
   WHERE user_id = auth.uid();
   ```

D. **Re-apply RLS policies:**
   ```bash
   psql $DATABASE_URL -f supabase/VERIFY_ATHLETE_PROFILES_RLS.sql
   ```

### Issue 3: Profile not loading on page load

**Symptoms:**
- Form is empty after login
- Status shows "Loading…" indefinitely

**Solutions:**

A. **Check browser console for errors**
   - Open DevTools Console (F12)
   - Look for red error messages from Supabase

B. **Verify table has data:**
   ```sql
   SELECT COUNT(*) FROM athlete_profiles WHERE user_id = auth.uid();
   ```

C. **Check useAutosaveProfile hook logs:**
   - Add `?debug=1` to URL
   - Check observability logs in console

D. **Try manual insert:**
   ```sql
   INSERT INTO athlete_profiles (user_id, profile)
   VALUES (auth.uid(), '{}'::jsonb)
   ON CONFLICT (user_id) DO NOTHING;
   ```

### Issue 4: Saved businesses work, but profile doesn't

**Symptoms:**
- `savedBusinesses` persist correctly
- Athlete profile fails to save with same credentials

**Solution:**
Both use the same pattern, so compare:

```sql
-- Check both tables have identical RLS policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('saved_businesses', 'athlete_profiles')
ORDER BY tablename, cmd;
```

Ensure both have SELECT, INSERT, UPDATE, DELETE policies.

### Issue 5: Changes not persisting after page reload

**Symptoms:**
- Save appears successful
- After refresh, form is empty or has old data

**Solutions:**

A. **Check localStorage:**
   ```javascript
   // In browser console
   const key = Object.keys(localStorage).find(k => k.includes('athleteProfileDraft'));
   const data = JSON.parse(localStorage.getItem(key));
   console.log('Local draft:', data);
   ```

B. **Query database directly:**
   ```sql
   SELECT updated_at, profile
   FROM athlete_profiles
   WHERE user_id = auth.uid();
   ```

C. **Compare timestamps:**
   - localStorage `updatedAt` vs DB `updated_at`
   - Newer localStorage data triggers "restore draft" prompt

D. **Clear localStorage and try again:**
   ```javascript
   // In browser console
   Object.keys(localStorage)
     .filter(k => k.includes('athleteProfileDraft'))
     .forEach(k => localStorage.removeItem(k));
   ```

## Test Plan for Manual QA

### Pre-requisites
- [ ] Supabase instance configured
- [ ] Environment variables set
- [ ] Table `athlete_profiles` exists
- [ ] RLS enabled with all 4 policies
- [ ] Test user account created

### Test Cases

#### TC1: New User Profile Creation
1. Log in as new user (no existing profile)
2. Navigate to Athlete Profile tab
3. Verify form is empty (no errors)
4. Fill in: name, school, at least one sport
5. Click "Save Profile"
6. **Expected:** Toast "Athlete profile saved", status "All changes saved"
7. Refresh page
8. **Expected:** Form repopulates with saved data

#### TC2: Autosave Functionality
1. Log in and navigate to Athlete Profile
2. Wait for initial load
3. Change name field
4. Wait 1 second (no clicking save)
5. **Expected:** Status changes to "Saving…" then "All changes saved"
6. Verify timestamp updates
7. Refresh page
8. **Expected:** Name change is persisted

#### TC3: Offline Draft Recovery
1. Log in and navigate to Athlete Profile
2. Fill in profile data
3. Wait for save
4. Open DevTools → Application → Local Storage
5. Find `athleteProfileDraft:[user-id]` entry
6. Note the data
7. Simulate offline: DevTools → Network tab → Offline
8. Edit profile (changes only save to localStorage)
9. Close browser
10. Reopen browser (still offline)
11. Log in and navigate to profile
12. **Expected:** "Restore unsaved changes?" prompt appears
13. Click "OK"
14. **Expected:** Form shows edited data from localStorage

#### TC4: Multiple Fields and Complex Data
1. Fill out entire form with all sections:
   - Basic info (name, school, sports)
   - Social handles (multiple platforms)
   - Media kit (images, colors, sample posts)
   - Support team (add 2+ contacts)
   - Decision circle (add 1+ contacts)
   - Academics & life
   - Availability windows
   - Performance story
   - Monetization interests
   - Physical attributes
   - Sport metrics
   - Game film links
2. Click "Save Profile"
3. **Expected:** All data saves without errors
4. Refresh page
5. **Expected:** All sections repopulate correctly
6. Query DB and verify JSONB contains all fields

#### TC5: Concurrent Edits (Multiple Tabs)
1. Open app in Tab A, log in, navigate to profile
2. Open app in Tab B (same browser), auto-logged in
3. In Tab A: change name to "Test A"
4. Wait for autosave
5. In Tab B: change name to "Test B"
6. Wait for autosave
7. **Expected:** Tab B overwrites Tab A (last write wins)
8. Refresh both tabs
9. **Expected:** Both show "Test B"

#### TC6: Large Profile Data
1. Fill profile with large data:
   - 10+ hero images (data URLs)
   - 5+ logos
   - 20+ sample posts (long text)
   - 10+ support contacts
   - 10+ training log entries
2. Click "Save Profile"
3. **Expected:** Saves successfully (may take 1-2 seconds)
4. Check DB query:
   ```sql
   SELECT pg_size_pretty(pg_column_size(profile)) as profile_size
   FROM athlete_profiles WHERE user_id = auth.uid();
   ```
5. **Expected:** Size is reasonable (< 5MB for JSONB)

#### TC7: Error Recovery
1. Log in and load profile
2. Open Supabase dashboard
3. Temporarily disable UPDATE policy on athlete_profiles
4. In app, edit profile and try to save
5. **Expected:** Error message appears, status shows error
6. Re-enable UPDATE policy in Supabase
7. Click "Save Profile" again
8. **Expected:** Save succeeds

#### TC8: Logout and Login
1. Log in, create profile, save
2. Log out
3. Log back in with same account
4. Navigate to profile
5. **Expected:** Profile loads with all saved data

#### TC9: Different User Isolation
1. Create Profile A with User A
2. Log out
3. Log in as User B
4. Navigate to profile
5. **Expected:** Form is empty (User B cannot see User A's profile)
6. Create Profile B
7. Log out, log in as User A
8. **Expected:** Profile A loads (not Profile B)

#### TC10: Form Validation
1. Navigate to profile (empty)
2. Click "Save Profile" without filling required fields
3. **Expected:** Toast message "Please fill name, school, and at least one sport"
4. No save attempt made
5. Fill in required fields
6. Click "Save Profile"
7. **Expected:** Saves successfully

## Performance Benchmarks

Expected performance (approximate):

- **Initial load (cold start):** < 500ms
- **Autosave debounce:** 800ms after last keystroke
- **Save operation:** < 200ms (profile < 100KB)
- **Large profile save:** < 1000ms (profile > 1MB)
- **Page refresh load:** < 300ms (cached auth)

## Debugging Tools

### Browser DevTools Console Commands

```javascript
// Check Supabase client
console.log('Supabase configured:', window.supabaseEnvConfigured);

// Check auth status
const { data, error } = await window.supabase.auth.getUser();
console.log('User:', data.user);

// Check profile in DB
const { data: profile, error: profileError } = await window.supabase
  .from('athlete_profiles')
  .select('*')
  .eq('user_id', data.user.id)
  .single();
console.log('Profile:', profile);

// Check localStorage
const lsKeys = Object.keys(localStorage).filter(k => k.includes('athlete'));
console.log('localStorage keys:', lsKeys);
lsKeys.forEach(k => console.log(k, JSON.parse(localStorage.getItem(k))));
```

### SQL Debugging Queries

```sql
-- Check user authentication
SELECT auth.uid() as current_user_id;

-- Check profile exists
SELECT user_id, created_at, updated_at, 
       pg_size_pretty(pg_column_size(profile)) as size
FROM athlete_profiles 
WHERE user_id = auth.uid();

-- View profile structure
SELECT user_id, jsonb_pretty(profile) as profile_pretty
FROM athlete_profiles
WHERE user_id = auth.uid();

-- Check RLS policy evaluation
EXPLAIN (VERBOSE, COSTS OFF)
SELECT * FROM athlete_profiles WHERE user_id = auth.uid();

-- Count profiles per user (should be 1)
SELECT user_id, COUNT(*) as profile_count
FROM athlete_profiles
GROUP BY user_id
HAVING COUNT(*) > 1;
```

## Next Steps After Verification

Once you've verified the system works:

1. **Monitor in production:**
   - Check Supabase logs for errors
   - Monitor `Observability.log` calls in `useAutosaveProfile`
   - Set up alerts for RLS policy violations

2. **Consider enhancements:**
   - Add conflict resolution UI for concurrent edits
   - Implement profile versioning/history
   - Add export/import functionality
   - Create profile templates

3. **Performance optimization:**
   - Add DB indexes if querying by profile fields
   - Implement profile caching strategy
   - Consider compression for large profiles

4. **User experience:**
   - Add "unsaved changes" warning on page exit
   - Implement undo/redo for profile edits
   - Add profile completeness indicator

## Related Files

- Schema: `supabase/athlete_profiles.sql`
- Verification script: `supabase/VERIFY_ATHLETE_PROFILES_RLS.sql`
- Migration: `supabase/migrations/20260202_app_user_scoping.sql`
- Hook: `src/hooks/useAutosaveProfile.ts`
- Form: `src/components/AthleteProfileForm.tsx`
- Integration: `src/App.tsx` (lines 496-517)
- Types: `src/types.ts` (AthleteProfile interface)
- Known good pattern: `src/services/savedBusinesses.ts`

## Support

If issues persist after following this guide:
1. Check Supabase dashboard logs (Database → Logs)
2. Review browser console for client-side errors
3. Compare with savedBusinesses implementation (working reference)
4. Test with a fresh Supabase project to isolate config issues
