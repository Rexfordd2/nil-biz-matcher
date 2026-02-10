# Search Migration Guide

## Overview

This guide helps you migrate from the old auto-search pattern to the new manual-trigger pattern. The changes eliminate race conditions and ensure searches only fire on explicit user action.

---

## Breaking Change: usePlacesSearch Hook

### Old API (Auto-search)

```typescript
// ❌ OLD: Auto-fired on every prop change
const { results, loading, error, retry } = usePlacesSearch({
  query: whatText,
  locationText: whereText,
  locationPlaceId: wherePlaceId,
  requestId: reqId
})

// Search happened automatically whenever props changed
```

### New API (Manual trigger)

```typescript
// ✅ NEW: Only fires when explicitly called
const { results, loading, error, search, retry } = usePlacesSearch()

// Must call search() explicitly
await search({
  query: whatText,
  locationText: whereText,
  locationPlaceId: wherePlaceId,
  requestId: reqId
})
```

---

## Migration Steps

### Step 1: Update Hook Call

**Before:**
```typescript
const { results, loading, error, retry } = usePlacesSearch({
  query: searchParams.query,
  locationText: searchParams.locationText
})
```

**After:**
```typescript
const { results, loading, error, search, retry } = usePlacesSearch()
```

### Step 2: Remove Param State (If Using)

If you have a state that triggers searches:

**Before:**
```typescript
const [searchParams, setSearchParams] = useState({
  query: '',
  locationText: ''
})

// This triggered auto-search
setSearchParams({ query: 'pizza', locationText: 'NYC' })
```

**After:**
```typescript
// Just use local state for inputs
const [whatText, setWhatText] = useState('')
const [whereText, setWhereText] = useState('')

// No state that triggers searches
```

### Step 3: Add Button Debouncing

**Add to your component:**
```typescript
const lastClickTimeRef = useRef<number>(0)
const CLICK_COOLDOWN_MS = 500

async function onSearch() {
  // Debounce: prevent double-click spam
  const now = Date.now()
  if (now - lastClickTimeRef.current < CLICK_COOLDOWN_MS) {
    return // Ignore rapid clicks
  }
  lastClickTimeRef.current = now
  
  // ... rest of search logic
}
```

### Step 4: Add Client-Side Validation

**Add validation before calling search:**
```typescript
async function onSearch() {
  // Debounce (from Step 3)
  const now = Date.now()
  if (now - lastClickTimeRef.current < CLICK_COOLDOWN_MS) return
  lastClickTimeRef.current = now
  
  // Validate inputs
  const query = whatText.trim()
  const location = whereText.trim()
  
  if (!query || query.length < 2) {
    setValidationError('Enter at least 2 characters')
    return // Don't call server
  }
  
  if (!location) {
    setValidationError('Enter a location')
    return // Don't call server
  }
  
  setValidationError(null)
  
  // Now call search
  await search({ query, locationText: location })
}
```

### Step 5: Update Button Handler

**Before:**
```typescript
function onSearch() {
  setSearchParams({ query: whatText, locationText: whereText })
}

<Button onClick={onSearch}>Search</Button>
```

**After:**
```typescript
async function onSearch() {
  // Debounce + validate (from Steps 3-4)
  // ...
  
  // Call search explicitly
  await search({
    query: whatText.trim(),
    locationText: whereText.trim(),
    locationPlaceId: wherePlaceId
  })
}

<Button onClick={onSearch} disabled={loading}>
  {loading ? 'Searching...' : 'Search'}
</Button>
```

### Step 6: Add Validation Error Display

**Add validation error state:**
```typescript
const [validationError, setValidationError] = useState<string | null>(null)
```

**Display validation errors:**
```tsx
{validationError && (
  <div className="text-amber-300 text-sm mt-2">
    {validationError}
  </div>
)}
```

---

## Complete Migration Example

### Before (Discover.tsx - Old Pattern)

```typescript
export default function Discover() {
  const [whatText, setWhatText] = useState('')
  const [whereText, setWhereText] = useState('')
  
  // State that triggers auto-search
  const [searchParams, setSearchParams] = useState({
    query: '',
    locationText: ''
  })
  
  // Auto-searches on searchParams change
  const { results, loading, error, retry } = usePlacesSearch(searchParams)
  
  function onSearch() {
    // Setting state triggers auto-search
    setSearchParams({ 
      query: whatText, 
      locationText: whereText 
    })
  }
  
  return (
    <div>
      <Input value={whatText} onChange={e => setWhatText(e.target.value)} />
      <Input value={whereText} onChange={e => setWhereText(e.target.value)} />
      <Button onClick={onSearch}>Search</Button>
      {error && <div>{error}</div>}
      {results.map(r => <div key={r.placeId}>{r.name}</div>)}
    </div>
  )
}
```

