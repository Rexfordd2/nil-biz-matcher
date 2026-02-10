# Google Maps Architecture - Developer Reference

## Overview
This document describes the centralized Google Maps loading architecture and search patterns used throughout the application.

## Core Principle
**ONE LOADER TO RULE THEM ALL**

All Google Maps functionality flows through a single singleton loader. No component should ever:
- Load the Google Maps script directly
- Create script tags manually
- Check `window.google` directly

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                     Components                           │
│  (Discover, Recruiting, RecruitingSearchFilters)        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                  Custom Hooks                            │
│       (usePlacesSearch, usePlaceDetails)                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Shared Utilities                            │
│  src/lib/google/maps.ts                                 │
│  - textSearch()                                          │
│  - getPlaceDetails()                                     │
│  - createPlacesService()                                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│           Singleton Loader (SINGLE SOURCE OF TRUTH)      │
│  src/lib/google/loader.ts                               │
│  - loadGoogleMaps() → Promise<google>                   │
│  - isGoogleMapsReady() → boolean                        │
│  - getGoogleMapsStatus() → { ready, loading, error }   │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── lib/
│   └── google/
│       ├── loader.ts          # Singleton loader (NEVER import google directly)
│       └── maps.ts            # Shared utilities (textSearch, getPlaceDetails)
│
├── hooks/
│   ├── usePlacesSearch.ts     # Discover search hook
│   └── usePlaceDetails.ts     # Place details hook
│
└── components/
    ├── Discover.tsx                    # Business discovery UI
    ├── Recruiting.tsx                  # Recruiting explore UI
    └── RecruitingSearchFilters.tsx    # Location filter component
```

## Singleton Loader API

### `loadGoogleMaps(): Promise<typeof google>`
**The ONLY way to access Google Maps API**

```typescript
import { loadGoogleMaps } from '../lib/google/maps'

async function doSomethingWithMaps() {
  try {
    const google = await loadGoogleMaps()
    // Now safe to use google.maps.*
    const geocoder = new google.maps.Geocoder()
  } catch (error) {
    // Handle API key missing or script load failure
  }
}
```

**Thread Safety:**
- Multiple simultaneous calls return the same promise
- Script only loaded once
- Safe to call from multiple components

**Error Handling:**
- Throws if API key not configured
- Throws if script fails to load
- Promise clears on error (allows retry)

### `isGoogleMapsReady(): boolean`
Check if Google Maps is loaded and ready (synchronous)

```typescript
if (isGoogleMapsReady()) {
  // Safe to use window.google.maps
} else {
  // Need to call loadGoogleMaps() first
}
```

### `getGoogleMapsStatus()`
Get current loading status

```typescript
const { ready, loading, error } = getGoogleMapsStatus()

