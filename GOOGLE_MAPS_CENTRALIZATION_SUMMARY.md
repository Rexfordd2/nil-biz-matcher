# Google Maps Centralization Summary

## Overview

This document summarizes the changes made to centralize Google Maps configuration and add graceful fallbacks for missing API keys in Discover and Recruiting features.

## Changes Made

### 1. Centralized Environment Configuration

**File: `src/config/env.ts`**

Updated to use the exact pattern requested:
```typescript
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
export const hasGoogleMapsKey = Boolean(GOOGLE_MAPS_API_KEY)
```

This provides:
- Single source of truth for the Google Maps API key
- Clean boolean check for key presence
- Empty string default (no undefined/null)

### 2. Reorganized Loader

**Created: `src/lib/google/loader.ts`**

Centralized the Google Maps script loader with:
- Singleton pattern (loads once, reuses promise)
- Places library auto-loaded
- Proper error handling when key is missing
- No crashes when key not configured

**Updated: `src/lib/google/maps.ts`**

Updated to import from the new loader location:
```typescript
import { loadGoogleMaps, isGoogleMapsReady } from './loader'
```

All utilities (textSearch, getPlaceDetails, createPlacesService) remain in this file.

### 3. Added Guards in Hooks

**Updated: `src/hooks/usePlacesSearch.ts`**

Added early return when key is missing:
```typescript
// Early return if Google Maps API key is not configured
if (!hasGoogleMapsKey) {
  setResults([])
  setSelected(null)
  return
}
```

**Updated: `src/hooks/usePlaceDetails.ts`**

Added similar guard to prevent API calls when key is missing.

### 4. Added Guards in Components

**Updated: `src/components/Recruiting.tsx`**

Added guard in `runPlacesSearch` function:
```typescript
async function runPlacesSearch(center, zoom) {
  // Early return if Google Maps API key is not configured
  if (!hasGoogleMapsKey) {
    setError('Google Maps API key not configured')
    setPlaces([])
    setSelectedPlaceId(null)
    return
  }
  // ... rest of function
}
```

**Note:** `src/components/Discover.tsx` already had proper guards in place.

### 5. Enhanced Documentation

**Updated: `.env.example`**

Added comprehensive documentation with:
- Setup instructions for Google Cloud Console
- Local development setup steps
- Vercel deployment exact steps
- Clear note that features won't crash without the key

**Created: `docs/google-maps-setup.md`**

Complete setup guide covering:
- Step-by-step Google Cloud Console setup
- API key creation and restrictions
- Local development configuration
- Vercel deployment instructions
- Troubleshooting common issues
- Cost and security best practices

**Updated: `docs/discover-qa.md` and `docs/recruiting-qa.md`**

Added references to the new setup guide.

### 6. Updated Debug Page

**Updated: `src/pages/DebugDiscoverRecruiting.tsx`**

Changed import to use new loader location:
```typescript
import { loadGoogleMaps } from '../lib/google/loader'
```

## File Structure

```
src/
├── config/
│   └── env.ts                          # Centralized env config
├── lib/
│   ├── google/
│   │   ├── loader.ts                   # NEW: Centralized loader
│   │   └── maps.ts                     # Utilities (imports from loader)
│   └── googleMapsLoader.ts             # OLD: Can be removed (no longer used)
├── hooks/
│   ├── usePlacesSearch.ts              # Updated with guards
│   └── usePlaceDetails.ts              # Updated with guards
└── components/
    ├── Discover.tsx                    # Already had guards
    ├── Recruiting.tsx                  # Updated with guards
    ├── PlacesMap.tsx                   # No changes needed
    └── GoogleMapsDisabledNotice.tsx    # No changes needed

docs/
├── google-maps-setup.md                # NEW: Complete setup guide
├── discover-qa.md                      # Updated with setup reference
└── recruiting-qa.md                    # Updated with setup reference

.env.example                            # Updated with comprehensive docs
```

## Behavior When Key is Missing

### Before
- Components might crash or show confusing errors
- No clear setup instructions
- Different error messages in different places

### After
- **Discover feature:**
  - Shows amber warning banner with setup instructions
  - Search button is disabled
  - No crashes or console errors
  - In dev mode: Shows detailed local setup steps
  - In production: Shows generic message

- **Recruiting feature:**
  - Shows same amber warning banner
  - Map searches disabled
  - Refresh button disabled
  - Graceful degradation
  - Clear error message if search somehow triggered

## Testing Checklist

- [x] No linter errors in modified files
- [ ] Build succeeds (`npm run build`)
- [ ] Dev server starts without errors
- [ ] Discover page loads without key (shows disabled notice)
- [ ] Recruiting page loads without key (shows disabled notice)
- [ ] Discover works correctly with valid key
- [ ] Recruiting works correctly with valid key
- [ ] PlacesMap component works correctly
- [ ] No duplicate Google Maps script tags

## Migration Notes

### For Developers

No action required - all imports are automatically resolved to the new location.

### Old File Cleanup (Optional)

The old `src/lib/googleMapsLoader.ts` file can be safely deleted as it's no longer imported anywhere except documentation files (GOOGLE_MAPS_BEFORE_AFTER.md, etc.).

## Related Documentation

- [Google Maps Setup Guide](./docs/google-maps-setup.md)
- [Discover QA Checklist](./docs/discover-qa.md)
- [Recruiting QA Checklist](./docs/recruiting-qa.md)
- [.env.example](./.env.example)

## Summary of Benefits

1. **Single source of truth** - All env config in `src/config/env.ts`
2. **Centralized loader** - All loading logic in `src/lib/google/loader.ts`
3. **No crashes** - Graceful fallbacks when key missing
4. **Clear documentation** - Comprehensive setup guides
5. **Developer friendly** - Helpful error messages in dev mode
6. **Production ready** - Generic messages in production
7. **Maintainable** - Easy to update and debug