### After (Discover.tsx - New Pattern)

```typescript
export default function Discover() {
  const [whatText, setWhatText] = useState('')
  const [whereText, setWhereText] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  
  // Hook with no params - manual trigger only
  const { results, loading, error, search, retry } = usePlacesSearch()
  
  // Debouncing
  const lastClickTimeRef = useRef<number>(0)
  const CLICK_COOLDOWN_MS = 500
  
  async function onSearch() {
    // 1. Debounce
    const now = Date.now()
    if (now - lastClickTimeRef.current < CLICK_COOLDOWN_MS) return
    lastClickTimeRef.current = now
    
    // 2. Validate
    const query = whatText.trim()
    const location = whereText.trim()
    
    setValidationError(null)
    
    if (!query || query.length < 2) {
      setValidationError('Enter at least 2 characters')
      return
    }
    
    if (!location) {
      setValidationError('Enter a location')
      return
    }
    
    // 3. Call search explicitly
    await search({ query, locationText: location })
  }
  
  return (
    <div>
      <Input value={whatText} onChange={e => setWhatText(e.target.value)} />
      <Input value={whereText} onChange={e => setWhereText(e.target.value)} />
      <Button onClick={onSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </Button>
      {validationError && <div className="text-amber-300">{validationError}</div>}
      {error && <div className="text-red-300">{error}</div>}
      {results.map(r => <div key={r.placeId}>{r.name}</div>)}
    </div>
  )
}
```

---

## Common Migration Issues

### Issue 1: Search Not Firing

**Problem:**
```typescript
const { results, loading, error } = usePlacesSearch()
// Missing search function!

function onSearch() {
  // Nothing happens - no search called
}
```

**Fix:**
```typescript
const { results, loading, error, search } = usePlacesSearch()
//                                   ^^^^^^ Add this

async function onSearch() {
  await search({ query, locationText })
}
```

### Issue 2: TypeScript Error "Expected 0 arguments"

**Problem:**
```typescript
// Still using old API
const { results } = usePlacesSearch({ query, locationText })
//                                  ^^^^^^^^^^^^^^^^^^^^^^
// Error: Expected 0 arguments, but got 1
```

**Fix:**
```typescript
// New API takes no arguments
const { results, search } = usePlacesSearch()

// Call search() later
await search({ query, locationText })
```

### Issue 3: Retry Not Working

**Problem:**
```typescript
// Retry calls search but with no params stored
function retry() {
  search({ query, locationText }) // Uses current state, may be stale
}
```

**Fix:**
```typescript
// Hook's retry() remembers last params automatically
const { retry } = usePlacesSearch()

<Button onClick={retry}>Retry</Button>
// No need to pass params - hook remembers
```

### Issue 4: Validation Errors Not Clearing

**Problem:**
```typescript
async function onSearch() {
  if (!query) {
    setValidationError('Enter query')
    return
  }
  // Missing: setValidationError(null)
  await search({ query, locationText })
}
```

**Fix:**
```typescript
async function onSearch() {
  setValidationError(null) // Clear previous errors
  
  if (!query) {
    setValidationError('Enter query')
    return
  }
  
  await search({ query, locationText })
}
```

### Issue 5: Still Auto-Searching

**Problem:**
```typescript
// Left over from old pattern
useEffect(() => {
  if (query && location) {
    search({ query, locationText: location })
  }
}, [query, location])
```

**Fix:**
```typescript
// Remove the useEffect entirely
// Search should only happen on button click
```

---

## Recruiting-Specific Migration

### Before (Recruiting - Auto-search on filter change)

```typescript
function ExplorePanel() {
  const [sport, setSport] = useState('')
  const [locationFilter, setLocationFilter] = useState({ lat: null, lng: null })
  
  // Auto-search on ANY filter change
  useEffect(() => {
    if (searchThisArea) {
      runPlacesSearch(center, zoom)
    }
  }, [sport, level, orgType, locationFilter.lat, locationFilter.lng])
  
  async function runPlacesSearch(center, zoom) {
    const keyword = buildKeyword()
    const result = await placesProxySearch({ 
      q: keyword, 
      location: `${center.lat},${center.lng}` 
    })
    setPlaces(result.results)
  }
}
```

### After (Recruiting - Manual trigger only)

