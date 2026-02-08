# Profile Save Guards - Testing Guide

## Quick Verification Checklist

### ✅ 1. Verify Deep Merge Works

**Test**: Edit a single field after loading a complete profile

```
1. Load profile with 10+ fields filled
2. Edit only the "name" field
3. Check browser console for:
   - No "[Profile Save] Detected partial update" message (should NOT trigger merge)
4. Save and reload
5. Verify all other fields are intact
```

**Expected**: All fields preserved, no merge triggered (form emits complete profile)

### ✅ 2. Verify Rehydration from DB

**Test**: Refresh page after saving complete profile

```
1. Fill out complete profile (all sections)
2. Click "Save Profile"
3. Wait for "All changes saved"
4. Refresh page (F5)
5. Check browser console for:
   [Profile Load] Rehydration complete: {
     hasName: true,
     hasSchool: true,
     hasSports: true,
     ...
     totalKeys: 30+
   }
6. Verify all form fields are populated
```

**Expected**: Form displays all data from DB, no empty fields

### ✅ 3. Verify Hard Block Guard

**Test**: Manually trigger a partial save (requires dev tools)

```
1. Load profile with 10+ fields
2. Open browser console
3. Run this code to test guard:
   
   // Get the profile form component instance
   const form = document.querySelector('[data-testid="athlete-profile-form"]')
   // This requires adding data-testid to the form element first
   
4. Alternatively, modify useAutosaveProfile temporarily:
   - In flushSave, add: body = { name: body.name, school: body.school }
   - This creates a minimal 2-key payload
5. Try to save
6. Check console for:
   [Profile Save] BLOCKED: Refusing to overwrite profile with 47 keys...
7. Verify status shows error
```

**Expected**: Save blocked, error message shown, data not lost

### ✅ 4. Verify Warning Guard

**Test**: Simulate suspicious partial update

```
1. Load profile with 20+ fields
2. Temporarily modify currentDraft in AthleteProfileForm:
   - In currentDraft useMemo, add at the end:
     if (Object.keys(draft).length > 15) {
       const limited = { name, school, sports, location, socialHandles }
       return limited as AthleteProfile
     }
3. Edit a field
4. Check console for:
   [Profile Save] ⚠️ WARNING: Current profile has X keys, but server has Y keys
5. Save proceeds but warning logged
```

**Expected**: Warning logged, save allowed, data preserved via merge

### ✅ 5. Verify Empty Profile Allowed

**Test**: Create new profile from scratch

```
1. Clear all localStorage: localStorage.clear()
2. Logout and login with new account
3. Fill only required fields: name, school, one sport
4. Save
5. Check console - should NOT see blocked/warning
6. Reload, verify fields saved
```

**Expected**: Save succeeds with minimal profile, no guards triggered

## Development Console Commands

### Check Current Profile State

```js
// In browser console (Development mode)
window.__lastProfileSavePayload
```

**Shows**:
- timestamp
- keys array
- criticalFields object
- fullSize in bytes

### Force Rehydration Test

```js
// Trigger a profile reload
const refreshBtn = document.querySelector('button:contains("Refresh")')
if (refreshBtn) refreshBtn.click()
```

### Monitor Auto-save

```js
// Watch for autosave events (in Development mode)
window.addEventListener('storage', (e) => {
  if (e.key?.includes('athleteProfileDraft')) {
    console.log('Draft updated:', JSON.parse(e.newValue))
  }
})
```

## Common Issues & Solutions

### Issue: Form not rehydrating after DB load

**Symptoms**: 
- Form shows empty fields after page load
- Console shows `[Profile Load] Rehydration complete` with `hasName: true`
- But form inputs are empty

**Solution**: 
- Check `value` prop is being passed to AthleteProfileForm
- Check lastSyncedValueRef is updating
- Verify value.createdAt exists

**Debug**:
```js
// In AthleteProfileForm useEffect
console.log('Value prop:', value)
console.log('Value key:', valueKey)
console.log('Last synced:', lastSyncedValueRef.current)
```

### Issue: False positive warnings

**Symptoms**:
- Warning logged for legitimate complete profile saves
- keyCount seems too low

**Solution**:
- Check countSignificantKeys is counting nested objects
- Verify profile structure matches expected format
- May need to tune SUSPICIOUS_RATIO threshold

