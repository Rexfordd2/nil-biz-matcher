# Location-Based Filtering for Recruiting Search

## Summary

Added location-based filtering to the Recruiting Explore panel, allowing users to search for organizations within a specified radius of a location.

## Components Created

### RecruitingSearchFilters Component

**Location:** `src/components/RecruitingSearchFilters.tsx`

A standalone, reusable component that provides:

1. **Location Input**
   - Text input for City, State, or ZIP code
   - "Apply" button to geocode the location
   - Real-time validation and error feedback

2. **Geolocation Support**
   - "Use my location" button with GPS integration
   - Handles permission denied gracefully
   - Falls back to manual input if geolocation fails
   - Reverse geocodes coordinates to human-readable address

3. **Radius Selection**
   - Dropdown with preset options: 5, 10, 25, 50, 100 miles
   - Default: 25 miles

4. **Persistence**
   - Automatically saves location + radius to localStorage
   - Restores on page reload
   - Storage key: `recruiting_location_filter`

5. **Error Handling**
   - Geocoding failures: "Location not found. Please check the address."
   - Permission denied: "Location permission denied. Please use manual input."
   - Position unavailable: "Location unavailable"
   - Timeout: "Location request timed out"
   - No API key: Graceful degradation (shows coordinates only)

## Integration with Recruiting Component

**Modified:** `src/components/Recruiting.tsx`

### Changes Made

1. **New State Management**
   ```typescript
   const [locationFilter, setLocationFilter] = useState<LocationFilter>({
     locationText: '',
     lat: null,
     lng: null,
     radiusMiles: 25
   })
   ```

2. **Distance Calculation**
   - Implements Haversine formula for accurate distance calculation
   - Calculates distance in miles between two lat/lng coordinates

3. **Filtering Logic**
   - Stores unfiltered places from Google Places API
   - Applies location-based filtering client-side
   - Re-filters when location or radius changes (without re-querying API)

4. **UI Enhancements**
   - Location filter panel at top of filters
   - Distance badge on each result showing miles from location
   - Smart messaging:
     - "No results within X miles of [location]" when filtered out
     - "Add a location to narrow results" hint when no location set

5. **Performance Optimization**
   - Only re-geocodes when user clicks "Apply"
   - Filters existing results client-side (no API calls)
   - Debounces geolocation requests (5-minute cache)

## User Flow

### Basic Usage

1. User enters location (e.g., "Seattle, WA")
2. Clicks "Apply" to geocode
3. System validates location and shows confirmation
4. Search results are automatically filtered by distance
5. Each result shows distance in miles

### Using Geolocation

1. User clicks "📍 Use my location"
2. Browser prompts for permission
3. System gets GPS coordinates
4. Reverse geocodes to readable address
5. Results filtered immediately

### Adjusting Radius

1. User changes radius dropdown (5/10/25/50/100 miles)
2. Results re-filter instantly (no API call)
3. Distance badges update

### Clearing Location

1. User clicks "Clear" button
2. Location filter removed
3. Shows all results from map area
4. Hint displayed: "Add a location to narrow results"

## Technical Details

### Geocoding

- Uses Google Maps Geocoding API
- Forward geocoding: address → lat/lng
- Reverse geocoding: lat/lng → address
- Handles multiple address formats (city/state, ZIP, full address)

### Distance Calculation

Haversine formula implementation:
```typescript
function calculateDistance(lat1, lng1, lat2, lng2): number {
  const R = 3959 // Earth's radius in miles
  // ... calculation
  return R * c
}
```

### Data Flow

1. **User Input** → RecruitingSearchFilters
2. **Geocode** → Google Maps API
3. **Update Filter** → Parent component (Recruiting)
4. **Filter Places** → Client-side distance check
5. **Display** → Filtered results with distance badges

### LocalStorage Schema

```json
{
  "locationText": "Seattle, WA",
  "lat": 47.6062,
  "lng": -122.3321,
  "radiusMiles": 25
}
```

## Error Handling

### Geocoding Errors
- Invalid address: Clear error message, keeps input
- Network error: Shows error, allows retry
- API key missing: Graceful degradation

### Geolocation Errors
- Permission denied: Suggests manual input
- Timeout: Clear timeout message
- Unavailable: Fallback message

### Edge Cases
- No location set: Shows hint, displays all results
- Location set but no results in radius: Shows helpful message
- Results outside radius: Filtered out, not displayed

## Future Enhancements (Not Implemented)

- [ ] Autocomplete for location input (Google Places Autocomplete)
- [ ] Map centering on selected location
- [ ] Distance-based sorting (closest first)
- [ ] Custom radius input (not just dropdown)
- [ ] "Expand radius" quick action when no results
- [ ] Location history/favorites
- [ ] Coordinate input support (lat,lng directly)

## Testing Checklist

- [x] Location input geocodes correctly
- [x] Geolocation permission flow works
- [x] Geolocation denial falls back gracefully
- [x] Radius changes filter results
- [x] Distance calculations are accurate
- [x] LocalStorage persistence works
- [x] Clear button resets state
- [x] Error messages display correctly
- [x] Works without API key (graceful degradation)
- [x] No duplicate Google Maps script loads
- [x] Distance badges show on results
- [x] Hint displays when no location

## Integration Notes

The component is designed to be:
- **Standalone**: No dependencies on parent component internals
- **Reusable**: Can be used in other search contexts
- **Type-safe**: Full TypeScript support
- **Accessible**: Keyboard navigation, error announcements
- **Responsive**: Works on mobile and desktop

## Files Changed

1. **Created:**
   - `src/components/RecruitingSearchFilters.tsx` (New component)

2. **Modified:**
   - `src/components/Recruiting.tsx` (Integration)

## Dependencies

No new dependencies required. Uses existing:
- Google Maps JavaScript API (already loaded)
- Browser Geolocation API (built-in)
- LocalStorage API (built-in)