```typescript
function ExplorePanel() {
  const [sport, setSport] = useState('')
  const [locationFilter, setLocationFilter] = useState({ lat: null, lng: null })
  
  // Debouncing
  const lastClickTimeRef = useRef<number>(0)
  const CLICK_COOLDOWN_MS = 500
  
  // NO auto-search useEffect - removed entirely
  
  function refresh() {
    // Debounce
    const now = Date.now()
    if (now - lastClickTimeRef.current < CLICK_COOLDOWN_MS) return
    lastClickTimeRef.current = now
    
    // Manual trigger
    runPlacesSearch(latestCenterRef.current, latestZoomRef.current)
  }
  
  async function runPlacesSearch(center, zoom) {
    // Validate BEFORE calling server
    const keyword = buildKeyword().trim()
    if (!keyword || keyword.length < 2) {
      setError('Select sport, level, or org type to search')
      return
    }
    
    // Abort previous (single-flight)
    try { abortControllerRef.current?.abort() } catch {}
    const ac = new AbortController()
    abortControllerRef.current = ac
    
    // Token gating
    const token = ++searchTokenRef.current
    
    try {
      const result = await placesProxySearch(
        { 
          q: keyword, 
          location: `${center.lat},${center.lng}`,
          radius: Math.round(radiusMeters)
        },
        { signal: ac.signal }
      )
      
      // Check token
      if (token !== searchTokenRef.current) return
      
      setPlaces(result.results)
    } catch (error) {
      if (ac.signal.aborted || token !== searchTokenRef.current) return
      setError(normalizeError(error))
    }
  }
  
  return (
    <div>
      <Select value={sport} onChange={e => setSport(e.target.value)}>
        {/* No auto-search on change */}
      </Select>
      <LocationFilter value={locationFilter} onChange={setLocationFilter}>
        {/* No auto-search on filter change */}
      </LocationFilter>
      <Button onClick={refresh} disabled={loading}>
        Refresh results
      </Button>
    </div>
  )
}
```

---

## Testing After Migration

### Checklist

- [ ] Search does NOT fire when typing in inputs
- [ ] Search does NOT fire when changing filters
- [ ] Search ONLY fires on explicit button click
- [ ] Clicking Search 10 times rapidly sends only 1-2 requests
- [ ] Empty inputs show validation error (no server call)
- [ ] 1-character queries show validation error (no server call)
- [ ] Valid searches execute successfully
- [ ] Retry button works (uses remembered params)
- [ ] Location filter can be set without triggering search
- [ ] Browser DevTools shows cancelled requests for rapid clicks

### Manual Test Script

1. **Test: No auto-search**
   - Type in search inputs
   - Change filters
   - Verify: No network requests

2. **Test: Validation**
   - Click Search with empty input → validation error shown
   - Click Search with 1 char → validation error shown
   - Click Search with 2+ chars → request sent

3. **Test: Debouncing**
   - Click Search button 10 times rapidly
   - Check Network tab
   - Verify: Only 1-2 requests sent, rest show "cancelled"

4. **Test: Location filter**
   - Set location filter
   - Verify: No auto-search
   - Click Search
   - Verify: Request uses filter location

5. **Test: Retry**
   - Perform search
   - Get error (simulate by turning off network)
   - Click Retry
   - Verify: Same params used

---

## Rollback Plan

If issues occur:

### Option 1: Revert Hook Only

```bash
git checkout HEAD~1 -- src/hooks/usePlacesSearch.ts
# Keep other changes
```

### Option 2: Full Revert

```bash
git revert HEAD
git push
```

### Option 3: Temporary Fix (Old API Compatibility)

Add wrapper function:

```typescript
// Temporary shim for old API
function usePlacesSearchLegacy(params: SearchParams) {
  const { results, loading, error, search } = usePlacesSearch()
  
  useEffect(() => {
    if (params.query && params.locationText) {
      search(params)
    }
  }, [params.query, params.locationText])
  
  return { results, loading, error }
}

// Use in components still using old API
const { results, loading, error } = usePlacesSearchLegacy({ 
  query: whatText, 
  locationText: whereText 
})
```

**Warning:** This re-introduces race conditions. Only use temporarily.

---

## Support

For help with migration:
1. Check `SEARCH_PATTERNS_QUICK_REF.md` for examples
2. Check `CLIENT_SEARCH_HARDENING_SUMMARY.md` for details
3. Review browser DevTools Network tab for request behavior
4. Check for TypeScript errors (compile-time safety)

---

**Status:** Ready for migration ✅  
**Breaking Changes:** Yes (usePlacesSearch API)  
**TypeScript Safety:** Yes (errors at compile time)  
**Rollback:** Straightforward (git revert or manual restore)
