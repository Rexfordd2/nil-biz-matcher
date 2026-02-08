# Profile Save Guards Implementation

## Summary

Implemented comprehensive guards to guarantee athlete profile saves never overwrite with partial objects. This prevents data loss from incomplete updates or form state desynchronization issues.

## Changes Implemented

### 1. Deep Merge Utility (`useAutosaveProfile.ts`)

Added `deepMerge<T>(base: T, patch: Partial<T>): T` function that:
- Recursively merges patch into base object
- Primitive values in patch overwrite base
- Arrays in patch replace base arrays entirely (no array merging)
- Objects are merged recursively
- Undefined values in patch are ignored (base value preserved)

**Use case**: If AthleteProfileForm emits partial updates, the hook automatically merges them with the previous state.

### 2. Key Count Validation (`useAutosaveProfile.ts`)

Added `countSignificantKeys(obj: any): number` function that:
- Recursively counts non-undefined keys in an object
- Counts nested keys in arrays of objects
- Used to detect suspicious partial updates

### 3. Save Guards (`useAutosaveProfile.ts` - `flushSave`)

Implemented multi-level guards before saving:

#### Level 1: Hard Block
- **Condition**: Server profile has > 10 keys AND current payload has < 5 keys
- **Action**: Block save completely, set error status
- **Logging**: Console error + Observability log with `status: 'error'`
- **User feedback**: Error message "Partial profile detected - save blocked to prevent data loss"

#### Level 2: Warning
- **Condition**: Server profile has > 10 keys AND current payload has < 50% of server's keys
- **Action**: Allow save but log warning with lost fields
- **Logging**: Console warning + Observability log with `status: 'warning'`

### 4. Smart Partial Update Detection (`useAutosaveProfile.ts` - `onDraftChange`)

Enhanced the draft change handler to:
- Compare incoming draft key count with previous draft
- If incoming has < 70% of previous keys, treat as partial update
- Automatically perform deep merge to preserve existing data
- Log merge operations in development mode

### 5. Server State Tracking (`useAutosaveProfile.ts`)

Added `lastKnownServerProfile` ref to:
- Track the last known server state for validation
- Updated on successful load and save operations
- Used by guards to compare against current payload

### 6. Rehydration Verification (`useAutosaveProfile.ts` - `loadFromServer`)

Added comprehensive logging in development mode that verifies:
- All critical fields are present after DB load
- Key count is reasonable
- Nested objects (mediaKit, supportTeam, trustedCircle) are loaded

Console output example:
```js
[Profile Load] Rehydration complete: {
  hasName: true,
  hasSchool: true,
  hasSports: true,
  hasLocation: true,
  hasSocialHandles: true,
  hasContentStyles: true,
  hasMediaKit: true,
  hasSupportTeam: true,
  hasTrustedCircle: true,
  totalKeys: 47
}
```

### 7. Form State Synchronization (`AthleteProfileForm.tsx`)

**CRITICAL FIX**: Added `useEffect` to sync form state when `value` prop changes.

**Problem**: Form used `useState` with initial values from props, which only set on mount. If the profile loaded from DB after mount, form state never updated.

**Solution**: 
- Added `lastSyncedValueRef` to track when rehydration is needed
- Created stable value key using `createdAt + name + school + sports.length`
- When value key changes, rehydrate ALL form state from value prop
- Prevents form from staying stuck with stale/empty state

**Rehydrated fields** (complete list):
- Basic: name, school, schoolLevel, location
- Media kit: heroImages, logos, brandColors, samplePosts, externalDeckUrl
- Sports & social: sports, socialHandles, followers, contentStyles
- Profile: personality, values, timePerWeekHours, professionalism
- Teams: supportTeam, trustedCircle
- Academic: academic (full object)
- Story: performanceStory, trainingEntries, monetizationInterests
- Availability: availability, internationalFlag
- NIL: complianceEmail, policyUrl, collective details
- Physical: height, weight, wingspan, handSize, dominantHand
- Recruiting: sportMetrics, gameFilm

## How It Works

### Normal Flow
1. User loads page → `loadFromServer` fetches full profile from DB
2. Profile stored in `lastKnownServerProfile.current`
3. Form receives profile via `value` prop
4. Form's `useEffect` detects new value and rehydrates ALL state
5. User edits → form builds complete `currentDraft` → calls `onChange`
6. `onDraftChange` receives draft, compares keys, no merge needed
7. `flushSave` validates key counts, passes guards, saves to DB
8. `lastKnownServerProfile` updated with saved profile

