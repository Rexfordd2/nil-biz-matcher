# Athlete Profile Debug Mode - User Guide

## Overview

This guide explains how to use debug mode to troubleshoot athlete profile save issues. Debug mode reveals detailed error information that helps identify database, permission, or configuration problems.

**Audience:** Developers, QA testers, support staff  
**Time to complete:** 5-10 minutes  
**Prerequisites:** Access to the application, ability to log in

---

## Step 1: Enable Debug Mode

### Open the app with debug parameter

Add `?debug=1` to the end of the URL:

**Local development:**
```
http://localhost:5173/app?debug=1
```

**Staging:**
```
https://staging.your-app.com/app?debug=1
```

**Production:**
```
https://your-app.com/app?debug=1
```

**How to add the parameter:**
1. Open the app normally
2. Look at the URL bar
3. If URL is `https://your-app.com/app`, change it to `https://your-app.com/app?debug=1`
4. Press Enter to reload

**Visual confirmation:**
- You should see an amber/orange debug panel appear at the top of the page
- Panel header reads: "🔍 Athlete Profile Debug (?debug=1 only)"

---

## Step 2: Navigate to Athlete Profile Tab

1. **If not logged in:**
   - Click "Log In" button (top right)
   - Enter your credentials
   - Log in

2. **Navigate to profile:**
   - Click "Athlete Profile" in the sidebar (desktop)
   - OR click "Athlete" in the bottom navigation (mobile)

3. **Confirm debug panel is visible:**
   - Should appear just below the page header
   - Above the "Athlete Profile Builder" card
   - Amber/orange border with debug information

---

## Step 3: Trigger a Save Operation

### Option A: Edit existing field (tests autosave)

1. **Find any text field** (e.g., Name, School, Location)
2. **Make a small change** (add a letter, change a word)
3. **Wait 1-2 seconds** without clicking anything
4. **Watch the debug panel:**
   - "Current Status" should change to "● saving" (yellow pulsing dot)
   - Then change to "● saved" (green dot) or "● error" (red dot)
   - "Last Save Attempt" timestamp should update

### Option B: Click Save button (tests explicit save)

1. **Make any change** to the form (edit name, add a sport, etc.)
2. **Scroll to bottom** of the form
3. **Click the "Save Profile" button** (red button with glow effect)
4. **Watch for:**
   - Toast notification at bottom of screen
   - Debug panel status update
   - Timestamp changes

### Option C: Fill out new profile (tests INSERT)

1. **If form is empty**, fill in minimum required fields:
   - **Name:** Enter full name
   - **School:** Enter school name
   - **Sports & Positions:** Click "Add Sport"
     - Enter sport name (e.g., "Football")
     - Enter position (e.g., "QB")
2. **Click "Save Profile" button**
3. **Check debug panel** for results

---

## Step 4: Read Error Details (If Save Failed)

### Where to find error information

If the save failed, error details appear in **3 locations**:

#### Location 1: Debug Panel (Primary)

**Look for the expandable section:**
- Header: "🔍 Athlete Profile Debug"
- Click to expand if collapsed (▶ → ▼)

**Error information shown:**

1. **Error Message** (friendly):
   ```
   Error Message
   Permission denied (RLS). Please ensure you are logged in.
   ```

2. **Raw Supabase Error Details** (detailed):
   ```
   Raw Supabase Error Details
   
   Timestamp: 2/3/2026, 3:45:30 PM
   
   User ID: 550e8400-e29b-41d4-a716-446655440000
   
   Error Code: 42501
   
   HTTP Status: 403
   
   Message: new row violates row-level security policy for table "athlete_profiles"
   
   Details: Failing row contains (550e8400-e29b-41d4-a716-446655440000, {...}, ...)
   
   Hint: (empty)
   
   Payload Keys: name, school, sports, socialHandles, contentStyles, personality
   ```

#### Location 2: Toast Notification (Brief)

**Appears at bottom of screen:**
```
Save failed: Permission denied (RLS). Please ensure you are logged in.
```

**Duration:** ~5 seconds before fading out

#### Location 3: Browser Console (Technical)

**For developers:**

1. Press F12 (Windows/Linux) or Cmd+Option+I (Mac)
2. Click "Console" tab
3. Look for red error messages:
   ```javascript
   [Profile Save Error] {
     timestamp: "2026-02-03T15:45:30.123Z",
     userId: "550e8400-e29b-41d4-a716-446655440000",
     payloadKeys: ["name", "school", "sports"],
     error: {
       code: "42501",
       status: 403,
       message: "new row violates row-level security policy",
       details: "...",
       hint: ""
     }
   }
   ```

