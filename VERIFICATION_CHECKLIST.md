# Verification Checklist

This checklist verifies the fixes for Google Maps/Places search and Athlete Profile persistence.

## Prerequisites

Before starting verification:
- [ ] Google Cloud Console: Ensure you have a valid API key with Maps JavaScript API and Places API enabled
- [ ] Supabase: Ensure you have a Supabase project with `athlete_profiles` table configured
- [ ] Test user account: Have a test user account ready for authentication testing

## Part 1: Local Environment - Google Maps/Places

### Setup
- [ ] Add `VITE_GOOGLE_MAPS_API_KEY=your-key-here` to `.env` or `.env.local`
- [ ] Restart the Vite dev server: `npm run dev`
- [ ] Open the app in your browser: `http://localhost:5173`

### Discover Business Tab
- [ ] Navigate to the Discover tab
- [ ] Verify: No "Missing VITE_GOOGLE_MAPS_API_KEY" warning banner appears
- [ ] Enter "pizza" in the What field
- [ ] Enter a city name (e.g., "Seattle, WA") in the Where field
- [ ] Click "Search"
- [ ] ✅ Expected: Search completes successfully
- [ ] ✅ Expected: Results appear in a list on the right
- [ ] ✅ Expected: Map displays with markers for each result
- [ ] Click on a result
- [ ] ✅ Expected: Details panel shows with phone, website, and opening hours
- [ ] ✅ Expected: "Save" button is available (if logged in)

### Recruiting Tab - Explore Panel
- [ ] Navigate to the Recruiting tab
- [ ] Select the "Explore (Map)" tab if not already selected
- [ ] Verify: No "Missing VITE_GOOGLE_MAPS_API_KEY" warning banner appears
- [ ] Select a sport from the dropdown (e.g., "soccer")
- [ ] Select a level (e.g., "college")
- [ ] Click "Refresh results"
- [ ] ✅ Expected: Search completes successfully
- [ ] ✅ Expected: Places appear on the map
- [ ] ✅ Expected: Results list shows organizations
- [ ] Click on a result
- [ ] ✅ Expected: Details drawer opens with org information
- [ ] ✅ Expected: "Save to My Targets" button works (if logged in)

### Test Missing Key Behavior (Local)
- [ ] Remove or comment out `VITE_GOOGLE_MAPS_API_KEY` from `.env`
- [ ] Restart dev server
- [ ] Navigate to Discover tab
- [ ] ✅ Expected: Orange warning banner appears with setup instructions
- [ ] ✅ Expected: Search button is disabled
- [ ] Navigate to Recruiting → Explore tab
- [ ] ✅ Expected: Orange warning banner appears with setup instructions
- [ ] ✅ Expected: "Refresh results" button is disabled
- [ ] ✅ Expected: Helpful message: "Search disabled: Google Maps API key not configured"

## Part 2: Vercel Deployment - Google Maps/Places

### Setup
- [ ] Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- [ ] Add `VITE_GOOGLE_MAPS_API_KEY` with your API key
- [ ] Select environments: Production, Preview, Development (as needed)
- [ ] Save
- [ ] Trigger a new deployment (push to git or manual redeploy)

### Verification
- [ ] Wait for deployment to complete
- [ ] Open the deployed URL
- [ ] Navigate to Discover tab
- [ ] ✅ Expected: No warning banner about missing key
- [ ] Perform a search (same as local test)
- [ ] ✅ Expected: Search works and returns results
- [ ] Navigate to Recruiting → Explore tab
- [ ] ✅ Expected: Map search works

### Test Missing Key in Production Build
- [ ] Remove `VITE_GOOGLE_MAPS_API_KEY` from Vercel environment variables
- [ ] Trigger a new build
- [ ] ✅ Expected: Build should FAIL with clear error message
- [ ] ✅ Expected: Error message explains that `VITE_GOOGLE_MAPS_API_KEY` is required
- [ ] ✅ Expected: Error provides setup instructions for Vercel

### Test Opt-Out (Demo Builds Only)
- [ ] Add `VITE_ALLOW_MISSING_GOOGLE_MAPS_KEY=true` to Vercel environment variables
- [ ] Trigger a new build (without `VITE_GOOGLE_MAPS_API_KEY`)
- [ ] ✅ Expected: Build succeeds (bypasses validation)
- [ ] ✅ Expected: Deployed app shows warning banner and disables search

## Part 3: Athlete Profile Persistence

### Supabase Setup (One-time)
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Copy and run the SQL from `supabase/VERIFY_ATHLETE_PROFILES_RLS.sql`
- [ ] Run the verification queries to confirm:
  - [ ] ✅ RLS is enabled on `athlete_profiles` table
  - [ ] ✅ All 4 policies exist (select, insert, update, delete)
- [ ] Run test queries as documented in the SQL file

### Local Testing
- [ ] Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are in `.env`
- [ ] Start dev server: `npm run dev`
- [ ] Log in with a test user account
- [ ] Navigate to "Athlete Profile" tab
- [ ] ✅ Expected: Status shows "Loading…" briefly, then "Cloud sync: Available" in header

