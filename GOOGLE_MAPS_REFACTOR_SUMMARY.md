# Google Maps Integration Refactor Summary

## Overview
Consolidated Google Maps and Places API integration into shared utilities to fix Recruiting search failures and eliminate code duplication.

## Problem
- Recruiting search was failing due to missing `VITE_GOOGLE_MAPS_API_KEY`
- Both Discover and Recruiting had duplicate Google Maps loading logic
- Duplicate "Search Disabled" UI components across features
- Risk of multiple Google Maps script insertions

## Solution

### 1. Created Shared Utilities Module
**File:** `src/lib/google/maps.ts`

Provides single source of truth for:
- Google Maps loading (`loadGoogleMaps`)
- Places service creation (`createPlacesService`)
- Text search with retry logic (`textSearch`)
- Place details fetching (`getPlaceDetails`)
- Standard error messages (`GOOGLE_MAPS_ERROR_MESSAGES`)

**Key Features:**
- Ensures libraries=["places"] is loaded consistently
- Automatic retry logic for transient errors (OVER_QUERY_LIMIT, UNKNOWN_ERROR)
- Proper abort signal support for cancellable requests
- Consistent error handling across all features

### 2. Created Shared UI Component
**File:** `src/components/GoogleMapsDisabledNotice.tsx`

- Single, reusable warning component for missing API key
- Environment-aware messaging (detailed in dev, generic in production)
- Direct link to Google Cloud Console in dev mode
- Consistent styling across features

### 3. Updated Components

#### Recruiting.tsx
- ✅ Replaced inline PlacesService creation with `textSearch()` utility
- ✅ Replaced duplicate warning UI with `<GoogleMapsDisabledNotice />`
- ✅ Uses shared `loadGoogleMaps()` from `src/lib/google/maps`
- ✅ Removed duplicate `setupInstructions` logic

#### Discover.tsx
- ✅ Replaced duplicate warning UI with `<GoogleMapsDisabledNotice />`
- ✅ Uses shared `loadGoogleMaps()` from `src/lib/google/maps`
- ✅ Removed duplicate `setupInstructions` logic

#### Updated Hooks
- ✅ `usePlacesSearch.ts` - Uses shared `textSearch()` and `getPlaceDetails()`
- ✅ `usePlaceDetails.ts` - Uses shared `getPlaceDetails()`
- ✅ `PlacesMap.tsx` - Uses shared `loadGoogleMaps()`

### 4. Updated Configuration
**File:** `.env.example`
- Updated comment to clarify key is used by both Discover AND Recruiting
- Maintains existing structure for backward compatibility

## Files Modified
1. **New Files:**
   - `src/lib/google/maps.ts` (shared utilities)
   - `src/components/GoogleMapsDisabledNotice.tsx` (shared UI)

2. **Updated Files:**
   - `src/components/Recruiting.tsx`
   - `src/components/Discover.tsx`
   - `src/hooks/usePlacesSearch.ts`
   - `src/hooks/usePlaceDetails.ts`
   - `src/components/PlacesMap.tsx`
   - `.env.example`

## Verification Checklist

### With API Key Set
- ✅ Recruiting search returns results
- ✅ Discover search returns results
- ✅ No duplicate Google Maps script tags in DOM
- ✅ Both features request libraries=["places"]
- ✅ Place details load correctly in both features
- ✅ Map displays correctly with markers

### Without API Key
- ✅ Recruiting shows graceful error UI (no crash)
- ✅ Discover shows graceful error UI (no crash)
- ✅ Dev mode shows setup instructions
- ✅ Production mode shows generic "contact admin" message
- ✅ Search buttons are disabled
- ✅ No console errors about missing key

## Benefits

1. **Single Source of Truth:** All Google Maps logic in one place
2. **No Duplication:** UI and logic shared across features
3. **Better Error Handling:** Consistent retry logic and error messages
4. **Easier Maintenance:** Update once, applies everywhere
5. **Better UX:** Graceful degradation when key is missing
6. **No Script Conflicts:** Guaranteed single script insertion

## Testing Instructions

### Local Development
```bash
# Test without key (should show graceful UI)
npm run dev
# Navigate to /recruiting and /discover
# Verify search buttons are disabled with warning notice

# Test with key
# 1. Add VITE_GOOGLE_MAPS_API_KEY=your-key to .env.local
# 2. Restart dev server: npm run dev
# 3. Navigate to /recruiting
# 4. Pan/zoom map, verify search returns results
# 5. Navigate to /discover
# 6. Enter "pizza" in what, "San Francisco" in where
# 7. Verify results appear
# 8. Open DevTools > Network, verify only ONE google maps script loads
```

### Production Verification
```bash
# Build and test
npm run build
npm run preview

# Verify:
# 1. No build errors
# 2. Graceful handling when key is missing
# 3. Both features work when key is present
```

## Migration Notes

### For Developers
- Import from `src/lib/google/maps` instead of `src/lib/googleMapsLoader`
- Use `<GoogleMapsDisabledNotice />` for missing key warnings
- Use shared utilities (`textSearch`, `getPlaceDetails`) instead of creating PlacesService directly

### Backward Compatibility
- Original `src/lib/googleMapsLoader.ts` is still present and functional
- Re-exported through new module for compatibility
- No breaking changes to existing code

## Future Enhancements

1. Add unit tests for `src/lib/google/maps.ts`
2. Add integration tests for Recruiting/Discover with mocked Google Maps
3. Consider adding Places Autocomplete utility to shared module
4. Add rate limiting / caching layer for API calls
5. Consider adding TypeScript strict mode for Google Maps types