---

## Step 5: Screenshot Checklist

### What to capture for bug reports

When reporting a save failure, capture these screenshots:

#### Screenshot 1: Full Debug Panel (Expanded)
- [ ] Expand the "🔍 Athlete Profile Debug" panel (click header)
- [ ] Capture entire panel including:
  - Current User ID
  - User Email
  - Profile Fetch Status
  - Current Status
  - Last Save Attempt timestamp
  - Last Successful Save timestamp
  - Error Message (if shown)
  - Raw Supabase Error Details (if shown)
- [ ] **How to capture:**
  - Windows: Win+Shift+S or Snipping Tool
  - Mac: Cmd+Shift+4
  - Include the amber/orange border

#### Screenshot 2: Toast Notification
- [ ] Capture the error toast at bottom of screen
- [ ] Must capture while toast is visible (~5 seconds)
- [ ] Shows the user-facing error message

#### Screenshot 3: Browser Console (For Developers)
- [ ] Press F12 to open DevTools
- [ ] Click "Console" tab
- [ ] Capture any red error messages
- [ ] Include timestamp and full error object

#### Screenshot 4: Network Tab (Advanced)
- [ ] Press F12 to open DevTools
- [ ] Click "Network" tab
- [ ] Filter by "Fetch/XHR"
- [ ] Find the request to `athlete_profiles`
- [ ] Click on the request
- [ ] Capture:
  - Request Headers (shows auth token)
  - Request Payload (shows data being sent)
  - Response (shows server error)

#### Screenshot 5: Supabase Table Editor (If Accessible)
- [ ] Open Supabase Dashboard
- [ ] Go to Table Editor
- [ ] Select `athlete_profiles` table
- [ ] Filter by your user_id
- [ ] Capture the row (or lack of row)

---

## Step 6: Interpret the Error Code

### Common error codes and meanings

| Code | Meaning | What to Check |
|------|---------|---------------|
| `42P01` | Table doesn't exist | Run verification queries, check if migrations applied |
| `42501` | Permission denied (RLS) | Check RLS policies, verify user is authenticated |
| `23503` | Foreign key violation | User doesn't exist in auth.users table |
| `23505` | Unique constraint violation | Shouldn't happen with user_id PK |
| `PGRST301` | JWT invalid/expired | Re-authenticate (log out and log in) |
| `PGRST302` | RLS policy violation | Check policy predicates match column names |
| `22P02` | Invalid JSON | Profile data is malformed |
| `null` | Network/connection error | Check internet, Supabase status |

### Error code location in debug panel

Look for the line that says:
```
Error Code: 42501
```

This is the most important piece of information for troubleshooting.

---

## Step 7: Document Findings

### Information to collect

When reporting an issue, include:

1. **Error code** (from debug panel)
2. **Full error message** (from debug panel)
3. **User ID** (from debug panel)
4. **Payload keys** (from debug panel)
5. **Timestamp** (from debug panel)
6. **Profile fetch status** (✓ or ✗)
7. **Last successful save** (if any)
8. **Screenshots** (from checklist above)

### Template for bug report

```
ATHLETE PROFILE SAVE FAILURE

Environment: [Production / Staging / Local]
URL: https://your-app.com/app?debug=1
User: test@example.com
User ID: 550e8400-e29b-41d4-a716-446655440000

ERROR DETAILS:
- Error Code: 42501
- Status: 403
- Message: new row violates row-level security policy
- Details: Failing row contains (...)
- Hint: (none)

CONTEXT:
- Profile Fetch Status: ✓ Profile fetched from database
- Last Save Attempt: 2/3/2026, 3:45:30 PM
- Last Successful Save: 2/3/2026, 3:42:15 PM (195 seconds ago)
- Payload Keys: name, school, sports, socialHandles, contentStyles

REPRODUCTION STEPS:
1. Logged in as test@example.com
2. Navigated to Athlete Profile tab
3. Changed name from "John" to "Johnny"
4. Waited for autosave
5. Save failed with error above

SCREENSHOTS:
- Screenshot 1: Debug panel (attached)
- Screenshot 2: Toast notification (attached)
- Screenshot 3: Browser console (attached)
```

---

## Troubleshooting Quick Reference

### Issue: Debug panel not showing

