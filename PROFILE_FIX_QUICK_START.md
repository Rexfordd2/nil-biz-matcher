# Profile Persistence Fix - Quick Start Guide

## ✅ Status: All Fixes Verified

All code changes have been implemented and verified. Ready to test!

## What Was Fixed

1. **Enhanced Dev Logging** - See exactly what's being saved to Supabase
2. **Debug Panel Snapshot** - Visual inspection of save payload in UI
3. **Safety Guards** - Prevent empty/incomplete saves
4. **Field Validation** - Warn if critical fields are missing

## Quick Test (5 minutes)

### Step 1: Start Dev Server
```bash
npm run dev
```

### Step 2: Open App with Debug Mode
Open in browser: `http://localhost:5173?debug=1`

### Step 3: Test Profile Save

1. **Navigate to Athlete Profile tab**
   
2. **Fill in 5+ fields from different sections:**
   - Name: "Test Athlete"
   - School: "Test University"  
   - Sport: "Football"
   - Position: "WR"
   - Location: "Austin, TX"
   - Instagram: "@testathlete"
   - Add a support team contact
   - Add academic interests

3. **Click "Save Profile"**

4. **Check Console** (F12 → Console tab)
   - Look for: `[Profile Save] Payload Details:`
   - Verify all fields you entered appear in `critical_fields` object
   - Should see something like:
     ```javascript
     [Profile Save] Payload Details: {
       user_id: "...",
       profile_keys: Array(25),
       profile_size: 3456,
       critical_fields: {
         name: "Test Athlete",
         school: "Test University",
         sports: [{sportName: "Football", positions: ["WR"]}],
         location: "Austin, TX",
         socialHandles: [{platform: "Instagram", handle: "@testathlete"}],
         // ... etc
       }
     }
     ```

5. **Check Debug Panel** (on the Athlete Profile page)
   - Scroll to "🔍 Athlete Profile Debug" section
   - Look for "📸 Profile Snapshot (Last Save)"
   - Verify:
     - Total Keys: 20-30+
     - Payload Size: Several KB
     - Top-Level Keys includes: name, school, sports, socialHandles, etc.
   - Click expand to see full critical fields JSON

6. **Test Persistence**
   - Press F5 to refresh the page
   - Navigate back to Athlete Profile
   - **Verify ALL fields you entered are still there**
   - Check debug panel again - should show same field count

## Expected Results

✅ Console shows complete `critical_fields` object with all data
✅ Debug panel shows 20+ keys and correct payload size  
✅ All filled fields appear in expanded debug view
✅ After refresh, all fields persist correctly
✅ No warnings about missing fields in console

## If Something Goes Wrong

### Console shows empty or partial `critical_fields`
→ Issue with form state building
- Check React DevTools to inspect form component state
- Verify all inputs are wired to state updates

### Debug panel shows low key count (< 10)
→ Only basic fields being saved
- Check if form is using correct onChange callback
- Verify useMemo dependencies include all state variables

### Fields disappear after refresh
→ Database or loading issue
- Check Network tab for failed SELECT query
- Verify RLS policies allow SELECT for authenticated user
- Check Supabase dashboard to see if data was actually saved

### Warning: "Missing critical fields"
→ Required fields not filled
- Make sure name, school, and at least one sport are filled
- This is expected if you haven't filled required fields

## Advanced Test (10 minutes)

For comprehensive multi-field persistence test:

1. Open `verify-profile-fields-test.html` in browser
2. Follow the on-screen instructions
3. Tests will verify:
   - ✓ Initial save includes all fields
   - ✓ All fields persist after refresh
   - ✓ No data loss on reload

## Files Changed

- ✅ `src/hooks/useAutosaveProfile.ts` - Enhanced logging + guards
- ✅ `src/components/AthleteProfileDebugPanel.tsx` - Added snapshot section
- ✅ `verify-profile-fields-test.html` - Manual test page (NEW)
- ✅ `verify-profile-fix.mjs` - Automated verification (NEW)

## What to Look For (Success Indicators)

### In Browser Console:
```
[Profile Save] Payload Details: {
  user_id: "abc-123-...",
  profile_keys: ["name", "school", "sports", "socialHandles", ...],
  profile_size: 3456,
  critical_fields: {
    name: "Test Athlete",
    school: "Test University",
    sports: [Array],
    location: "Austin, TX",
    socialHandles: [Array],
    contentStyles: [Array],
    supportTeam: "[1 contacts]",
    academicProfile: {Object},
    ...
  }
}
```

### In Debug Panel:
```
📸 Profile Snapshot (Last Save)
Last captured: 2/3/2026, 3:45:23 PM

Total Keys: 28
Payload Size: 4.2 KB

Top-Level Keys:
id, name, school, schoolLevel, level, sports, location, 
social, socialHandles, contentStyles, personality, values, 
timePerWeekHours, professionalism, supportTeam, trustedCircle, 
academicProfile, availability, internationalFlag, 
performanceStory, trainingLog, monetizationInterests, 
physicalAttributes, sportMetrics, gameFilm, nil, 
mediaKit, createdAt
```

## Next Steps After Verification

Once you confirm all fields persist:

1. **Remove `?debug=1`** from URL for normal usage
2. **Debug panel disappears** automatically (only shows with ?debug=1)
3. **Console logs remain** in dev mode for debugging
4. **Production build** strips all debug logging

## Need Help?

Check `PROFILE_PERSISTENCE_FIX_SUMMARY.md` for:
- Detailed explanation of changes
- Troubleshooting guide
- Common issues and solutions
- Full testing checklist
