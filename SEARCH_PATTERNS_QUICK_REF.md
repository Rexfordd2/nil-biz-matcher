# Search Patterns - Quick Reference

## TL;DR: How to Use the New Search Pattern

### Discover Pattern

```typescript
// 1. Initialize hook (no params)
const { results, loading, error, search, retry } = usePlacesSearch()

// 2. Add button debouncing
const lastClickTimeRef = useRef<number>(0)
const CLICK_COOLDOWN_MS = 500

// 3. Create search handler
async function onSearch() {
  // Debounce
  const now = Date.now()
  if (now - lastClickTimeRef.current < CLICK_COOLDOWN_MS) return
  lastClickTimeRef.current = now
  
  // Validate client-side
  const query = whatText.trim()
  const location = whereText.trim()
  
  if (!query || query.length < 2) {
    setValidationError('Enter at least 2 characters')
    return
  }
  
  if (!location) {
    setValidationError('Enter a location')
    return
  }
  
  // Call search explicitly
  await search({ query, locationText: location })
}

// 4. Button onClick
<Button onClick={onSearch} disabled={loading}>
  {loading ? 'Searching...' : 'Search'}
</Button>
```

### Recruiting Pattern (Direct Proxy Call)

```typescript
// 1. Add refs for single-flight and debouncing
const abortControllerRef = useRef<AbortController | null>(null)
const searchTokenRef = useRef<number>(0)
const lastClickTimeRef = useRef<number>(0)
const CLICK_COOLDOWN_MS = 500

// 2. Create search function
async function runSearch() {
  // Debounce
  const now = Date.now()
  if (now - lastClickTimeRef.current < CLICK_COOLDOWN_MS) return
  lastClickTimeRef.current = now
  
  // Validate
  const keyword = buildKeyword().trim()
  if (!keyword || keyword.length < 2) {
    setError('Enter search criteria')
    return
  }
  
  // Abort previous (single-flight)
  try { abortControllerRef.current?.abort() } catch {}
  
  // New request
  const ac = new AbortController()
  abortControllerRef.current = ac
  const token = ++searchTokenRef.current
  
  setLoading(true)
  
  try {
    const result = await placesProxySearch(
      { q: keyword, location: `${lat},${lng}`, radius: 25000 },
      { signal: ac.signal }
    )
    
    // Token gating
    if (token !== searchTokenRef.current) return
    
    setResults(result.results)
  } catch (error) {
    // Ignore aborted
    if (ac.signal.aborted || token !== searchTokenRef.current) return
    setError(normalizeError(error))
  } finally {
    if (token === searchTokenRef.current) setLoading(false)
  }
}
```

---

## Key Principles

### 1. No Auto-Search ❌
```typescript
// ❌ BAD: Auto-fires on every state change
useEffect(() => {
  if (query && location) {
    searchPlaces(query, location)
  }
}, [query, location])

// ✅ GOOD: Only fires on explicit button click
<Button onClick={handleSearch}>Search</Button>
```

### 2. Button Debouncing ✅
```typescript
// ✅ REQUIRED: 500ms cooldown
const lastClickTimeRef = useRef<number>(0)
const CLICK_COOLDOWN_MS = 500

function handleClick() {
  const now = Date.now()
  if (now - lastClickTimeRef.current < CLICK_COOLDOWN_MS) {
    return // Ignore rapid clicks
  }
  lastClickTimeRef.current = now
  
  // ... proceed with action
}
```

### 3. Client-Side Validation ✅
```typescript
// ✅ REQUIRED: Validate before calling server
async function handleSearch() {
  const query = input.trim()
  
  // Validate length
  if (!query || query.length < 2) {
    setValidationError('Enter at least 2 characters')
    return // Don't call server
  }
  
  // Validate location
  if (!location) {
    setValidationError('Enter a location')
    return // Don't call server
  }
  
  // Clear validation error
  setValidationError(null)
  
  // Now call server
  await search({ query, locationText: location })
}
```

