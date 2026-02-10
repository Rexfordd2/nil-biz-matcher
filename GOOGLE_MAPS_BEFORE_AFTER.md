# Google Maps Refactor: Before & After

## Architecture Comparison

### BEFORE - Duplicated Logic

```
Recruiting.tsx (1,600+ lines)
├─ Imports loadGoogleMaps from googleMapsLoader
├─ Imports hasGoogleMapsKey, getGoogleMapsSetupInstructions from config/env
├─ Creates PlacesService inline (line 235)
├─ Custom textSearch with callbacks (lines 237-261)
├─ Duplicate "Search Disabled" UI (lines 479-505)
└─ Custom retry/error handling

Discover.tsx (440 lines)
├─ Imports loadGoogleMaps from googleMapsLoader
├─ Imports hasGoogleMapsKey, getGoogleMapsSetupInstructions from config/env
├─ Uses usePlacesSearch hook
├─ Duplicate "Search Disabled" UI (lines 189-214)
└─ Separate error handling

usePlacesSearch.ts
├─ Creates PlacesService inline (line 86, 112)
├─ Custom textSearch with retry logic (lines 111-138)
└─ Custom getDetails logic (lines 84-95)

usePlaceDetails.ts
├─ Creates PlacesService inline (line 45)
└─ Custom getDetails logic (lines 46-77)
```

**Issues:**
- ❌ 4 places creating PlacesService
- ❌ 2 copies of textSearch logic
- ❌ 2 copies of getDetails logic
- ❌ 2 duplicate "Search Disabled" UI components
- ❌ Inconsistent error handling
- ❌ No guarantee of single script load

---

### AFTER - Centralized Architecture

```
src/lib/google/maps.ts (NEW - 135 lines)
├─ loadGoogleMaps() - Re-export from googleMapsLoader
├─ isGoogleMapsReady() - Check if loaded
├─ hasGoogleMapsKey - Re-export
├─ createPlacesService() - Single helper
├─ textSearch() - With retry logic
├─ getPlaceDetails() - Unified implementation
├─ GOOGLE_MAPS_ERROR_MESSAGES - Standard messages
└─ requireGoogleMapsKey() - Validation

src/components/GoogleMapsDisabledNotice.tsx (NEW - 47 lines)
├─ Single reusable warning component
├─ Environment-aware (dev vs prod)
├─ Consistent styling
└─ Used by all features

Recruiting.tsx (1,600 lines - simplified)
├─ Imports from lib/google/maps
├─ Uses textSearch() utility
├─ Uses <GoogleMapsDisabledNotice />
└─ No duplicate logic

Discover.tsx (440 lines - simplified)
├─ Imports from lib/google/maps
├─ Uses <GoogleMapsDisabledNotice />
└─ No duplicate logic

usePlacesSearch.ts (simplified)
├─ Imports textSearch, getPlaceDetails from lib/google/maps
└─ No inline service creation

usePlaceDetails.ts (simplified)
├─ Imports getPlaceDetails from lib/google/maps
└─ No inline service creation

PlacesMap.tsx (updated)
└─ Imports from lib/google/maps
```

**Benefits:**
- ✅ Single createPlacesService() implementation
- ✅ Single textSearch() with retry logic
- ✅ Single getPlaceDetails() implementation
- ✅ Single GoogleMapsDisabledNotice component
- ✅ Consistent error messages
- ✅ Guaranteed single script load
- ✅ Easier to maintain and test

---

## Code Comparison Examples

### Example 1: Creating PlacesService

#### BEFORE (Recruiting.tsx)
```typescript
const google = await loadGoogleMaps()
if (!google?.maps?.places) {
  throw new Error('Google Places not available')
}
const svc = new google.maps.places.PlacesService(document.createElement('div'))
```

#### BEFORE (usePlacesSearch.ts)
```typescript
const google = await loadGoogleMaps()
if (ac.signal.aborted || myId !== requestIdRef.current) return
const svc = new google.maps.places.PlacesService(document.createElement('div'))
```

#### AFTER (All locations)
```typescript
const service = await createPlacesService()
// or
const results = await textSearch(request, signal)
```

---

### Example 2: Text Search with Retry

#### BEFORE (usePlacesSearch.ts - 30+ lines)
```typescript
const textSearchResults = await (async () => {
  const svc = new google.maps.places.PlacesService(document.createElement('div'))
  const request: google.maps.places.TextSearchRequest = { query: normalizedInput.query }
  if (originLatLng) {
    request.location = originLatLng
    request.radius = 20000
  }
  const attempt = (tryNum: number): Promise<google.maps.places.PlaceResult[]> => new Promise((resolve, reject) => {
    svc.textSearch(request, async (res, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(res)) {
        return resolve(res)
      }
      if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        return resolve([])
      }
      const transient = status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT || 
                       status === google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR
      if (transient && tryNum < 3) {
        const base = 250 * Math.pow(2, tryNum)
        const jitter = Math.floor(Math.random() * 100)
        await new Promise(r => setTimeout(r, base + jitter))
        return resolve(attempt(tryNum + 1))
      }
      return reject(new Error(`Places textSearch failed: ${status}`))
    })
  })
  return attempt(0)
})()
```