**Possible causes:**
- URL doesn't have `?debug=1` parameter
- On wrong tab (must be "Athlete Profile" tab)
- Panel is collapsed (click header to expand)

**Solution:**
1. Verify URL has `?debug=1`
2. Navigate to "Athlete Profile" tab
3. Click the amber panel header to expand

---

### Issue: "Profile Fetch Status: ✗ Profile not fetched yet"

**Meaning:** Failed to load existing profile from database

**Possible causes:**
- Table doesn't exist
- RLS blocks SELECT
- User not authenticated
- Network error

**Next steps:**
1. Check if there's an error in the debug panel
2. Look for error code (42P01 = table missing, 42501 = RLS)
3. Run `npm run diag:profile` to test database
4. Check Supabase connection

---

### Issue: "Current Status: ● error" but no error details shown

**Possible causes:**
- Error occurred during load (not save)
- Error was cleared by successful retry
- JavaScript exception (not Supabase error)

**Next steps:**
1. Check browser console for errors
2. Try clicking "Force reload from Supabase" (in global debug header)
3. Log out and log back in
4. Check network tab for failed requests

---

### Issue: Saves succeed in debug mode but fail in normal mode

**This shouldn't happen** - debug mode only displays information, doesn't change behavior.

**Possible causes:**
- Caching issue
- Different user logged in
- Network intermittent

**Next steps:**
1. Clear browser cache
2. Try in incognito/private window
3. Verify same user in both modes
4. Check if error is intermittent

---

## Debug Panel Field Reference

### Current User ID
```
550e8400-e29b-41d4-a716-446655440000
```
- This is your unique user identifier
- Must match the `user_id` in `athlete_profiles` table
- Used in all RLS policy checks (`auth.uid()`)

### User Email
```
test@example.com
```
- Email address you logged in with
- Confirms which account you're using

### Profile Fetch Status
```
✓ Profile fetched from database
```
- Green ✓ = Successfully loaded profile from Supabase
- Red ✗ = Failed to load (check for errors)

### Current Status
```
● saved (green dot)
```
- **idle** (gray) = No save in progress
- **saving** (yellow, pulsing) = Save in progress
- **saved** (green) = Last save succeeded
- **error** (red) = Last save failed
- **loading** (blue, pulsing) = Loading profile from database

### Last Save Attempt
```
2/3/2026, 3:45:30 PM
```
- Timestamp when last save was attempted
- Updates every time you try to save (even if fails)
- Helps track if autosave is triggering

### Last Successful Save
```
2/3/2026, 3:45:30 PM (5s ago)
```
- Timestamp of last successful save to database
- Only updates when save actually succeeds
- Shows "X seconds ago" for quick reference

### Error Code
```
42501
```
- PostgreSQL error code
- Most important for troubleshooting
- See "Common Error Codes" table above

### HTTP Status
```
403
```
- HTTP response status from Supabase API
- 403 = Forbidden (usually RLS)
- 404 = Not Found (usually table missing)
- 500 = Server error

### Message
```
new row violates row-level security policy for table "athlete_profiles"
```
- Full error message from Supabase/PostgreSQL
- Most descriptive information about what went wrong

### Details
```
Failing row contains (550e8400-e29b-41d4-a716-446655440000, {...}, ...)
```
- Additional context from database
- May show the actual data that failed
- Sometimes empty

### Hint
```
(empty)
```
- PostgreSQL hint for fixing the issue
- Often empty for RLS errors
- When present, usually very helpful

### Payload Keys
```
name, school, sports, socialHandles, contentStyles, personality
```
- Top-level keys of the profile object being saved
- Helps identify what data was being sent
- Does NOT show actual values (privacy)

---

## Screenshot Checklist

### Before reporting an issue, capture these screenshots:

#### Required Screenshots

- [ ] **Screenshot 1: Debug panel with error**
  - URL must show `?debug=1`
  - Debug panel must be expanded (▼)
  - Include full "Raw Supabase Error Details" section
  - Make sure text is readable (zoom in if needed)

- [ ] **Screenshot 2: Full page context**
  - Show the entire Athlete Profile page
  - Include the form with data you tried to save
  - Include the debug panel
  - Include URL bar (showing `?debug=1`)

- [ ] **Screenshot 3: Browser console**
  - Press F12
  - Click "Console" tab
  - Show any red error messages
  - Show the `[Profile Save Error]` log entry (if present)

#### Optional Screenshots (for deeper investigation)

