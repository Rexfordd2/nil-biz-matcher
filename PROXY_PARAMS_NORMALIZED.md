# Proxy Parameter Normalization ✅

## Summary

The Places Search proxy client now uses normalized parameter names consistently.

## Implementation

### Client (src/lib/google/placesProxy.ts)

**Always uses `q` parameter:**
```typescript
const qs = new URLSearchParams()
qs.set('q', normalizedQuery)  // Always 'q', never 'query'
```

**URL format:**
```
/api/places-search?q=pizza&location=New+York&radius=25000
```

### Server (api/places-search.ts)

**Accepts both `q` (normalized) and `query` (legacy) for backward compatibility:**
```typescript
// Parse query params safely
// BACKWARD COMPATIBILITY: Accept both 'q' (normalized) and 'query' (legacy)
// Client always sends 'q', but we accept 'query' for backward compatibility
q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim()
```

## Verification

### Client Verification
```bash
# Search for any use of 'query' parameter in client code
grep -r "searchParams.set.*query" src/
# Result: No matches (only 'q' is used)
```

### Server Verification
```bash
# Verify server accepts both parameters
grep "searchParams.get.*query" api/places-search.ts
# Result: Accepts both 'q' and 'query'
```

### Direct API Calls
Only one place in the codebase calls `/api/places-search` directly:
- `src/lib/google/placesProxy.ts` line 97
- Uses `qs.toString()` which always includes `q=...`

## Parameter Reference

| Parameter | Client | Server | Notes |
|-----------|--------|--------|-------|
| `q` | ✅ Always | ✅ Primary | Normalized query parameter |
| `query` | ❌ Never | ✅ Fallback | Legacy support only |
| `location` | ✅ Optional | ✅ Optional | Location text or lat,lng |
| `radius` | ✅ Optional | ✅ Optional | Search radius in meters |

## Examples

### Client Request (Normalized)
```
GET /api/places-search?q=soccer+club&location=40.7128,-74.0060&radius=25000
```

### Server Accepts (Backward Compatible)
```
GET /api/places-search?query=soccer+club&location=New+York&radius=25000
```
✅ Works (legacy support)

```
GET /api/places-search?q=soccer+club&location=New+York&radius=25000
```
✅ Works (normalized)

## Changes Made

1. Added explicit comment in `placesProxy.ts` documenting `q` parameter usage
2. Added explicit comment in `places-search.ts` documenting backward compatibility
3. Verified no other code uses the old `query` parameter

## Testing

All existing tests pass - no breaking changes since server still accepts both formats.

### Manual Test
```bash
# Test normalized format (what client sends)
curl "http://localhost:5173/api/places-search?q=pizza&location=New+York&radius=5000"

# Test legacy format (backward compatibility)
curl "http://localhost:5173/api/places-search?query=pizza&location=New+York&radius=5000"
```

Both should return identical results.