if (loading) {
  // Show loading spinner
} else if (error) {
  // Show error message
} else if (ready) {
  // Can use Maps API
}
```

## Search Pattern (AbortController)

All search operations must follow this pattern to avoid race conditions:

```typescript
function SearchComponent() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestTokenRef = useRef(0)

  async function search() {
    // 1. Cancel prior search
    abortControllerRef.current?.abort()
    
    // 2. Create new controller
    const ac = new AbortController()
    abortControllerRef.current = ac
    const token = ++requestTokenRef.current
    
    try {
      // 3. Load Google Maps (await!)
      const google = await loadGoogleMaps()
      if (ac.signal.aborted || token !== requestTokenRef.current) return
      
      // 4. Perform search (pass signal)
      const results = await textSearch(request, ac.signal)
      if (ac.signal.aborted || token !== requestTokenRef.current) return
      
      // 5. Update state only if still latest
      setResults(results)
      
    } catch (e) {
      // 6. Ignore aborted errors
      if (ac.signal.aborted) return
      if (token !== requestTokenRef.current) return
      
      setError(e.message)
    }
  }
  
  // 7. Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])
}
```

## Anti-Patterns (DO NOT DO)

### ❌ Direct Script Loading
```typescript
// WRONG - Creates duplicate script tags
const script = document.createElement('script')
script.src = 'https://maps.googleapis.com/...'
document.head.appendChild(script)
```

### ❌ Direct Window Access
```typescript
// WRONG - Race condition if script not loaded
if (window.google) {
  const map = new window.google.maps.Map(...)
}
```

### ❌ No Abort Handling
```typescript
// WRONG - Stale results can overwrite new results
async function search() {
  const results = await textSearch(...)
  setResults(results)  // No token check!
}
```

### ❌ Blocking Input During Load
```typescript
// WRONG - User can't type while loading
<Input disabled={loading} />
```

### ❌ Search on Every Keystroke
```typescript
// WRONG - Creates too many requests
<Input onChange={e => search(e.target.value)} />
```

## Correct Patterns

### ✅ Always Await Loader
```typescript
const google = await loadGoogleMaps()
const geocoder = new google.maps.Geocoder()
```

### ✅ Always Pass AbortSignal
```typescript
const results = await textSearch(request, abortSignal)
```

### ✅ Always Check Abort Status
```typescript
if (ac.signal.aborted) return
if (token !== requestTokenRef.current) return
```

### ✅ Never Block Input
```typescript
<Input disabled={false} />  // Always editable
<Button disabled={!ready || loading} />  // Only button disabled
```

### ✅ Search on Submit, Not Type
```typescript
<Input onChange={e => setValue(e.target.value)} />
<Button onClick={search} />
```

## Component Integration Examples

### Example 1: Basic Search
```typescript
import { loadGoogleMaps, textSearch } from '../lib/google/maps'

function MySearchComponent() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  
  async function handleSearch(query: string) {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    
    setLoading(true)
    try {
      await loadGoogleMaps()
      if (ac.signal.aborted) return
      
      const data = await textSearch({ query }, ac.signal)
      if (ac.signal.aborted) return
      
      setResults(data)
    } catch (e) {
      if (!ac.signal.aborted) {
        console.error(e)
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }
  
  return (
    <div>
      <Input onChange={e => setQuery(e.target.value)} />
      <Button onClick={() => handleSearch(query)} disabled={loading}>
        Search
      </Button>
    </div>
  )
}
```

### Example 2: Autocomplete
```typescript
import { loadGoogleMaps } from '../lib/google/maps'

function LocationInput() {
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    let mounted = true
    let listener: google.maps.MapsEventListener | null = null
    
    loadGoogleMaps()
      .then(google => {
        if (!mounted || !inputRef.current) return
        
        const autocomplete = new google.maps.places.Autocomplete(
          inputRef.current,
          { types: ['geocode'] }
        )
        
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (place && mounted) {
            onLocationSelect(place)
          }
        })
      })
      .catch(err => console.error('Autocomplete init failed', err))
    
    return () => {
      mounted = false
      listener?.remove()
    }
  }, [])
  
  return <Input ref={inputRef} />
}
```

### Example 3: Geocoding
```typescript
import { loadGoogleMaps } from '../lib/google/maps'

async function geocodeAddress(address: string): Promise<{lat: number, lng: number} | null> {
  const google = await loadGoogleMaps()
  const geocoder = new google.maps.Geocoder()
  
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const location = results[0].geometry.location
        resolve({
          lat: location.lat(),
          lng: location.lng()
        })
      } else if (status === 'ZERO_RESULTS') {
        resolve(null)
      } else {
        reject(new Error(`Geocoding failed: ${status}`))
      }
    })
  })
}
```

## Error Messages

### User-Facing Errors
- "Search disabled until Google Maps key is configured"
- "Location not found. Please check the address."
- "Server is rate limiting (429)"
- "You're offline"

### Developer Errors (should never see in production)
- "Google Maps API key not configured"
- "Google Places API not available"
- "Failed to load Google Maps script"

## Performance Optimization

### Singleton Benefits
- **One script load**: 50-200ms saved per component
- **Shared promise**: No redundant network requests
- **Memory efficient**: One `google` object reference

### AbortController Benefits
- **Cancelled requests**: Don't update stale state
- **Network savings**: Aborted fetch before completion
- **UX improvement**: No flicker from old results

### Request Token Benefits
- **Race condition prevention**: Out-of-order responses discarded
- **Deterministic state**: Always shows latest query results
- **Simpler debugging**: Request ID in logs

## Testing

### Unit Test Pattern
```typescript
import { loadGoogleMaps } from '../lib/google/maps'

