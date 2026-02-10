# Universal Retry Implementation ✅

## Summary

Discover and Recruiting now have consistent, universal retry functionality that stores and replays the exact last search request.

## Implementation

### Discover (Already Complete) ✅

**Location:** `src/hooks/usePlacesSearch.ts`

```typescript
// Stores last search params
const lastParamsRef = useRef<SearchParams | null>(null)

// Store on search
lastParamsRef.current = params

// Retry replays exact same search
const retry = useCallback(() => {
  if (lastParamsRef.current) {
    search(lastParamsRef.current)
  }
}, [search])
```

**UI:** `src/components/Discover.tsx` (line 279)
```tsx
<Button variant="secondary" onClick={retry} disabled={loading}>
  Retry
</Button>
```

### Recruiting (Now Complete) ✅

**Location:** `src/components/Recruiting.tsx`

**Stores last search params:**
```typescript
// New ref to store exact search params
const lastSearchParamsRef = useRef<{ q: string; location?: string; radius?: number } | null>(null)

// Store params before each search
lastSearchParamsRef.current = { ...searchParams }
```

**Retry function replays exact call:**
```typescript
function retry() {
  if (!lastSearchParamsRef.current) {
    refresh() // Fallback if no last search
    return
  }
  
  // Debounce to prevent spam
  const now = Date.now()
  if (now - lastClickTimeRef.current < CLICK_COOLDOWN_MS) return
  lastClickTimeRef.current = now
  
  // Cancel in-flight requests
  abortControllerRef.current?.abort()
  const ac = new AbortController()
  abortControllerRef.current = ac
  const token = ++searchTokenRef.current
  
  // Replay exact same search with stored params
  placesProxySearch(
    lastSearchParamsRef.current, // Exact same params
    {
      signal: ac.signal,
      requestId: generateRequestId(),
      feature: 'recruiting',
      userAction: 'retry'
    }
  )
  // ... handle results/errors
}
```

**UI:** Already connected (line 607)
```tsx
<Button 
  variant="secondary" 
  onClick={retry} 
  disabled={loading}
>
  Retry
</Button>
```

## Behavior

### When Retry is Clicked

1. **Debounce check** - Prevents spam clicks (500ms cooldown)
2. **Abort in-flight requests** - Cancels any active search
3. **Increment token** - Single-flight enforcement
4. **Replay exact params** - Uses stored `lastSearchParamsRef.current`
5. **Call placesProxySearch** - Same function, same params as original
6. **Handle results** - Updates UI with new results or error

### What Gets Stored

**Discover:**
```typescript
{
  query: "pizza",
  locationText: "New York, NY",
  locationPlaceId: "ChIJOwg_06VPwokRYv534QaPC8g",
  requestId: "req_abc123"
}
```

**Recruiting:**
```typescript
{
  q: "soccer club",
  location: "40.7128,-74.0060", // Optional
  radius: 40234 // Optional, only with location
}
```

### Retry vs Refresh

| Action | Discover | Recruiting |
|--------|----------|------------|
| **Retry** | Replays exact last search with same params | Replays exact last search with same params |
| **Refresh** | N/A (only retry) | New search with current map center/zoom |
| **Search** | User clicks Search button | User clicks "Refresh results" button |

## Error Handling

### When Error Occurs

1. Error is shown to user with message
2. Retry button is displayed
3. Last search params are stored in ref
4. Loading state is disabled on retry button

### When Retry is Clicked

1. Same params are sent to `/api/places-search`
2. If successful → Results update, error clears
3. If error again → New error shown, retry still available
4. If retryable error + has last good results → Shows stale banner

### Stale Results Behavior

If retry fails with a retryable error (OVER_QUERY_LIMIT, NETWORK, etc.) and there are cached results:
- Shows last known good results
- Displays stale banner: "⚠️ Showing last known good results"
- Retry button still available

## UI Consistency

### Discover Error UI
```tsx
{error && (
  <div className={`text-sm ${isStale ? 'text-amber-300' : 'text-red-300'}`}>
    <div className="flex items-center justify-between gap-2">
      <span>{isStale ? '⚠️ Showing cached results — ' : ''}{error}</span>
      <Button variant="secondary" onClick={retry} disabled={loading}>
        Retry
      </Button>
    </div>
  </div>
)}
```

### Recruiting Error UI
```tsx
{error && (
  <div className={`${isStale ? 'text-amber-600' : 'text-red-600'}`}>
    <div className="text-sm flex items-center justify-between gap-2">
      <span>
        {isStale ? '⚠️ ' : '❌ '}{error}
        {isStale && <span>(Showing last known good results)</span>}
      </span>
      <Button 
        variant="secondary" 
        onClick={retry} 
        disabled={loading}
      >
        Retry
      </Button>
    </div>
  </div>
)}
```

## Testing

### Manual Test - Discover
1. Search for "pizza" in "New York, NY"
2. Simulate error (disconnect network temporarily)
3. Click Retry button
4. Verify: Same params sent (`q=pizza&location=New York, NY`)

### Manual Test - Recruiting
1. Set sport "soccer", location "Los Angeles, CA"
2. Click "Refresh results"
3. Simulate error
4. Click Retry button
5. Verify: Same params sent (`q=soccer club&location=34.0522,-118.2437&radius=40234`)

### Manual Test - Retry Spam Protection
1. Trigger error in either component
2. Rapidly click Retry button 10 times
3. Verify: Only 1 request sent (500ms debounce works)

## Benefits

1. ✅ **Consistent UX** - Same retry behavior in Discover and Recruiting
2. ✅ **Exact replay** - Retries with identical params, not current state
3. ✅ **No spam** - Debounced to prevent multiple rapid retries
4. ✅ **Single-flight** - Cancels in-flight requests before retry
5. ✅ **Disabled during loading** - Button disabled while request is active
6. ✅ **Observable** - Retry action logged with 'retry' userAction

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `src/hooks/usePlacesSearch.ts` | Already had retry implementation | ✅ Complete |
| `src/components/Discover.tsx` | Already had retry button | ✅ Complete |
| `src/components/Recruiting.tsx` | Added lastSearchParamsRef + retry() function | ✅ Updated |
| `RETRY_IMPLEMENTATION.md` | Documentation | ✅ New |

## Code Locations

**Discover Retry:**
- Storage: `src/hooks/usePlacesSearch.ts` line 49 (`lastParamsRef`)
- Function: `src/hooks/usePlacesSearch.ts` lines 164-168 (`retry`)
- UI Button: `src/components/Discover.tsx` line 279

**Recruiting Retry:**
- Storage: `src/components/Recruiting.tsx` line 147 (`lastSearchParamsRef`)
- Store Logic: `src/components/Recruiting.tsx` line 297 (stores params)
- Function: `src/components/Recruiting.tsx` lines 434-545 (`retry`)
- UI Button: `src/components/Recruiting.tsx` line 607

## Observability

Both components log retry actions:

```typescript
Observability.log({
  feature: 'discover' | 'recruitment',
  route: 'ui.discover.retry' | 'ui.explore_map.retry',
  status: 'start',
  requestId,
  meta: { query, location, radius }
})
```

This allows tracking retry success rates and retry patterns.
