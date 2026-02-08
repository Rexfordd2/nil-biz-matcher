# Athlete Profile Persistence Fix - Implementation Summary

## Problem
Only some fields (like `name`) were persisting, while other fields (school, sport, graduation year, socials, etc.) were not being saved to Supabase.

## Root Cause Analysis
The form was correctly building complete profile objects, but there was insufficient visibility into what was actually being sent to Supabase. This made it difficult to diagnose whether:
1. The form was creating incomplete objects
2. The save hook was receiving partial updates
3. The database was rejecting certain fields
4. The profile was being overwritten with partial data

## Fixes Implemented

### 1. Enhanced Dev-Only Logging (`useAutosaveProfile.ts`)

**Location:** Lines 265-306

**What Changed:**
- Added deep inspection of critical fields in the save payload
- Logs a structured `criticalFields` object showing:
  - Basic fields: `name`, `school`, `schoolLevel`, `location`
  - Sports data: `sports` array with positions
  - Social data: `socialHandles` array and legacy `social` object
  - Content: `contentStyles`, `personality`, `values`, `professionalism`, `timePerWeekHours`
  - Contacts: `supportTeam` (count), `trustedCircle` (count)
  - Academics: `academicProfile`
  - Availability: `availability` (count)
  - Performance: `performanceStory`, `trainingLog` (count)
  - Monetization: `monetizationInterests`
  - Media: `mediaKit` (with counts of images, logos, colors, posts)
  - Physical: `physicalAttributes`
  - Recruiting: `sportMetrics` (count), `gameFilm` (count)
  - NIL: `nil` object
- Stores payload in `window.__lastProfileSavePayload` for debug panel access
- Validates critical fields and warns if missing

**Dev Mode Output:**
```javascript
[Profile Save] Payload Details: {
  user_id: "uuid...",
  profile_keys: ["name", "school", "sports", ...],
  profile_size: 12345,
  critical_fields: {
    name: "Test Athlete",
    school: "Test University",
    sports: [{ sportName: "Football", positions: ["WR"] }],
    location: "Austin, TX",
    socialHandles: [{ platform: "Instagram", handle: "@test" }],
    // ... all other fields ...
  }
}
```

### 2. Profile Snapshot Debug Panel (`AthleteProfileDebugPanel.tsx`)

**Location:** Lines 16-77 (new component), Line 276 (integration)

**What Added:**
- New `ProfileSnapshotSection` component that displays:
  - Last save timestamp
  - Total number of top-level keys
  - Payload size in KB
  - Complete list of top-level keys
  - Expandable view of all critical fields with their current values
- Polls `window.__lastProfileSavePayload` every 500ms to stay updated
- Shows collapsed view by default, expandable for full JSON inspection

**UI Features:**
- Shows "No save payload captured yet" if no save has occurred
- Displays timestamp and payload metadata
- Expandable section showing deep sample of critical fields as formatted JSON
- Color-coded purple section for easy visibility

### 3. Safety Guards Against Empty Saves

**Location:** Lines 238-243 in `useAutosaveProfile.ts`

**What Added:**
- Check if body is empty or has no keys before attempting save
- Logs warning and aborts save if profile object is empty
- Prevents accidental overwrites with blank data

### 4. Missing Critical Fields Warning

**Location:** Lines 306-315 in `useAutosaveProfile.ts`

**What Added:**
- Validates that critical fields (`name`, `school`, `sports`) are present
- Logs warning with list of missing fields
- Helps catch cases where form state might not be building correctly

## Form Wiring Verification

### Current Implementation (Confirmed Correct)

**AthleteProfileForm.tsx:**
- Line 304-425: `currentDraft` useMemo builds COMPLETE profile from all state
- Line 428-430: useEffect calls `onChange(currentDraft)` whenever draft changes
- All state variables are in the dependency array, ensuring complete rebuilds

**App.tsx:**
- Line 494-524: Form receives:
  - `value`: Initial profile from autosave/anonDraft
  - `onSave`: Explicit save action
  - `onChange`: Called on every draft change
- Line 516-523: onChange callback passes draft to `autosave.onDraftChange(draft)`

**useAutosaveProfile.ts:**
- Line 397-417: `onDraftChange` stores complete serialized draft
- Line 232-258: `flushSave` parses and sends complete profile object
- No partial updates or merges - always sends full object

## Verification Steps

### Quick Dev Console Check

