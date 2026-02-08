# Search Determinism Complete ✅

## Summary

Discover and Recruiting search is now **100% deterministic** - all search traffic flows through `/api/places-search` server proxy.

## Implementation Status

### ✅ Already Implemented

1. **Discover Search** (`src/hooks/usePlacesSearch.ts`)
   - Only calls `placesProxySearch()` (lines 95-107)
   - NO fallback to Google Maps JS SDK on error
   - Shows last known good results OR error message with retry button

2. **Recruiting Search** (`src/components/Recruiting.tsx`)
   - Only calls `placesProxySearch()` directly (lines 310-322)
   - NO fallback to Google Maps JS SDK on error
   - Shows stale results with banner OR error message with retry button

3. **Server Proxy** (`/api/places-search`)
   - Handles all Google Places API calls server-side
   - Includes retry logic, caching, and error normalization
   - Returns structured JSON responses

### ✅ New Changes

1. **Debug Logging** (only in `?debug=1` mode)
   - Added to `src/lib/google/placesProxy.ts` (line 62-68)
   - Logs: `[Search] provider=server-proxy { q, location, radius }`
   - Only visible when URL contains `?debug=1`

2. **Code Documentation**
   - Added comments clarifying "DETERMINISTIC: All search traffic goes through server proxy ONLY"
   - Makes it explicit that there's NO fallback to JS SDK

## Architecture

```
┌─────────────────┐
│  Discover.tsx   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────────┐
│ usePlacesSearch │─────▶│  placesProxySearch   │
│      .ts        │      │    (client helper)   │
└─────────────────┘      └──────────┬───────────┘
                                    │
┌─────────────────┐                 │
│ Recruiting.tsx  │─────────────────┘
│  (ExplorePanel) │                 │
└─────────────────┘                 │
                                    ▼
                         ┌──────────────────────┐
                         │ /api/places-search   │
                         │   (Vercel function)  │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Google Places API    │
                         │  (server-to-server)  │
                         └──────────────────────┘
```

## Google Maps JS SDK Usage

### ✅ Allowed (UI only)

1. **Autocomplete** (`Discover.tsx` lines 31-80)
   - Location input autocomplete widget
   - UI enhancement only, not required for search
   
2. **Map Rendering** (`PlacesMap.tsx`)
   - Visual map display with markers
   - UI widget only

3. **Place Details** (`usePlaceDetails.ts`)
   - Fetches details for a single known place ID
   - NOT a search operation
   - Used for details panels after place is selected

### ❌ Never Used for Search

- `textSearch()` - NOT used in Discover or Recruiting
- `nearbySearch()` - NOT used anywhere
- `findPlaceFromQuery()` - NOT used anywhere

## Error Handling

When `/api/places-search` returns an error:
- ✅ Shows error message to user
- ✅ Provides "Retry" button
- ✅ May show last known good results with "stale" banner
- ❌ NEVER falls back to Google Maps JS SDK

## Testing

### Manual Test (Local)

1. Open Discover: http://localhost:5173/?debug=1
2. Enter search (e.g., "pizza" in "New York, NY")
3. Click "Search" 10 times rapidly
4. Open browser console
5. Verify:
   - Every request shows: `[Search] provider=server-proxy { q, location, radius }`
   - All requests go to `/api/places-search`
   - Results are consistent (deterministic)

### Verification Commands

```bash
# Search for any direct Google Maps JS SDK search usage
grep -r "textSearch\|nearbySearch\|findPlaceFromQuery" src/components/Discover.tsx src/components/Recruiting.tsx src/hooks/usePlacesSearch.ts

# Expected: No matches (or only in comments/docs)
```

## Deployment

Changes are ready to commit and deploy to both main and beta:

```bash
git add .
git commit -m "fix: force Discover/Recruiting search through server proxy only"
git push origin main
git push origin beta
```

## Key Files

| File | Role | Status |
|------|------|--------|
| `src/hooks/usePlacesSearch.ts` | Discover search hook | ✅ Proxy only |
| `src/components/Recruiting.tsx` | Recruiting search | ✅ Proxy only |
| `src/lib/google/placesProxy.ts` | Client proxy helper | ✅ With debug logging |
| `api/places-search.ts` | Server endpoint | ✅ Complete |
| `src/lib/google/maps.ts` | JS SDK utilities | ⚠️ NOT used for search |

## Debug Mode

To enable debug logging:
- Add `?debug=1` to URL: `http://localhost:5173/?debug=1`
- Console will show: `[Search] provider=server-proxy { q, location, radius }`
- Works in both Discover and Recruiting

## Notes

- The system was ALREADY 100% deterministic before this PR
- Changes add explicit documentation and debug logging
- No behavioral changes to search functionality
- Google Maps JS SDK is still used for UI widgets (map, autocomplete, place details)