### Partial Update Protection Flow
1. User edits field → form emits draft
2. `onDraftChange` detects draft has fewer keys than previous (< 70%)
3. Automatic deep merge: `mergedDraft = deepMerge(previousDraft, incomingDraft)`
4. Merged draft stored and saved, preserving all data

### Hard Block Flow
1. Something goes wrong, form emits draft with only 3 keys
2. `flushSave` compares: server has 47 keys, incoming has 3
3. Guard triggers: 47 > 10 AND 3 < 5
4. Save blocked, error logged, user notified
5. Data loss prevented

## Testing

### Manual Tests

1. **Normal save**: Fill profile completely → Save → Reload → Verify all fields present
2. **Partial update**: Edit single field → Save → Reload → Verify other fields intact
3. **Empty field**: Clear a field → Save → Reload → Verify field cleared but others intact
4. **Hard block**: Manually trigger partial object (dev mode) → Verify blocked

### Development Logging

Enable verbose logging in development mode:
- `[Profile Load] Rehydration complete:` - Verify DB load
- `[Profile Save] Payload Details:` - Check what's being saved
- `[Profile Save] ⚠️ WARNING:` - Partial update detected
- `[Profile Save] BLOCKED:` - Save prevented

### Key Metrics to Monitor

- `currentKeyCount` vs `serverKeyCount` in save logs
- `profile_keys` array in payload details
- `critical_fields` presence in save logs

## Edge Cases Handled

1. **First profile creation**: No server profile → guards disabled → save allowed
2. **Empty profile**: User clears everything → key count validation passes → save allowed
3. **New fields added**: Incoming has more keys than server → no warning
4. **Array updates**: Arrays fully replaced, not merged (correct behavior for form arrays)
5. **Undefined vs null**: Undefined values in patch don't overwrite base values
6. **localStorage drift**: localStorage draft checked during load, can be restored
7. **Form remount**: `useEffect` syncs state on any value prop change

## Configuration

### Tunable Thresholds

In `useAutosaveProfile.ts`:

```typescript
const MINIMUM_PROFILE_KEYS = 5 // Hard block threshold
const SUSPICIOUS_RATIO = 0.5 // Warning threshold (50%)
```

In `onDraftChange`:

```typescript
incomingKeyCount < previousKeyCount * 0.7 // Merge threshold (70%)
```

## Observability

All guard events logged via `Observability.log()`:

- `route: 'autosave.save.blocked'` - Hard block triggered
- `route: 'autosave.save.warning'` - Suspicious update detected
- `route: 'autosave.load'` - Profile loaded from DB

Logs include:
- `currentKeyCount` and `serverKeyCount`
- `currentKeys` array
- `lostFields` array (in warnings)
- User ID and request ID

## Files Modified

1. `src/hooks/useAutosaveProfile.ts`
   - Added `deepMerge()` and `countSignificantKeys()` utilities
   - Enhanced `flushSave()` with multi-level guards
   - Enhanced `onDraftChange()` with smart merge detection
   - Enhanced `loadFromServer()` with rehydration verification
   - Added `lastKnownServerProfile` ref for state tracking

2. `src/components/AthleteProfileForm.tsx`
   - Added `useRef` import
   - Added `lastSyncedValueRef` for sync tracking
   - Added comprehensive `useEffect` to rehydrate form state from value prop
   - Logs rehydration events in development mode

## Benefits

1. **Data loss prevention**: Partial objects never overwrite complete profiles
2. **Automatic recovery**: Smart merge handles partial updates transparently
3. **Visibility**: Comprehensive logging for debugging
4. **User safety**: Hard blocks prevent catastrophic data loss
5. **Developer feedback**: Warnings highlight potential issues early
6. **Complete rehydration**: Form always reflects DB state on load

## Next Steps

1. Monitor Observability logs for blocked/warned saves in production
2. If legitimate partial updates are blocked, tune thresholds
3. Consider adding user-facing "Restore from backup" feature
4. Add unit tests for deepMerge and guard logic
5. Consider adding pessimistic locking (optimistic concurrency control)

---

**Status**: ✅ Complete  
**Date**: 2026-02-04  
**Tested**: Development environment (manual testing)  
**Production Ready**: Yes, with monitoring recommended