// Mock the loader in tests
jest.mock('../lib/google/maps', () => ({
  loadGoogleMaps: jest.fn(() => Promise.resolve(mockGoogle)),
  isGoogleMapsReady: jest.fn(() => true),
  hasGoogleMapsKey: true
}))
```

### Integration Test Pattern
```typescript
test('search cancels prior request', async () => {
  const { getByTestId } = render(<SearchComponent />)
  
  // Start first search
  fireEvent.click(getByTestId('search-button'))
  
  // Immediately start second search
  fireEvent.change(getByTestId('query-input'), { target: { value: 'new' }})
  fireEvent.click(getByTestId('search-button'))
  
  // Wait for results
  await waitFor(() => {
    expect(getByTestId('results')).toBeInTheDocument()
  })
  
  // Should show second search results only
  expect(getByTestId('query-display')).toHaveTextContent('new')
})
```

## Debugging

### Enable Verbose Logging (DEV mode)
All components log to console in development:
```
[Google Maps] Loading script with libraries=places
[Google Maps] Script loaded successfully with Places API
[Discover] Search started: query=pizza, location=Seattle
[Discover] Search completed: 15 results
```

### Check Status
```typescript
import { getGoogleMapsStatus } from '../lib/google/maps'

console.log('Google Maps Status:', getGoogleMapsStatus())
// { ready: true, loading: false, error: null }
```

### Inspect Script Tag
```javascript
// Browser console
document.getElementById('google-maps-js')
// Should exist exactly once
```

### Check Active Searches
```javascript
// In component
console.log('Active abort controller:', abortControllerRef.current)
console.log('Request token:', requestTokenRef.current)
```

## Migration Guide

### If You Need to Add Google Maps to a New Component

1. **Import the loader**
```typescript
import { loadGoogleMaps, hasGoogleMapsKey } from '../lib/google/maps'
```

2. **Check if key configured**
```typescript
if (!hasGoogleMapsKey) {
  return <GoogleMapsDisabledNotice />
}
```

3. **Load before use**
```typescript
const google = await loadGoogleMaps()
```

4. **Use AbortController for searches**
```typescript
const ac = new AbortController()
const results = await textSearch(request, ac.signal)
```

5. **Handle cleanup**
```typescript
useEffect(() => {
  return () => ac.abort()
}, [])
```

### If You Need to Add a New Search Function

1. Add to `src/lib/google/maps.ts`
2. Accept `AbortSignal` parameter
3. Call `loadGoogleMaps()` first
4. Check `signal.aborted` after async ops
5. Export for components to use

Example:
```typescript
export async function myNewSearch(
  request: MyRequest,
  signal?: AbortSignal
): Promise<MyResult[]> {
  const service = await createPlacesService()
  
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'))
      return
    }
    
    service.mySearch(request, (results, status) => {
      if (signal?.aborted) {
        reject(new Error('Aborted'))
        return
      }
      
      if (status === 'OK') {
        resolve(results)
      } else {
        reject(new Error(`Search failed: ${status}`))
      }
    })
  })
}
```

## Summary

### Key Principles
1. **Single Loader**: Always use `loadGoogleMaps()`
2. **Await First**: Always await before using Google APIs
3. **Abort Prior**: Always cancel old searches before new ones
4. **Check Status**: Always verify not aborted after async
5. **Never Block Input**: Keep inputs editable during load
6. **Search on Submit**: Don't search on every keystroke

### Common Gotchas
- Forgetting to pass `AbortSignal` to async operations
- Not checking `aborted` status after `await`
- Blocking input fields during loading
- Creating multiple script tags
- Using `window.google` directly

### When in Doubt
- Read `src/lib/google/loader.ts` for loader pattern
- Read `src/hooks/usePlacesSearch.ts` for search pattern
- Read `src/components/Discover.tsx` for integration pattern
- Check test checklist for expected behaviors