### 4. Single-Flight Enforcement ✅
```typescript
// ✅ REQUIRED: Abort previous request
const abortControllerRef = useRef<AbortController | null>(null)

async function search() {
  // Abort previous
  if (abortControllerRef.current) {
    try { abortControllerRef.current.abort() } catch {}
  }
  
  // Create new
  const ac = new AbortController()
  abortControllerRef.current = ac
  
  try {
    const response = await fetch('/api/search', { signal: ac.signal })
    // ...
  } catch (error) {
    if (ac.signal.aborted) return // Ignore aborted
    // Handle error
  }
}
```

### 5. Token Gating (Last-Wins) ✅
```typescript
// ✅ REQUIRED: Ignore stale responses
const requestTokenRef = useRef<number>(0)

async function search() {
  const token = ++requestTokenRef.current
  
  try {
    const result = await fetchData()
    
    // Ignore if not latest
    if (token !== requestTokenRef.current) return
    
    setState(result)
  } catch (error) {
    // Ignore if not latest
    if (token !== requestTokenRef.current) return
    
    setError(error)
  }
}
```

### 6. Param Normalization ✅
```typescript
// ✅ REQUIRED: Always trim and validate params
const normalizedQuery = (params.q || '').trim()
const normalizedLocation = params.location ? params.location.trim() : undefined
const normalizedRadius = typeof params.radius === 'number' ? params.radius : 25000

// Never send:
// - undefined strings: "undefined"
// - empty strings after trim: ""
// - null values without defaults

// Always send:
// - Trimmed strings
// - Numeric values (not string numbers)
// - Safe defaults for missing values
```

---

## Common Patterns

### Pattern: Search on Button Click
```typescript
const { results, loading, error, search } = usePlacesSearch()
const [query, setQuery] = useState('')
const lastClickRef = useRef(0)

async function handleSearch() {
  // Debounce
  if (Date.now() - lastClickRef.current < 500) return
  lastClickRef.current = Date.now()
  
  // Validate
  if (!query.trim() || query.trim().length < 2) {
    setError('Enter at least 2 characters')
    return
  }
  
  // Search
  await search({ query: query.trim(), locationText: location.trim() })
}

return (
  <div>
    <Input value={query} onChange={e => setQuery(e.target.value)} />
    <Button onClick={handleSearch} disabled={loading}>Search</Button>
  </div>
)
```

### Pattern: Retry Last Search
```typescript
const { retry, loading } = usePlacesSearch()

return (
  <Button onClick={retry} disabled={loading}>
    Retry
  </Button>
)
// Hook remembers last params automatically
```

### Pattern: Location Filter (Don't Auto-Search)
```typescript
const [locationFilter, setLocationFilter] = useState({ lat: null, lng: null })

// ❌ DON'T: Auto-search on filter change
// useEffect(() => { search() }, [locationFilter])

// ✅ DO: Let user set filter, then click Search button
<LocationFilter value={locationFilter} onChange={setLocationFilter} />
<Button onClick={handleSearch}>Search</Button>
```

### Pattern: Map Idle Search (Optional, User-Controlled)
```typescript
const [searchThisArea, setSearchThisArea] = useState(false)

function handleMapIdle(center, zoom) {
  // Only search if user enabled it
  if (searchThisArea) {
    // Still validate before searching
    const keyword = buildKeyword().trim()
    if (keyword && keyword.length >= 2) {
      runSearch(center, zoom)
    }
  }
}

return (
  <div>
    <label>
      <input 
        type="checkbox" 
        checked={searchThisArea} 
        onChange={e => setSearchThisArea(e.target.checked)} 
      />
      Search this map area
    </label>
    <Map onIdle={handleMapIdle} />
  </div>
)
```

---

## Anti-Patterns (Don't Do This)

### ❌ Auto-Search on Input Change
```typescript
// ❌ NEVER: Creates race conditions
useEffect(() => {
  search({ query: whatText, locationText: whereText })
}, [whatText, whereText])
```

### ❌ No Debouncing
```typescript
// ❌ NEVER: Allows double-click spam
<Button onClick={() => search(query)}>Search</Button>
```