#### Test Profile Save
- [ ] Edit any field in the athlete profile form (e.g., name, sport, school)
- [ ] Wait 1-2 seconds (debounced save)
- [ ] ✅ Expected: Status changes to "Saving…"
- [ ] ✅ Expected: Status changes to "All changes saved"
- [ ] ✅ Expected: "Last saved at" timestamp appears
- [ ] Check browser console
- [ ] ✅ Expected: No error messages
- [ ] ✅ Expected: Observability logs show `autosave.save` with status `ok`

#### Test Profile Load (Persistence)
- [ ] Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- [ ] Log in again if needed
- [ ] Navigate to "Athlete Profile" tab
- [ ] ✅ Expected: Previously saved profile data appears in the form
- [ ] ✅ Expected: Status shows "All changes saved" (not "Saving…")

#### Test Supabase Direct Query
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Run this query:
  ```sql
  SELECT user_id, updated_at, profile->>'name' as name
  FROM athlete_profiles
  WHERE user_id = auth.uid();
  ```
- [ ] ✅ Expected: Row exists for your test user
- [ ] ✅ Expected: `updated_at` timestamp matches recent save
- [ ] ✅ Expected: Profile JSON contains your data

### Test RLS Security
- [ ] In Supabase SQL Editor, run:
  ```sql
  SELECT COUNT(*) FROM athlete_profiles WHERE user_id != auth.uid();
  ```
- [ ] ✅ Expected: Returns 0 (cannot access other users' profiles)
- [ ] Try to insert with wrong user_id:
  ```sql
  INSERT INTO athlete_profiles (user_id, profile)
  VALUES ('00000000-0000-0000-0000-000000000000', '{}'::jsonb);
  ```
- [ ] ✅ Expected: Error 42501 (permission denied / RLS)

### Test Unauthenticated State
- [ ] Log out from the app
- [ ] Navigate to "Athlete Profile" tab
- [ ] Edit fields in the form
- [ ] ✅ Expected: Changes save to localStorage only
- [ ] ✅ Expected: Status shows "Cloud sync unavailable"
- [ ] ✅ Expected: No Supabase errors in console

### Test Multiple Sessions (RLS Isolation)
- [ ] Open two browser windows (or use incognito mode)
- [ ] Log in as User A in window 1
- [ ] Log in as User B in window 2
- [ ] Edit profile in window 1 (User A)
- [ ] ✅ Expected: User A's profile saves successfully
- [ ] Switch to window 2 (User B)
- [ ] Navigate to Athlete Profile tab
- [ ] ✅ Expected: User B sees their own profile (not User A's)
- [ ] Edit User B's profile
- [ ] ✅ Expected: User B's profile saves successfully
- [ ] Switch back to window 1 (User A)
- [ ] Refresh the page
- [ ] ✅ Expected: User A still sees their own profile (unchanged by User B)

## Part 4: Error Handling & Logging

### Test RLS Error Detection
- [ ] In Supabase Dashboard → Authentication → Policies
- [ ] Temporarily disable the "Allow users to update own profile" policy
- [ ] In the app, try to save athlete profile changes
- [ ] ✅ Expected: Error message appears: "Permission denied (RLS). Please ensure you are logged in."
- [ ] Check browser console
- [ ] ✅ Expected: Observability log shows `autosave.save` with status `error`
- [ ] Re-enable the policy in Supabase

### Test Observability Logs
- [ ] Open browser console (F12)
- [ ] Clear console
- [ ] Perform a Discover search
- [ ] ✅ Expected: Logs with feature `discover` appear
- [ ] Perform a Recruiting search
- [ ] ✅ Expected: Logs with feature `recruitment` appear
- [ ] Save athlete profile changes
- [ ] ✅ Expected: Logs with feature `profile`, route `autosave.save` appear
- [ ] Load athlete profile (refresh page)
- [ ] ✅ Expected: Logs with feature `profile`, route `autosave.load` appear

## Troubleshooting

### Google Maps Issues
- **Warning banner persists after adding key**: Restart dev server and clear browser cache
- **Search returns no results**: Verify API key has Places API enabled in Google Cloud Console
- **"Places not available" error**: Check that `libraries=places` is in the script URL
- **Build fails in production**: Ensure `VITE_GOOGLE_MAPS_API_KEY` is set in deployment environment

### Athlete Profile Issues
- **"Cloud sync unavailable"**: Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- **"Permission denied (RLS)"**: Verify RLS policies exist using SQL verification script
- **Changes don't persist**: Check browser console for errors; verify user is logged in
- **Profile loads as empty**: Check Supabase SQL editor: `SELECT * FROM athlete_profiles WHERE user_id = auth.uid();`

### Logs & Debugging
- Enable debug mode: Add `?debug=1` to URL
- Check observability logs in browser console (F12)
- Review Supabase logs: Dashboard → Logs → API Logs
- Check network tab for failed requests

## Sign-Off

Once all items above are ✅ checked, the implementation is verified and ready for production use.

**Tester Name**: _______________  
**Date**: _______________  
**Environment**: ☐ Local ☐ Staging ☐ Production  
**Status**: ☐ Pass ☐ Fail (see notes below)

**Notes**:
