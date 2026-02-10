# Google Maps Fixes - Testing Guide

## Quick Verification (5 minutes)

### Test 1: Discover Search (Should work 10/10 times)
1. Navigate to Discover page
2. Type "coffee" in the What field
3. Type your city in the Where field (e.g., "Seattle, WA")
4. Click Search button
5. **Expected**: Results appear within 2-3 seconds
6. **Repeat 9 more times** with different searches
7. **Success**: All 10 searches return results without errors

### Test 2: Recruiting Location Filter BEFORE Search
1. Navigate to Recruiting → Explore tab
2. **FIRST**: Set location filter
   - Type "Seattle, WA" in Location field
   - Click "Apply" button
   - **Expected**: Green checkmark "✓ Location set: Seattle, WA"
3. **THEN**: Click "Refresh results" button
4. **Expected**: 
   - Search completes successfully
   - Results appear on map
   - Distance shown for each result (e.g., "5.2 mi")
5. Change radius to 50 miles
6. **Expected**: Results update to show places within 50 miles

### Test 3: Location Input Responsiveness
1. Open Discover page
2. **Immediately** start typing in the Where field (don't wait)
3. **Expected**: Input responds instantly, characters appear
4. Open Recruiting Explore
5. **Immediately** start typing in Location field
6. **Expected**: Input responds instantly, characters appear
7. **Success**: No lag, no blocking, no disabled states

### Test 4: Retry Button on Error
1. Open browser DevTools → Network tab
2. Navigate to Discover
3. Set Network to "Offline" mode
4. Enter search terms and click Search
5. **Expected**: 
   - Error message appears
   - "Retry" button visible next to error
6. Set Network back to "Online"
7. Click "Retry" button
8. **Expected**: Search succeeds and results appear

### Test 5: No Race Conditions
1. Open Discover
2. Type "pizza" + your city
3. Click Search button
4. **Immediately** click Search button again (rapid fire)
5. Click Search 3 more times rapidly
6. **Expected**: 
   - Only one set of results appears
   - No flickering between different result sets
   - Loading spinner stops after last search completes

## Debug Mode Testing (Dev Environment)

If running `npm run dev`:

### Debug Error Messages
1. Trigger an error (offline mode or invalid API key)
2. **Expected**: Additional debug line appears below error:
   ```
   Error message
   Debug: [detailed error info]
   ```

### Loader Status Check
1. Open browser console
2. Type: `import { getGoogleMapsStatus } from './src/lib/google/maps'`
3. Check status: `getGoogleMapsStatus()`
4. **Expected output**: `{ ready: true, error: null }`
5. If error occurred: `{ ready: false, error: Error(...) }`

## Known Good Behavior

### Discover
- ✅ Location autocomplete suggestions appear as you type
- ✅ Selecting a suggestion fills the input and stores place ID
- ✅ Can still submit without selecting autocomplete suggestion
- ✅ Search uses place ID if available, otherwise geocodes text

### Recruiting
- ✅ Location filter is optional (search works without it)
- ✅ "Use my location" button prompts for permission
- ✅ Distance shown for each result when filter is active
- ✅ Changing radius immediately updates visible results
- ✅ Map pan/zoom triggers new search (if "Search this area" is checked)

## Troubleshooting

### "Search disabled: Google Maps API key not configured"
- **Cause**: `VITE_GOOGLE_MAPS_API_KEY` not set in `.env`
- **Fix**: Copy `.env.example` to `.env` and add your API key
- **Note**: Search button will be disabled but inputs are still editable

### Autocomplete not working in Discover
- **Cause**: Google Maps script failed to load or Places API not enabled
- **Expected**: Input still works, just no autocomplete suggestions
- **Workaround**: User can still type location and submit search

### "Geocoding failed" in Recruiting location filter
- **Cause**: Invalid location text or Google Geocoding API issue
- **Expected**: Error message appears, location not set
- **Workaround**: Try different location format (e.g., "City, State" instead of street address)

### Results not filtered by location in Recruiting
- **Cause**: Location filter not applied (Apply button not clicked)
- **Check**: Look for green "✓ Location set" message
- **Fix**: Click "Apply" button after typing location

## Performance Expectations

- **Google Maps script load**: 500-1500ms (one-time on page load)
- **Discover search**: 1-3 seconds for results
- **Recruiting search**: 1-3 seconds for results
- **Geocoding location**: 200-500ms
- **Autocomplete suggestions**: 100-300ms after typing

## Success Criteria

All of the following must be true:

- [ ] Discover search succeeds 10/10 times
- [ ] Recruiting search works with location filter set first
- [ ] Location inputs never blocked or disabled
- [ ] Retry button appears on error and successfully retries
- [ ] Rapid-fire searches don't cause race conditions
- [ ] No console errors related to Google Maps loading
- [ ] Debug mode shows detailed error messages

## Common Test Scenarios

### Scenario 1: First-time user, no cache
1. Open app in incognito/private window
2. Navigate to Discover
3. **Expected**: Google Maps loads once, all features work

### Scenario 2: Multiple tabs
1. Open Discover in tab 1
2. Open Recruiting in tab 2
3. **Expected**: Both work independently, no conflicts

### Scenario 3: Slow network
1. DevTools → Network → Slow 3G
2. Try searches in both Discover and Recruiting
3. **Expected**: Longer load times but no failures or broken UI

### Scenario 4: Location permission denied
1. Open Recruiting Explore
2. Click "📍 Use my location"
3. Deny permission in browser prompt
4. **Expected**: Error message appears, can still use manual input

### Scenario 5: Invalid API key
1. Set `VITE_GOOGLE_MAPS_API_KEY` to invalid value
2. Reload app
3. **Expected**: 
   - Search buttons disabled
   - Error message shown
   - Inputs still editable
   - No console spam

## Reporting Issues

If tests fail, please provide:
1. Which test failed
2. Browser and version
3. Console errors (if any)
4. Network tab screenshot (if relevant)
5. Steps to reproduce

Example issue report:
```
Test: Discover Search (10/10)
Result: Failed on attempt 3/10
Browser: Chrome 120
Error: "Places textSearch failed: OVER_QUERY_LIMIT"
Steps: Searched for "pizza seattle" three times rapidly
```
