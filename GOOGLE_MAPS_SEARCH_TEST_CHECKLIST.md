# Google Maps Search - Test Checklist

## Prerequisites
- ✅ `VITE_GOOGLE_MAPS_API_KEY` configured in `.env`
- ✅ Dev server running (`npm run dev`)
- ✅ Browser console open for debug messages

## Test Suite 1: Discover Search Reliability (10/10 Success)

### Test 1.1: Basic Search
1. Navigate to Discover tab
2. Enter "pizza" in What field
3. Enter "Seattle, WA" in Where field
4. Click Search
5. **Expected:** Results appear within 3 seconds
6. **Expected:** Map shows markers
7. **Repeat 10 times** - should succeed every time

### Test 1.2: Location Autocomplete
1. Navigate to Discover tab
2. Click in Where field
3. Start typing "New Y..."
4. **Expected:** Google autocomplete dropdown appears
5. Select "New York, NY" from dropdown
6. **Expected:** Field populates with full address
7. Enter "restaurant" in What field
8. Click Search
9. **Expected:** Results shown for New York

### Test 1.3: Rapid Consecutive Searches
1. Search for "gym" in "Boston, MA"
2. Immediately search for "coffee" in "Portland, OR"
3. Immediately search for "pizza" in "Chicago, IL"
4. **Expected:** Only Chicago results shown (prior searches aborted)
5. **Expected:** No race condition errors in console

### Test 1.4: Location Input During Search
1. Start search for "pizza" in "Seattle, WA"
2. While loading spinner visible, try typing in Where field
3. **Expected:** Can type freely (not blocked)
4. Clear What field while loading
5. **Expected:** Can clear and edit (not blocked)

## Test Suite 2: Recruiting Location Filter

### Test 2.1: Location Filter Before First Search
1. Navigate to Recruiting → Explore tab
2. Enter Location: "Austin, TX"
3. Click "Apply"
4. **Expected:** Green checkmark "✓ Location set: Austin, TX"
5. Select Sport: "soccer"
6. Select Level: "college"
7. Click "Refresh results"
8. **Expected:** Results centered on Austin
9. **Expected:** Distance shown for each result
10. Check map center - should be near Austin

### Test 2.2: Location Filter After Search
1. Navigate to Recruiting → Explore tab
2. Select Sport: "basketball"
3. Click "Refresh results" (no location filter)
4. **Expected:** Results appear (centered on map view)
5. Now set Location: "Denver, CO", Radius: 50 miles
6. Click "Apply"
7. **Expected:** NEW search triggered automatically
8. **Expected:** Results now centered on Denver
9. **Expected:** Results filtered to 50-mile radius

### Test 2.3: Location Input Always Editable
1. Start a search in Recruiting Explore
2. While loading, try typing in Location input
3. **Expected:** Can type freely (not disabled)
4. Try changing Radius dropdown while loading
5. **Expected:** Can change (not disabled)
6. Try clicking Clear button while loading
7. **Expected:** Clear works (not disabled)

