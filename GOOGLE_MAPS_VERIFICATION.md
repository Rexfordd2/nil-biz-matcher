# Google Maps Refactor Verification

## Quick Verification Steps

### 1. Verify No Duplicate Script Tags
Open browser DevTools → Network tab, filter by "maps.googleapis.com"
- ✅ Should see exactly ONE request to `maps.googleapis.com/maps/api/js?key=...&libraries=places`
- ❌ Should NOT see multiple requests or duplicate script tags

**How to check:**
```javascript
// Run in browser console
document.querySelectorAll('script[src*="maps.googleapis.com"]').length
// Expected: 1 (or 0 if key not configured)
```

### 2. Test WITHOUT API Key

**Setup:**
1. Remove `VITE_GOOGLE_MAPS_API_KEY` from `.env.local` (or set to empty string)
2. Restart dev server: `npm run dev`
3. Navigate to http://localhost:5173

**Recruiting Search (http://localhost:5173/recruiting):**
- ✅ Should see amber warning banner: "⚠️ Search disabled until Google Maps key is configured"
- ✅ Dev mode: Should show setup instructions with link to Google Cloud Console
- ✅ Search/refresh buttons should be disabled
- ✅ No console errors or crashes
- ✅ Map should not attempt to load

**Discover Search (http://localhost:5173/discover):**
- ✅ Should see amber warning banner: "⚠️ Search disabled until Google Maps key is configured"
- ✅ Dev mode: Should show setup instructions with link to Google Cloud Console
- ✅ Search button should be disabled
- ✅ No console errors or crashes

### 3. Test WITH API Key

**Setup:**
1. Add valid key to `.env.local`:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your-actual-key-here
   ```
2. Restart dev server: `npm run dev`
3. Navigate to http://localhost:5173

**Recruiting Search:**
1. Navigate to http://localhost:5173/recruiting
2. Click "Explore (Map)" tab
3. Set filters:
   - Sport: soccer
   - Level: college
   - Org Type: school
4. Check "Search this map area" checkbox
5. Pan/zoom the map to a location (e.g., Los Angeles, Boston, Miami)
6. Click "Refresh results"

**Expected Results:**
- ✅ Map loads successfully
- ✅ Search button is enabled
- ✅ Results appear in the list panel
- ✅ Markers appear on the map
- ✅ Clicking a marker shows place details
- ✅ No console errors
- ✅ No "Search disabled" warning

**Discover Search:**
1. Navigate to http://localhost:5173/discover
2. Enter search:
   - What: "pizza restaurant"
   - Where: "San Francisco, CA"
3. Click "Search" button

**Expected Results:**
- ✅ Results appear in the list
- ✅ Map displays with markers
- ✅ Can click on results to see details
- ✅ Can save businesses (if logged in)
- ✅ No console errors
- ✅ No "Search disabled" warning

### 4. Verify Shared Utilities

**Check Network Tab:**
1. Open DevTools → Network
2. Filter: "maps.googleapis.com"
3. Navigate to Recruiting → perform search
4. Navigate to Discover → perform search
5. Check total requests:
   - ✅ Should see exactly ONE initial script load
   - ✅ Subsequent features should reuse the same loaded script
   - ✅ No duplicate loads on navigation

**Check Console Logs (Dev Mode):**
Look for these messages:
```
[Google Maps] Loading script with libraries=places
[Google Maps] Script loaded successfully with Places API
```
- ✅ Should appear only ONCE per page load
- ✅ Should NOT repeat when switching between Recruiting/Discover

### 5. Production Build Verification

**Build and Preview:**
```bash
npm run build
npm run preview
```

**Test in Production Mode:**
1. Navigate to preview URL (usually http://localhost:4173)
2. Test both Recruiting and Discover features
3. Verify:
   - ✅ Features work with key configured
   - ✅ Without key: Shows generic "Contact administrator" message (not detailed setup instructions)
   - ✅ No build warnings related to Google Maps

### 6. Error Handling Verification

**Test API Key Errors:**

**Invalid Key:**
1. Set `VITE_GOOGLE_MAPS_API_KEY=invalid-key-12345`
2. Restart dev server
3. Navigate to Recruiting or Discover
4. Attempt search

**Expected:**
- ✅ Should show error message (not crash)
- ✅ Error should be user-friendly
- ✅ Can retry search without refreshing page

**Rate Limit Handling:**
(Difficult to test without hitting actual limits)
- ✅ Automatic retry logic should handle transient errors
- ✅ Shows stale results with retry message if available

## Checklist Summary

- [ ] No duplicate Google Maps script tags in DOM
- [ ] Recruiting shows graceful UI when key missing
- [ ] Discover shows graceful UI when key missing
- [ ] Recruiting search works with valid key
- [ ] Discover search works with valid key
- [ ] Both features request libraries=["places"]
- [ ] No console errors in dev mode
- [ ] Production build succeeds
- [ ] Setup instructions shown in dev mode only
- [ ] Generic message shown in production mode
- [ ] Single script load reused across features
- [ ] Error handling works gracefully

## Known Issues to Watch For

1. **Multiple Script Tags:** If you see multiple `<script src="...maps.googleapis.com...">` tags:
   - Check: `src/lib/googleMapsLoader.ts` - should have deduplication logic
   - Verify: Only one component is calling `loadGoogleMaps()` at app startup

2. **"Places API not available" Error:**
   - Verify: Script URL includes `libraries=places`
   - Check: Script fully loaded before creating PlacesService

3. **Key Not Found Despite Being Set:**
   - Verify: Key is in `.env.local` (NOT `.env` for local override)
   - Verify: Key is prefixed with `VITE_` for client-side access
   - Verify: Dev server was restarted after adding key

4. **CORS or API Key Restrictions:**
   - Verify: API key has HTTP referrer restrictions configured
   - Verify: Maps JavaScript API is enabled in Google Cloud Console
   - Verify: Places API is enabled in Google Cloud Console

## Success Criteria

✅ **All checks passed** means:
1. Single source of truth for Google Maps loading
2. No duplicate code between Recruiting and Discover
3. Graceful degradation when key is missing
4. Both features work correctly with valid key
5. No duplicate script tags or loading conflicts
6. User-friendly error messages
7. Proper environment-aware messaging (dev vs prod)