- [ ] **Screenshot 4: Network tab**
  - Press F12
  - Click "Network" tab
  - Filter by "Fetch/XHR"
  - Find request to `athlete_profiles`
  - Show request payload and response

- [ ] **Screenshot 5: Application tab (localStorage)**
  - Press F12
  - Click "Application" tab (Chrome) or "Storage" tab (Firefox)
  - Expand "Local Storage"
  - Find key starting with `athleteProfileDraft:`
  - Show the stored value

- [ ] **Screenshot 6: Supabase dashboard (if accessible)**
  - Open Supabase Dashboard
  - Navigate to Table Editor
  - Select `athlete_profiles` table
  - Show your row (or lack of row)

### Screenshot Best Practices

**Resolution:**
- Use full-screen capture or large window
- Ensure text is readable at 100% zoom
- Don't crop important information

**Format:**
- PNG or JPG (not BMP)
- Keep file size reasonable (< 5MB)

**Annotation:**
- Use arrows/boxes to highlight specific errors
- Add text labels to important sections
- Don't obscure critical information

**Privacy:**
- Redact sensitive personal information if needed
- User IDs are OK to share (needed for debugging)
- Email addresses are OK if test accounts

---

## Example Debug Panel States

### Success State (All Working)

```
🔍 Athlete Profile Debug (?debug=1 only)     ▼

Current User ID: 550e8400-e29b-41d4-a716-446655440000
User Email: test@example.com

Profile Fetch Status: ✓ Profile fetched from database

Current Status: ● saved

Last Save Attempt: 2/3/2026, 3:45:30 PM

Last Successful Save: 2/3/2026, 3:45:30 PM (5s ago)

✓ All Systems Operational
Profile is fetched and saves are working correctly.
```

**What this means:**
- Everything is working correctly
- Profile loaded successfully
- Last save succeeded
- No errors

---

### Error State (RLS Permission Denied)

```
🔍 Athlete Profile Debug (?debug=1 only)     ▼

Current User ID: 550e8400-e29b-41d4-a716-446655440000
User Email: test@example.com

Profile Fetch Status: ✓ Profile fetched from database

Current Status: ● error

Last Save Attempt: 2/3/2026, 3:45:30 PM

Last Successful Save: 2/3/2026, 3:42:15 PM (195s ago)

Error Message
Permission denied (RLS). Please ensure you are logged in.

Raw Supabase Error Details
  Timestamp: 2/3/2026, 3:45:30 PM
  User ID: 550e8400-e29b-41d4-a716-446655440000
  Error Code: 42501
  HTTP Status: 403
  Message: new row violates row-level security policy
  Details: Failing row contains (...)
  Hint: (empty)
  Payload Keys: name, school, sports
```

**What this means:**
- Profile loaded OK initially
- Save is failing
- Error code 42501 = RLS (Row Level Security) blocking the save
- Need to check/fix RLS policies in Supabase

**Fix:** Run `SUPABASE_FIX_ATHLETE_PROFILES.sql` in Supabase SQL Editor

---

### Error State (Table Doesn't Exist)

```
🔍 Athlete Profile Debug (?debug=1 only)     ▼

Current User ID: 550e8400-e29b-41d4-a716-446655440000
User Email: test@example.com

Profile Fetch Status: ✗ Profile not fetched yet

Current Status: ● error

Last Save Attempt: (none)

Last Successful Save: (none)

Error Message
status=404 | code=42P01 | message=relation "athlete_profiles" does not exist

Raw Supabase Error Details
  Timestamp: 2/3/2026, 3:45:30 PM
  User ID: 550e8400-e29b-41d4-a716-446655440000
  Error Code: 42P01
  HTTP Status: 404
  Message: relation "athlete_profiles" does not exist
```

**What this means:**
- The `athlete_profiles` table doesn't exist in Supabase
- Profile cannot load or save
- Need to create the table

**Fix:** Run `SUPABASE_FIX_ATHLETE_PROFILES.sql` in Supabase SQL Editor

---

### Saving State (In Progress)

```
🔍 Athlete Profile Debug (?debug=1 only)     ▼

Current User ID: 550e8400-e29b-41d4-a716-446655440000
User Email: test@example.com

Profile Fetch Status: ✓ Profile fetched from database

Current Status: ● saving (yellow, pulsing)

Last Save Attempt: 2/3/2026, 3:45:28 PM

Last Successful Save: 2/3/2026, 3:42:15 PM (193s ago)
```

