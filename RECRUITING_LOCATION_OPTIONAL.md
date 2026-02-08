# Recruiting Location Filter: Optional and Non-Blocking ✅

## Summary

Location filter in Recruiting is now **truly optional** and never blocks search. Users can search with or without a location filter.

## Implementation

### Search Behavior

**Without Location Filter (Text-Only Search):**
```typescript
placesProxySearch({
  q: "soccer club"
  // No location or radius parameters
})
```
- Performs broad, text-based search
- Google returns results from anywhere
- Good for general exploration

**With Location Filter:**
```typescript
placesProxySearch({
  q: "soccer club",
  location: "40.7128,-74.0060",
  radius: 40234 // 25 miles in meters
})
```
- Narrows results to specific geographic area
- Results within specified radius
- More precise targeting

### Changes Made

#### 1. Recruiting.tsx (lines 278-320)

**Before:**
```typescript
// Always used map center as fallback
const searchCenter = locationFilter.lat !== null ? locationFilter : center
const searchRadius = locationFilter.lat !== null ? filter.radius : computeRadiusMeters(zoom)

// Always passed location (never optional)
placesProxySearch({
  q: keyword,
  location: `${searchCenter.lat},${searchCenter.lng}`, // Always present
  radius: searchRadius // Always present
})
```

**After:**
```typescript
// Check if user has explicitly set location filter
const hasLocationFilter = locationFilter.lat !== null && locationFilter.lng !== null

// Build params conditionally
const searchParams: { q: string; location?: string; radius?: number } = {
  q: keyword // Always required
}

// Only include location if user has explicitly set it
if (hasLocationFilter) {
  searchParams.location = `${locationFilter.lat},${locationFilter.lng}`
  searchParams.radius = Math.round(locationFilter.radiusMiles * 1609.34)
}

// Call proxy (location is truly optional now)
placesProxySearch(searchParams, ...)
```

#### 2. placesProxy.ts (lines 86-94)

**Before:**
```typescript
// Always sent radius, even without location
qs.set('q', normalizedQuery)
if (normalizedLocation) {
  qs.set('location', normalizedLocation)
}
qs.set('radius', normalizedRadius.toString()) // Always sent
```

**After:**
```typescript
// Only send radius if location is provided
qs.set('q', normalizedQuery)
if (normalizedLocation && normalizedLocation.length > 0) {
  qs.set('location', normalizedLocation)
  qs.set('radius', normalizedRadius.toString()) // Only with location
}
```

#### 3. RecruitingSearchFilters.tsx (line 293-297)

**Before:**
```
💡 Add a location to narrow results by distance
```

**After:**
```
💡 Location is optional. Add it to narrow results by distance, or leave empty for broader search.
```

### User Flow

1. **Initial State (No Location Filter)**
   - User can search immediately with just sport/level/org type
   - Search runs with query only
   - Results come from anywhere (broad search)

2. **Adding Location Filter**
   - User enters location (e.g., "New York, NY")
   - Clicks "Apply" or presses Enter
   - Location filter geocodes address
   - User can adjust radius (5, 10, 25, 50, 100 miles)

3. **Search with Location Filter**
   - User clicks "Refresh results"
   - Search includes location + radius
   - Results are geographically constrained
   - Client-side filtering also applies (for precision)

4. **Removing Location Filter**
   - User clicks "Clear" button
   - Location filter is removed
   - Next search reverts to text-only (broad search)

5. **Re-search Works**
   - User can toggle location filter on/off
   - User can change radius without re-geocoding
   - Search always works, with or without location

### API Calls

**Example: Text-only search (no location filter)**
```
GET /api/places-search?q=soccer+club
```

**Example: Location-filtered search**
```
GET /api/places-search?q=soccer+club&location=40.7128,-74.0060&radius=40234
```

### Server Compatibility

The server (`/api/places-search`) already handles optional location:
- If location is provided → uses Google Places Text Search with location bias
- If location is omitted → uses Google Places Text Search without location bias

No server changes needed - it already supports both modes.

### Testing

#### Test 1: Search without location filter
1. Open Recruiting → Explore Map
2. Select sport/level (e.g., "soccer", "club")
3. Leave location filter empty
4. Click "Refresh results"
5. ✅ Search executes successfully
6. ✅ Console shows: `/api/places-search?q=soccer+club` (no location param)

#### Test 2: Search with location filter
1. Open Recruiting → Explore Map
2. Select sport/level
3. Enter location "Los Angeles, CA"
4. Click "Apply"
5. Click "Refresh results"
6. ✅ Search executes with location
7. ✅ Console shows: `/api/places-search?q=soccer+club&location=34.0522,-118.2437&radius=40234`

#### Test 3: Toggle location filter
1. Search with location (as above)
2. Click "Clear" to remove location
3. Click "Refresh results"
4. ✅ Search reverts to text-only (no location)
5. Re-enter location and search again
6. ✅ Location filter re-applies correctly

### Benefits

1. **No Blocking** - Search always works, location is optional
2. **Flexible** - Users can search broadly or narrow by location
3. **Performance** - Text-only searches are faster (no geocoding needed)
4. **User Control** - Clear UI about location being optional
5. **Re-search Works** - Users can toggle location filter on/off freely

### Files Changed

| File | Change | Lines |
|------|--------|-------|
| `src/components/Recruiting.tsx` | Make location optional in search params | 278-320 |
| `src/lib/google/placesProxy.ts` | Only send radius with location | 52-94 |
| `src/components/RecruitingSearchFilters.tsx` | Update UI messaging | 293-297 |
| `RECRUITING_LOCATION_OPTIONAL.md` | Documentation | New file |

### Backward Compatibility

✅ **No breaking changes**
- Server already supports optional location
- Discover component unaffected (has its own location handling)
- All existing searches continue to work