**Debug**:
```js
// In flushSave before guards
console.log('Full body:', body)
console.log('Key count:', countSignificantKeys(body))
console.log('Server count:', serverKeyCount)
```

### Issue: Merge not triggering when expected

**Symptoms**:
- Form emits partial update but merge doesn't happen
- Data gets lost

**Solution**:
- Check merge threshold (70%) is appropriate
- Verify previousDraft exists in latestDraftRef
- Check deep merge logic for your data structure

**Debug**:
```js
// In onDraftChange
console.log('Incoming keys:', incomingKeyCount)
console.log('Previous keys:', previousKeyCount)
console.log('Ratio:', incomingKeyCount / previousKeyCount)
console.log('Merge triggered:', incomingKeyCount < previousKeyCount * 0.7)
```

## Smoke Test Script

Run this complete test flow:

```bash
# 1. Start dev server
npm run dev

# 2. Open browser console
# 3. Login as test user
# 4. Fill complete profile:
#    - Basic info (name, school, sports)
#    - Media kit (1+ hero image)
#    - Support team (1+ contact)
#    - Academic profile
#    - Performance story
# 5. Save profile
# 6. Check console logs:
#    - Should see "[Profile Save] Payload Details"
#    - Should see profile_keys array with 15+ items
#    - Should NOT see any warnings/blocks
# 7. Refresh page (F5)
# 8. Check console logs:
#    - Should see "[Profile Load] Rehydration complete"
#    - All hasXxx fields should be true
#    - totalKeys should match what was saved
# 9. Check form:
#    - All fields should be populated
#    - Images should show
#    - Arrays should have items
# 10. Edit single field (e.g., name)
# 11. Check console - should NOT trigger merge
# 12. Save
# 13. Refresh and verify change persisted
```

## Performance Validation

### Check autosave debounce timing

```
1. Open browser performance tab
2. Type in name field continuously
3. Stop typing
4. Wait 800ms (debounceMs)
5. Should see single save request, not one per keystroke
```

### Check localStorage sync

```
1. Open Application > Local Storage in DevTools
2. Find key "athleteProfileDraft:{userId}"
3. Edit a field
4. Check localStorage updates immediately (dirty: true)
5. Wait for save to complete
6. Check localStorage updates again (dirty: false)
```

## Success Criteria

All of these should be true:

- ✅ Complete profile saves successfully
- ✅ Complete profile rehydrates on page load
- ✅ All form fields populated after reload
- ✅ Single field edit preserves other fields
- ✅ No false positive warnings for normal saves
- ✅ Hard block prevents saves with < 5 keys when server has > 10
- ✅ Warning logged when suspicious partial detected
- ✅ Deep merge activates for actual partial updates
- ✅ localStorage syncs immediately
- ✅ Auto-save debounces correctly

## Rollback Plan

If guards cause issues in production:

1. **Disable hard block** (emergency):
   ```typescript
   // In useAutosaveProfile.ts flushSave
   // Comment out the hard block section:
   /*
   if (serverKeyCount > 10 && currentKeyCount < MINIMUM_PROFILE_KEYS) {
     ...
     return
   }
   */
   ```

2. **Disable warnings** (if too noisy):
   ```typescript
   // Comment out the warning section
   /*
   if (serverKeyCount > 10 && currentKeyCount < serverKeyCount * SUSPICIOUS_RATIO) {
     ...
   }
   */
   ```

3. **Disable merge** (if causing issues):
   ```typescript
   // In onDraftChange, skip merge logic:
   let mergedDraft = draft
   // Comment out: if (previousKeyCount > 10 && ...) { ... }
   ```

4. **Revert form sync** (if rehydration causes loops):
   ```typescript
   // In AthleteProfileForm, comment out the rehydration useEffect
   ```

## Next Steps After Verification

1. ✅ Test locally with dev tools
2. ✅ Test with real user data
3. ✅ Monitor Observability logs for 24h
4. ✅ Check for any blocked saves (should be zero)
5. ✅ Check for warnings (investigate any that appear)
6. ✅ Verify no user complaints about lost data
7. ✅ If all clear, mark as stable

---

**Last Updated**: 2026-02-04  
**Tested By**: Development team  
**Status**: Ready for testing