**What this means:**
- Save is currently in progress
- Should complete in < 1 second normally
- If stuck in "saving" for > 5 seconds, may indicate network issue

---

## Frequently Asked Questions

### Q: What if I don't see the debug panel?

**A:** Verify these:
1. URL has `?debug=1` parameter
2. You're on the "Athlete Profile" tab (not another tab)
3. Panel may be collapsed - click the header to expand
4. Scroll to top of page (panel is just below header)

---

### Q: Can I use debug mode on production?

**A:** Yes, but:
- Use responsibly (don't leave enabled permanently)
- Only you see it (doesn't affect other users)
- Remove `?debug=1` after debugging
- Don't share screenshots with sensitive user data

---

### Q: Does debug mode slow down the app?

**A:** No:
- Debug panel only renders when visible
- No performance impact on saves
- Error tracking happens with or without debug mode
- Safe to use during testing

---

### Q: What if error details are empty?

**A:** This can happen if:
- Error is not from Supabase (JavaScript exception)
- Network error (no server response)
- Browser blocked the request

**Next steps:**
- Check browser console for JavaScript errors
- Check Network tab for failed requests
- Check internet connection

---

### Q: How do I disable debug mode?

**A:** Remove `?debug=1` from URL:
- Change `https://your-app.com/app?debug=1`
- To `https://your-app.com/app`
- Press Enter

Debug panel will disappear.

---

### Q: Can I keep debug mode on all the time?

**A:** Not recommended:
- Takes up screen space
- Shows technical details to non-technical users
- May confuse end users
- Use only when troubleshooting

**Better:** Enable only when investigating issues.

---

## Quick Troubleshooting Guide

### Save fails with error code 42501

**Issue:** RLS policy blocks save

**Steps:**
1. Verify you're logged in (check User ID in debug panel)
2. Verify User Email matches your account
3. Run: `npm run diag:profile` (local test)
4. Run: `SUPABASE_FIX_ATHLETE_PROFILES.sql` (in Supabase SQL Editor)
5. Retry save

---

### Save fails with error code 42P01

**Issue:** Table doesn't exist

**Steps:**
1. Run: `SUPABASE_VERIFICATION_QUERIES.sql` (verify table)
2. If missing: Run `SUPABASE_FIX_ATHLETE_PROFILES.sql`
3. Or apply migration: `supabase db push`
4. Retry save

---

### Save succeeds but data doesn't persist after refresh

**Issue:** Upsert succeeds but SELECT fails (RLS mismatch)

**Steps:**
1. Check debug panel after refresh
2. Look for "Profile Fetch Status: ✗"
3. Check for error code on load
4. Verify SELECT policy exists
5. Run: `SUPABASE_FIX_ATHLETE_PROFILES.sql`

---

### Autosave doesn't trigger

**Issue:** Debounce delay or no changes detected

**Steps:**
1. Make a change (edit a field)
2. Wait 2 full seconds (debounce is 800ms)
3. Watch "Last Save Attempt" timestamp
4. If doesn't update: Check "Current Status"
5. If stuck in "idle": May be no actual changes
6. Try clicking "Save Profile" button explicitly

---

## Related Documentation

- **Full diagnostic guide:** `DIAGNOSTICS_USAGE_GUIDE.md`
- **Verification guide:** `ATHLETE_PROFILE_DEPLOYMENT_VERIFICATION.md`
- **Quick reference:** `PROFILE_DIAGNOSTICS_QUICK_REF.md`
- **SQL queries:** `SUPABASE_VERIFICATION_QUERIES.sql`
- **Fix script:** `SUPABASE_FIX_ATHLETE_PROFILES.sql`

---

## Support

If debug mode doesn't help identify the issue:

1. **Run automated diagnostic:**
   ```bash
   npm run diag:profile
   ```

2. **Check Supabase logs:**
   - Open Supabase Dashboard
   - Navigate to Database → Logs
   - Filter by "athlete_profiles"
   - Look for errors around the timestamp

3. **Review RLS policies:**
   - Open Supabase Dashboard
   - Navigate to Database → Tables
   - Select `athlete_profiles`
   - Click "RLS" tab
   - Verify 4 policies exist

4. **Contact support with:**
   - Screenshots from checklist above
   - Error code and message
   - Output from `npm run diag:profile`
   - Supabase project ID (if applicable)

---

**Last Updated:** 2026-02-03  
**Version:** 1.0  
**For questions:** Check main diagnostics documentation or run `npm run diag:profile`