#### AFTER (All locations - 3 lines)
```typescript
const request: google.maps.places.TextSearchRequest = { query, location, radius }
const results = await textSearch(request, signal)
// Retry logic is built-in!
```

---

### Example 3: "Search Disabled" Warning

#### BEFORE (Recruiting.tsx - 27 lines)
```tsx
{!hasGoogleMapsKey && (
  <div className="mb-4 p-3 rounded-md border border-amber-500 bg-amber-900/20 text-amber-200 text-sm">
    <div className="font-semibold mb-2">⚠️ Search disabled until Google Maps key is configured</div>
    {import.meta.env.DEV ? (
      <div className="space-y-1">
        <div className="font-medium">Setup steps:</div>
        {setupInstructions.local.map((step, i) => (
          <div key={i} className="text-xs">{step}</div>
        ))}
        <div className="mt-2 text-xs">
          <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">
            Get API key at Google Cloud Console →
          </a>
        </div>
      </div>
    ) : (
      <div className="text-xs">Google Maps is not configured. Contact your administrator.</div>
    )}
  </div>
)}
```

#### BEFORE (Discover.tsx - same 27 lines duplicated)
```tsx
{!hasClientKey && (
  <div className="mb-3 p-3 rounded-md border border-amber-500 bg-amber-900/20 text-amber-200 text-sm">
    {/* ... exact same code ... */}
  </div>
)}
```

#### AFTER (All locations - 1 line)
```tsx
{!hasGoogleMapsKey && <GoogleMapsDisabledNotice className="mb-4" />}
```

---

## Import Comparison

### BEFORE
```typescript
// Recruiting.tsx
import { loadGoogleMaps } from '../lib/googleMapsLoader'
import { hasGoogleMapsKey, getGoogleMapsSetupInstructions } from '../config/env'

// Discover.tsx
import { loadGoogleMaps } from '../lib/googleMapsLoader'
import { hasGoogleMapsKey, getGoogleMapsSetupInstructions } from '../config/env'

// usePlacesSearch.ts
import { loadGoogleMaps } from '../lib/googleMapsLoader'

// usePlaceDetails.ts
import { loadGoogleMaps } from '../lib/googleMapsLoader'
```

### AFTER
```typescript
// All files
import { loadGoogleMaps, hasGoogleMapsKey, textSearch, getPlaceDetails } from '../lib/google/maps'
import GoogleMapsDisabledNotice from './GoogleMapsDisabledNotice'
```

**Single source of truth!**

---

## Lines of Code Saved

| Component | Before | After | Saved |
|-----------|--------|-------|-------|
| Recruiting.tsx (duplicate UI) | 27 lines | 1 line | -26 lines |
| Discover.tsx (duplicate UI) | 27 lines | 1 line | -26 lines |
| usePlacesSearch.ts (textSearch) | 30 lines | 3 lines | -27 lines |
| usePlacesSearch.ts (getDetails) | 13 lines | 1 line | -12 lines |
| usePlaceDetails.ts (getDetails) | 32 lines | 10 lines | -22 lines |
| **Total removed** | | | **-113 lines** |
| **New shared module** | | | +135 lines |
| **New shared component** | | | +47 lines |
| **Net change** | | | **+69 lines** |

**Result:** 69 additional lines of code, but:
- ✅ Eliminates 113 lines of duplication
- ✅ Creates 182 lines of reusable utilities
- ✅ Much easier to maintain (change once, applies everywhere)
- ✅ Better tested (single implementation)
- ✅ Consistent behavior across features

---

## Migration Path

### For New Features
```typescript
// ✅ DO THIS (use shared utilities)
import { loadGoogleMaps, textSearch, hasGoogleMapsKey } from '../lib/google/maps'
import GoogleMapsDisabledNotice from '../components/GoogleMapsDisabledNotice'

// Show warning if key missing
{!hasGoogleMapsKey && <GoogleMapsDisabledNotice />}

// Use shared utilities
const results = await textSearch({ query: 'coffee shop', location, radius: 5000 })

// ❌ DON'T DO THIS (old way)
import { loadGoogleMaps } from '../lib/googleMapsLoader'
const google = await loadGoogleMaps()
const service = new google.maps.places.PlacesService(document.createElement('div'))
service.textSearch(...)  // Manual retry logic, error handling, etc.
```

---

## Backward Compatibility

The original `src/lib/googleMapsLoader.ts` still exists and works:
- ✅ Re-exported through new module
- ✅ Existing direct imports still work
- ✅ No breaking changes
- ⚠️ Prefer importing from `src/lib/google/maps` for new code

**Deprecation Path:**
1. ✅ Phase 1 (Current): Both old and new imports work
2. 🔄 Phase 2 (Future): Update remaining imports to use new module
3. 📝 Phase 3 (Future): Mark old exports as deprecated
4. 🗑️ Phase 4 (Future): Remove `googleMapsLoader.ts` once all imports updated