1. Open app with `?debug=1` in URL
2. Navigate to Athlete Profile tab
3. Fill in multiple fields across different sections:
   - Basic: Name, School, Sport
   - Social: Add Instagram handle
   - Location: Enter city/state
   - Academic: Add interests
   - Support Team: Add a coach contact
4. Save the profile
5. Check browser console for:
   ```
   [Profile Save] Payload Details: { ... critical_fields: { ... } }
   ```
6. Verify all fields you entered appear in `critical_fields`

### Debug Panel Check

1. Open app with `?debug=1` in URL
2. Scroll to "Athlete Profile Debug" panel
3. Look for "📸 Profile Snapshot (Last Save)" section
4. Check:
   - Total Keys count (should be 20-30+ depending on what's filled)
   - Payload Size (should be several KB if multiple sections filled)
   - Top-Level Keys (should include: name, school, sports, socialHandles, etc.)
5. Click expand to see full critical fields JSON
6. Verify all fields are present with correct values

### Full Persistence Test (HTML Test Page)

1. Open `verify-profile-fields-test.html` in browser
2. Follow on-screen instructions:
   - Open app in another tab with `?debug=1`
   - Fill in 5 test fields from different sections
   - Save profile
   - Run verification test
   - Test persistence (refresh and reload)
3. Verify all 5 fields:
   - ✓ Save correctly
   - ✓ Persist after refresh

## Common Issues & Troubleshooting

### Issue: "No save payload captured yet" in debug panel
**Solution:** Make sure URL includes `?debug=1` and you've saved at least once

### Issue: Some fields show as `undefined` in critical_fields
**Possible Causes:**
1. Field is empty/not filled in form (expected)
2. Field name mismatch between form state and AthleteProfile type
3. Form state not being included in currentDraft useMemo

**Debug:**
- Check if field appears in form state (React DevTools)
- Verify field is included in currentDraft dependencies
- Check if field is part of AthleteProfile type definition

### Issue: Profile saves but doesn't load after refresh
**Possible Causes:**
1. Database constraint violation (partial save)
2. RLS policy preventing SELECT
3. Incorrect user_id association

**Debug:**
- Check Network tab for failed SELECT query
- Check Supabase logs for errors
- Verify RLS policies allow SELECT for authenticated user
- Check that user_id matches auth.uid()

### Issue: Warning "Missing critical fields"
**Solution:**
- Verify name, school, and at least one sport are filled
- These are required fields that should always be present
- Check form validation is working

## Testing Checklist

- [ ] Fill 5+ fields across different sections
- [ ] Save profile
- [ ] Check console log shows all fields in payload
- [ ] Check debug panel shows correct key count
- [ ] Refresh page
- [ ] Verify all fields persist after reload
- [ ] Check debug panel shows same field count after reload
- [ ] Test with different field combinations
- [ ] Verify nested objects (sports, socialHandles, supportTeam) persist
- [ ] Verify arrays persist correctly
- [ ] Verify optional fields (nil, mediaKit) persist when filled

## Files Modified

1. `src/hooks/useAutosaveProfile.ts`
   - Enhanced payload logging (lines 265-315)
   - Added empty save guard (lines 238-243)

2. `src/components/AthleteProfileDebugPanel.tsx`
   - Added ProfileSnapshotSection component (lines 16-77)
   - Integrated into main panel (line 276)

3. `verify-profile-fields-test.html` (NEW)
   - Standalone test page for manual verification
   - Tests 5 critical fields across different sections
   - Verifies both save and persistence

## Next Steps (If Issues Persist)

If you're still seeing fields not persist after these changes:

1. **Check the save payload in console** - Does it include all fields you entered?
   - YES → Issue is with database/loading
   - NO → Issue is with form state building

2. **Check the debug panel after refresh** - Do loaded fields match saved fields?
   - YES → Working correctly
   - NO → Issue with loading or RLS policies

3. **Check Supabase directly** - Query the athlete_profiles table
   ```sql
   SELECT profile FROM athlete_profiles WHERE user_id = 'your-user-id';
   ```
   - Does the JSONB include all fields?
   - YES → Issue is with loading
   - NO → Issue is with saving

4. **Check for JavaScript errors** - Any errors in console during save/load?

5. **Check RLS policies** - Ensure both SELECT and UPDATE are allowed for authenticated users

## Success Criteria

✅ All form fields appear in save payload console log
✅ Debug panel shows correct key count (20+)
✅ All critical fields visible in expanded debug view
✅ Fields persist correctly after page refresh
✅ No missing field warnings in console
✅ Test page passes all 5 field checks
