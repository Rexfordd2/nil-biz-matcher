# Recruiting Explore Map Stale Results Fix

## Root Cause Analysis

The Recruiting Explore Map component (`src/components/Recruiting.tsx:109-563`) had race condition vulnerabilities during rapid user interactions:

### Issues Identified:

1. **Token-based cancellation only** (`Recruiting.tsx:124,197,241,249,254`)
   - Used `searchTokenRef` to track request versions
   - No AbortController to actually cancel in-flight Google Places API calls
   - Google Places API calls could not be cancelled mid-flight

2. **No request version guard consistency**
   - Token checks existed but were not comprehensive
   - State updates could still occur from stale requests if timing was unlucky

3. **No last-known-good fallback**
   - On errors, results were cleared entirely
   - No graceful degradation to show previous valid results

4. **Missing Observability**
   - No requestId tracking for debugging
   - No structured logging for errors

5. **Filter changes didn't trigger searches**
   - Changes to sport/level/orgType filters didn't automatically trigger new searches
   - Users had to manually refresh

## Fix Implementation

### 1. AbortController + Request Version Guard (`Recruiting.tsx:196-318`)

**Changes:**
- Added `abortControllerRef` to track and cancel in-flight requests
- Each `runPlacesSearch` call creates a new AbortController and cancels any previous one
- Combined token-based versioning with AbortController for dual protection
- AbortController passed to Google Places API callback checks

**Key Lines:**
- `Recruiting.tsx:125` - Added `abortControllerRef` ref
- `Recruiting.tsx:197-200` - Cancel previous request, create new controller
- `Recruiting.tsx:201-202` - Check abort signal after async operations
- `Recruiting.tsx:240-241` - Check abort signal in Places API callback
- `Recruiting.tsx:260` - Check abort signal before processing results
- `Recruiting.tsx:273-276` - Cleanup on unmount

### 2. Last-Known-Good Fallback (`Recruiting.tsx:120,275,290-300`)

**Changes:**
- Added `lastGoodPlaces` state to store last successful results
- On success, update both `places` and `lastGoodPlaces`
- On error, show `lastGoodPlaces` if available instead of clearing results
- Added `isStale` state to track when showing stale results

**Key Lines:**
- `Recruiting.tsx:120` - Added `lastGoodPlaces` and `isStale` state
- `Recruiting.tsx:275` - Save successful results to `lastGoodPlaces`
- `Recruiting.tsx:290-300` - Error handling with fallback to last good

### 3. Stale Results Banner UI (`Recruiting.tsx:417-424`)

**Changes:**
- Added visual indicator when showing stale results
- Amber warning color for stale state
- Clear messaging: "Showing last known good results"

**Key Lines:**
- `Recruiting.tsx:417-424` - Stale banner UI rendering

### 4. Filter Change Handlers (`Recruiting.tsx:280-288`)

**Changes:**
- Added `useEffect` hook to trigger search when filters change
- Automatically searches when sport, sportOther, level, orgType, or searchThisArea changes
- Properly cancels previous requests before starting new ones

**Key Lines:**
- `Recruiting.tsx:280-288` - Filter change effect hook

### 5. Observability Integration (`Recruiting.tsx:17,203-210,276-283,310-318`)

**Changes:**
- Added Observability import
- Log start, success, and error events with requestId
- Include metadata: center, zoom, filters
- Track error details for debugging

**Key Lines:**
- `Recruiting.tsx:17` - Import Observability
- `Recruiting.tsx:203-210` - Start logging
- `Recruiting.tsx:276-283` - Success logging
- `Recruiting.tsx:310-318` - Error logging

### 6. Loading State Improvements (`Recruiting.tsx:199,254-257,301-303`)

**Changes:**
- Loading state only cleared if request is still latest
- Proper state management prevents race conditions
- Clear error state on new search start

**Key Lines:**
- `Recruiting.tsx:199` - Set loading and clear error at start
- `Recruiting.tsx:254-257` - Conditional loading clear
- `Recruiting.tsx:301-303` - Conditional loading clear in error handler

## Stress Test Implementation

### Explore Map Test (`src/pages/DebugDiscoverRecruiting.tsx`)

**Added:**
- New target type: `'explore_map'`
- Simulates rapid map pan/zoom and filter changes
- Tests 50 sequential requests, then 20 concurrent bursts
- Reports inconsistency rate (hash instability) and failure rate

**Key Features:**
- `randomExploreMapParams()` - Generates random center, zoom, and filter combinations
- `hashResults()` - Creates hash of results to detect inconsistencies
- Result hash tracking in `RunResult` type
- Inconsistency rate calculation in summary
- Hash column in results table

**Key Lines:**
- `DebugDiscoverRecruiting.tsx:6` - Added `'explore_map'` to Target type
- `DebugDiscoverRecruiting.tsx:42-58` - Random params and hash functions
- `DebugDiscoverRecruiting.tsx:79-130` - Explore map test implementation
- `DebugDiscoverRecruiting.tsx:179-193` - Inconsistency rate calculation
- `DebugDiscoverRecruiting.tsx:233-241` - Summary display with inconsistency rate

## File References

### Modified Files:
1. `src/components/Recruiting.tsx`
   - Lines 17: Added Observability import
   - Lines 120: Added `lastGoodPlaces` and `isStale` state
   - Lines 125: Added `abortControllerRef`
   - Lines 196-318: Complete rewrite of `runPlacesSearch` with AbortController and version guard
   - Lines 280-288: Filter change effect hook
   - Lines 417-424: Stale results banner UI

2. `src/pages/DebugDiscoverRecruiting.tsx`
   - Lines 6: Added `'explore_map'` target type
   - Lines 8-16: Added `resultHash` to RunResult
   - Lines 42-58: Added random params and hash functions
   - Lines 63-108: Enhanced `runOnce` with explore_map support
   - Lines 179-193: Added inconsistency rate calculation
   - Lines 200-210: Added explore_map option to dropdown
   - Lines 231-242: Enhanced summary with inconsistency rate
   - Lines 244-267: Enhanced results table with hash column

## Testing Instructions

1. **Manual Testing:**
   - Navigate to Recruiting > Explore tab
   - Rapidly pan/zoom the map
   - Change filters quickly (sport, level, orgType)
   - Verify no stale results appear
   - Verify loading states work correctly
   - Verify stale banner appears on errors with fallback

2. **Stress Test:**
   - Navigate to `/debug/discover-recruiting`
   - Select "Explore Map (Places API)" from dropdown
   - Run "Run 50 sequential" - verify inconsistencyRate and failureRate
   - Run "Run 20 concurrent" - verify inconsistencyRate and failureRate
   - Check console for hash values and requestIds
   - Verify inconsistencyRate is low (< 5% expected)

## Expected Outcomes

- **No stale results** during rapid map interactions
- **Proper cancellation** of in-flight requests
- **Graceful degradation** with last-known-good fallback
- **Clear UI feedback** with loading states and stale banners
- **Observability** via requestId tracking and structured logs
- **Stress test** reports inconsistencyRate < 5% and failureRate < 2%

## Deliverable Summary

✅ Root cause identified and documented
✅ AbortController + request version guard implemented
✅ Last-known-good fallback with stale banner UI
✅ Filter change handlers added
✅ Observability integration complete
✅ Stress test harness added to debug page
✅ All file/line references documented