### ❌ No Client-Side Validation
```typescript
// ❌ NEVER: Wastes server resources
async function handleSearch() {
  // Missing validation - calls server even for ""
  await search({ query: whatText, locationText: whereText })
}
```

### ❌ Multiple In-Flight Requests
```typescript
// ❌ NEVER: Causes race conditions
async function handleSearch() {
  // Missing abort - previous request still running
  const result = await fetch('/api/search')
  setState(result)
}
```

### ❌ No Token Gating
```typescript
// ❌ NEVER: Stale results overwrite fresh ones
async function search() {
  const result = await fetchData()
  // Missing token check - old results can overwrite new
  setState(result)
}
```

### ❌ Sending Undefined/Empty Strings
```typescript
// ❌ NEVER: Sends "undefined" as string
await search({ 
  query: whatText, // Could be undefined → "undefined"
  location: whereText // Could be "" → empty string
})

// ✅ ALWAYS: Normalize first
await search({
  query: (whatText || '').trim(),
  location: whereText ? whereText.trim() : undefined
})
```

---

## Debugging Checklist

### Issue: Multiple requests sent on single click
- [ ] Check for button debouncing (500ms cooldown)
- [ ] Check for abort controller (single-flight)
- [ ] Check browser DevTools Network tab (should see cancelled requests)

### Issue: Stale results overwriting fresh results
- [ ] Check for token gating (last-wins pattern)
- [ ] Check that token check happens AFTER async call
- [ ] Check that token is incremented BEFORE async call

### Issue: Validation errors not showing
- [ ] Check that validation happens before `search()` call
- [ ] Check that validation error state is separate from search error
- [ ] Check that validation error is cleared on successful validation

### Issue: Search fires automatically
- [ ] Remove any `useEffect` that calls search
- [ ] Check that search only called on explicit button click
- [ ] Check for unintended event handlers (onChange, onBlur, etc.)

### Issue: Location filter triggers search
- [ ] Remove `useEffect` with location filter in deps
- [ ] Ensure search only called on button click
- [ ] Check that filter setState doesn't trigger search

---

## Quick Reference Table

| Requirement | Implementation | Location |
|-------------|----------------|----------|
| No auto-search | Remove useEffect, only call on button click | Component |
| Button debounce | 500ms cooldown with lastClickTimeRef | Component |
| Client validation | Check length/empty before calling search | Component |
| Single-flight | Abort previous with AbortController | Hook/Component |
| Token gating | Increment token, check after async | Hook/Component |
| Param normalization | Trim strings, default numbers | placesProxy |

---

## Testing Guide

### Manual Test: 10 Consecutive Searches

1. Open Discover page
2. Enter "pizza" and "New York, NY"
3. Click Search button 10 times rapidly (as fast as possible)
4. Open browser DevTools → Network tab
5. Verify:
   - ✅ Only 1-2 requests sent (rest blocked by debounce)
   - ✅ Previous requests show "cancelled" status
   - ✅ Final results match last request
   - ✅ No error state from aborted requests

### Manual Test: Validation

1. Open Discover page
2. Leave "What" input empty
3. Click Search
4. Verify: ✅ Validation error shown, no network request
5. Enter "p" (1 char)
6. Click Search
7. Verify: ✅ Validation error shown, no network request
8. Enter "pi" (2 chars)
9. Click Search
10. Verify: ✅ Network request sent

### Manual Test: Location Filter (Recruiting)

1. Open Recruiting → Explore
2. Select sport "soccer"
3. Set location filter to "Austin, TX, 50 miles"
4. Verify: ✅ No search fires automatically
5. Click "Refresh results"
6. Verify: ✅ Search uses location filter (check Network tab params)

---

**Quick Links:**
- Implementation: `CLIENT_SEARCH_HARDENING_SUMMARY.md`
- Server hardening: `GOOGLE_PLACES_HARDENING_SUMMARY.md`
- Deployment: `PLACES_PROXY_DEPLOYMENT_GUIDE.md`