### Test 2.4: Radius Changes
1. Set Location: "Miami, FL", Radius: 25 miles
2. Click Apply
3. Select Sport: "football"
4. Click Refresh
5. Note number of results
6. Change Radius to 100 miles (don't clear location)
7. **Expected:** New search triggered
8. **Expected:** More results shown (wider radius)

## Test Suite 3: Error Handling & Retry

### Test 3.1: Network Offline
1. Open browser DevTools → Network tab
2. Set to "Offline" mode
3. Try any search in Discover or Recruiting
4. **Expected:** Error message appears
5. **Expected:** Retry button visible
6. Set network back to "Online"
7. Click Retry button
8. **Expected:** Search recovers and shows results

### Test 3.2: Invalid Location
1. Navigate to Discover
2. Enter "asdfghjkl12345" in Where field
3. Enter "pizza" in What field
4. Click Search
5. **Expected:** Error message about invalid location
6. Enter valid location "San Francisco, CA"
7. Click Search
8. **Expected:** Results appear (recovery works)

### Test 3.3: Debug Mode Errors
1. Ensure running in DEV mode (`npm run dev`)
2. Trigger any error (offline, invalid location, etc.)
3. **Expected:** Debug info panel appears with:
   - Full error message
   - Stale status (Yes/No)
   - Current search parameters
   - Result counts
4. Check console for detailed logs
5. **Expected:** No uncaught exceptions

### Test 3.4: Stale Results Banner
1. Perform successful search in Recruiting
2. Disconnect internet
3. Change search parameters and Refresh
4. **Expected:** Error appears
5. **Expected:** "⚠️ Showing last known good results" message
6. **Expected:** Previous results still visible
7. **Expected:** Amber/yellow warning styling
8. Reconnect internet and click Retry
9. **Expected:** New results load, warning clears

## Test Suite 4: Concurrent Component Loading

### Test 4.1: Multiple Tabs Rapid Switching
1. Navigate to Discover tab
2. Start typing in location field
3. Immediately switch to Recruiting tab
4. Start search in Recruiting
5. Switch back to Discover tab
6. Complete search in Discover
7. **Expected:** No console errors
8. **Expected:** Both tabs work independently
9. **Expected:** Only ONE Google Maps script tag in DOM

### Test 4.2: Refresh During Search
1. Start search in Discover
2. While loading, hard refresh browser (Ctrl+Shift+R)
3. After reload, navigate to Discover
4. Try new search
5. **Expected:** Works normally
6. **Expected:** No "script already loaded" errors

## Test Suite 5: Edge Cases

### Test 5.1: Empty Search Fields
1. Navigate to Discover
2. Leave What field empty
3. Enter location
4. **Expected:** Search button disabled
5. Enter What, clear Where
6. **Expected:** Search button disabled
7. Fill both fields
8. **Expected:** Search button enabled

### Test 5.2: Special Characters in Search
1. Search for "café" in "São Paulo"
2. **Expected:** Handles accents correctly
3. Search for "restaurant & bar" in "New York"
4. **Expected:** Handles ampersand correctly

### Test 5.3: Very Long Location Name
1. Enter extremely long location name (200+ characters)
2. **Expected:** Field accepts input
3. Try to geocode
4. **Expected:** Either works or shows clear error

## Test Suite 6: Performance

### Test 6.1: Load Time
1. Open browser with cache cleared
2. Navigate to Discover
3. **Expected:** Google Maps script loads in < 5 seconds
4. Check Network tab: only ONE script request
5. Navigate to Recruiting
6. **Expected:** No additional script requests

### Test 6.2: Search Response Time
1. Perform 5 different searches
2. Time each from button click to results shown
3. **Expected:** 95% under 3 seconds
4. **Expected:** None exceed 10 seconds

### Test 6.3: Memory Leaks
1. Open browser DevTools → Memory profiler
2. Take heap snapshot
3. Perform 20 searches (switch tabs, change params)
4. Force garbage collection
5. Take another heap snapshot
6. **Expected:** No significant memory growth
7. **Expected:** AbortControllers properly cleaned up

## Pass Criteria

### Critical (Must Pass 100%)
- ✅ Discover search succeeds 10/10 times
- ✅ Location inputs never blocked during search
- ✅ Recruiting location filter works BEFORE first search
- ✅ AbortController cancels prior searches
- ✅ Retry button recovers from errors

### Important (Must Pass 90%)
- ✅ Autocomplete works in all fields
- ✅ Debug errors show in DEV mode
- ✅ Stale results banner appears correctly
- ✅ No race condition errors in console
- ✅ Only one Google Maps script loads

### Nice to Have (Should Pass 80%)
- ✅ Search response under 3 seconds
- ✅ Special characters handled
- ✅ No memory leaks after 20+ searches

## Known Acceptable Behaviors

### Not Bugs:
1. Google Places API rate limiting (shows clear error with retry)
2. Autocomplete not working if API key missing (clear notice shown)
3. Slow search on poor network (loading spinner shows)
4. Empty results for obscure queries (clear "No results" message)

### Expected Errors (Handled Gracefully):
1. `OVER_QUERY_LIMIT` → Shows rate limit error with retry
2. `ZERO_RESULTS` → Shows "No results" message
3. Network offline → Shows offline error with retry
4. Invalid API key → Shows configuration error

## Regression Tests

### Verify No Breaking Changes:
1. Saved businesses (Discover) still work
2. My Targets (Recruiting) still work
3. CSV import/export still work
4. All existing UI elements still visible
5. No console warnings in production build

## Debug Console Messages (DEV Mode)

### Expected Logs:
```
[Google Maps] Loading script with libraries=places
[Google Maps] Script loaded successfully with Places API
[Discover] Failed to initialize autocomplete: [only if error]
```

### NOT Expected:
```
Uncaught TypeError: Cannot read property 'maps' of undefined
Race condition detected
Multiple script tags with ID google-maps-js
```

## Testing Tools

### Browser DevTools
- Console: Check for errors
- Network: Verify single script load
- Performance: Check response times
- Memory: Check for leaks

### Manual Verification
- Visual inspection of UI
- Test on Chrome, Firefox, Safari
- Test on mobile viewport
- Test with slow 3G throttling

## Report Template

```
Test Date: ___________
Tester: ___________
Browser: ___________
OS: ___________

Suite 1 (Discover): __ / 4 passed
Suite 2 (Recruiting): __ / 4 passed
Suite 3 (Errors): __ / 4 passed
Suite 4 (Concurrent): __ / 2 passed
Suite 5 (Edge Cases): __ / 3 passed
Suite 6 (Performance): __ / 3 passed

Critical Pass Rate: __%
Important Pass Rate: __%

Issues Found:
1. [Description]
2. [Description]

Console Errors:
1. [Error message and stack]

Notes:
```
