# Google Maps - Quick Reference Card

## 🎯 Golden Rules

1. **ALWAYS** use `loadGoogleMaps()` - never load script directly
2. **ALWAYS** `await loadGoogleMaps()` before using Google APIs
3. **ALWAYS** pass `AbortSignal` to search functions
4. **ALWAYS** check `aborted` status after `await`
5. **NEVER** block input fields during loading

## 📦 Import Paths

```typescript
// Core loader
import { loadGoogleMaps, isGoogleMapsReady, hasGoogleMapsKey } from '../lib/google/maps'

// Search utilities
import { textSearch, getPlaceDetails } from '../lib/google/maps'

// Custom hooks
import { usePlacesSearch } from '../hooks/usePlacesSearch'
import { usePlaceDetails } from '../hooks/usePlaceDetails'
```

## 🔄 Standard Search Pattern

```typescript
async function search() {
  // Cancel prior
  abortRef.current?.abort()
  const ac = new AbortController()
  abortRef.current = ac
  const token = ++tokenRef.current
  
  try {
    // Load & check
    const google = await loadGoogleMaps()
    if (ac.signal.aborted || token !== tokenRef.current) return
    
    // Search & check
    const results = await textSearch(request, ac.signal)
    if (ac.signal.aborted || token !== tokenRef.current) return
    
    // Update state
    setResults(results)
  } catch (e) {
    if (ac.signal.aborted) return
    if (token !== tokenRef.current) return
    setError(e.message)
  }
}
```

## 🎨 UI Patterns

### Input Fields
```typescript
// ✅ Correct - always editable
<Input disabled={false} />

// ❌ Wrong - blocks typing
<Input disabled={loading} />
```

### Submit Buttons
```typescript
// ✅ Correct - disable until ready
<Button disabled={!hasGoogleMapsKey || loading}>Search</Button>

// ✅ Also correct - with user input validation
<Button disabled={!hasGoogleMapsKey || loading || !query.trim()}>
  {loading ? 'Searching...' : 'Search'}
</Button>
```

### Error Display
```typescript
{error && (
  <div>
    <span>{error}</span>
    <Button onClick={retry} disabled={loading}>Retry</Button>
    {import.meta.env.DEV && (
      <div>Debug: {JSON.stringify(debugInfo)}</div>
    )}
  </div>
)}
```

## 🛠️ Common Tasks

### Check if Google Maps Available
```typescript
import { hasGoogleMapsKey } from '../lib/google/maps'

if (!hasGoogleMapsKey) {
  return <GoogleMapsDisabledNotice />
}
```

### Initialize Autocomplete
```typescript
useEffect(() => {
  loadGoogleMaps().then(google => {
    if (!inputRef.current) return
    const ac = new google.maps.places.Autocomplete(inputRef.current)
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      onPlaceSelect(place)
    })
  })
}, [])
```

### Geocode Address
```typescript
async function geocode(address: string) {
  const google = await loadGoogleMaps()
  const geocoder = new google.maps.Geocoder()
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        resolve(results[0].geometry.location)
      } else {
        reject(new Error(`Geocoding failed: ${status}`))
      }
    })
  })
}
```

### Text Search
```typescript
import { textSearch } from '../lib/google/maps'

const results = await textSearch({
  query: 'pizza',
  location: new google.maps.LatLng(lat, lng),
  radius: 5000
}, abortSignal)
```

### Get Place Details
```typescript
import { getPlaceDetails } from '../lib/google/maps'

const details = await getPlaceDetails(
  placeId,
  ['name', 'formatted_address', 'website'],
  abortSignal
)
```

## 🐛 Debugging

### Check Loader Status
```typescript
import { getGoogleMapsStatus } from '../lib/google/maps'

console.log(getGoogleMapsStatus())
// { ready: true, loading: false, error: null }
```

### Inspect Script Tag
```javascript
// Browser console
document.getElementById('google-maps-js')
```

### Monitor Requests
```typescript
// Add to component
useEffect(() => {
  console.log('Search started', { query, location })
  return () => console.log('Search cleanup')
}, [query, location])
```

## ⚠️ Common Mistakes

### ❌ Using window.google directly
```typescript
// WRONG
if (window.google) {
  const map = new window.google.maps.Map(...)
}

// CORRECT
const google = await loadGoogleMaps()
const map = new google.maps.Map(...)
```

### ❌ Not checking abort status
```typescript
// WRONG
const results = await textSearch(request)
setResults(results)  // Might be stale!

// CORRECT
const results = await textSearch(request, ac.signal)
if (ac.signal.aborted) return
setResults(results)
```

### ❌ Blocking input during load
```typescript
// WRONG
<Input disabled={loading || !ready} />

// CORRECT
<Input disabled={false} />
<Button disabled={loading || !ready} />
```

### ❌ Search on every keystroke
```typescript
// WRONG
<Input onChange={e => search(e.target.value)} />

// CORRECT
<Input onChange={e => setQuery(e.target.value)} />
<Button onClick={() => search(query)} />
```

### ❌ Multiple script loads
```typescript
// WRONG
const script = document.createElement('script')
script.src = 'https://maps.googleapis.com/...'

// CORRECT
await loadGoogleMaps()
```

## 📋 Checklist for New Features

- [ ] Import `loadGoogleMaps` from correct path
- [ ] Check `hasGoogleMapsKey` before showing UI
- [ ] `await loadGoogleMaps()` before using APIs
- [ ] Create AbortController for searches
- [ ] Pass `signal` to async operations
- [ ] Check `aborted` after each `await`
- [ ] Use request tokens for race conditions
- [ ] Clean up AbortController in useEffect
- [ ] Keep input fields always editable
- [ ] Show loading state on buttons only
- [ ] Handle errors with retry button
- [ ] Add debug info in DEV mode
- [ ] Test 10+ times for reliability

## 🎓 Learning Resources

- `src/lib/google/loader.ts` - Singleton implementation
- `src/hooks/usePlacesSearch.ts` - Search hook pattern
- `src/components/Discover.tsx` - Full integration example
- `GOOGLE_MAPS_SEARCH_FIX.md` - Detailed changes
- `GOOGLE_MAPS_ARCHITECTURE.md` - Architecture guide
- `GOOGLE_MAPS_SEARCH_TEST_CHECKLIST.md` - Testing guide

## 📞 Help

### If search fails intermittently:
1. Check if using AbortController
2. Verify token-based request tracking
3. Ensure await before using google object
4. Test with network throttling

### If inputs are blocked:
1. Check `disabled` prop on Input
2. Should be `disabled={false}` always
3. Only buttons should be disabled during load

### If seeing race conditions:
1. Add request token pattern
2. Check token after each await
3. Return early if token changed

### If seeing multiple script tags:
1. Remove any manual script creation
2. Always use `loadGoogleMaps()`
3. Check for double imports

## 💡 Pro Tips

- Use `import.meta.env.DEV` for debug output
- Log request IDs for tracking async flows
- Keep a reference to AbortController in useRef
- Use request tokens for complex async chains
- Test with slow 3G network throttling
- Monitor memory with 20+ consecutive searches
- Check browser console for Google Maps errors
