# Places Search Crash-Proof Fix

**Date:** 2026-02-06  
**Target:** `api/places-search.ts`  
**Issue:** Vercel FUNCTION_INVOCATION_FAILED errors

## Changes Made

### 1. Top-Level Crash-Proof Wrapper ✅
- Wrapped entire handler in comprehensive try/catch
- Nothing can escape uncaught
- Fatal errors logged with full stack traces
- Returns structured JSON error response with:
  - `ok: false`
  - `code: "SERVER_ERROR"`
  - `userMessage: "Search temporarily unavailable. Please try again."`
  - `httpStatus: 500`
  - `requestId` from `x-vercel-id` header
  - `devDetails` with message and stack

### 2. Hardened Request Parsing for Vercel ✅
- **DO NOT** assume `req.query` exists
- Parse all params safely from URL:
  ```typescript
  const url = new URL(req.url || '/', `https://${host}`)
  const q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim()
  const location = (url.searchParams.get('location') || '').trim()
  const radius = Number(radiusRaw)
  ```
- Wrapped URL parsing in try/catch
- Returns 400 INVALID_REQUEST if URL parsing fails

### 3. Early Validation with Proper Error Responses ✅
- Query validation: `q.length < 2` → 400 INVALID_REQUEST
- Radius validation: defaults to 25000 if NaN
- API key check: returns 500 MISSING_SERVER_KEY if missing
- **Never throws** - always returns JSON

### 4. Environment Variable Safety ✅
- Check `process.env.GOOGLE_MAPS_API_KEY` early
- Returns structured JSON error if missing
- Never throws uncaught error

### 5. Internal Helpers Hardened ✅
- `geocodeAddress()`: Wrapped in try/catch
- All Google API calls wrapped in try/catch
- Structured error returns for:
  - `REQUEST_DENIED` → 502 KEY_RESTRICTED
  - `OVER_QUERY_LIMIT` → 429 with Retry-After
  - `ZERO_RESULTS` → 200 ok:true results:[]
  - Network errors → proper error response

### 6. Health Check Endpoint ✅
- Added ping endpoint: `?ping=1`
- Returns:
  ```json
  {
    "ok": true,
    "ping": "pong",
    "ts": "2026-02-06T19:12:20.472Z",
    "hasKey": true,
    "requestId": "..."
  }
  ```

### 7. Comprehensive Runtime Logging ✅
Added detailed console.log statements throughout:
- Request received (method, url, headers)
- Method validation
- URL parsing
- Query params parsed
- API key verification
- Location resolution (lat/lng or geocode)
- Cache checks (persistent and memory)
- Google API calls
- Response status
- Results normalization
- Success/error outcomes

All error logs include:
- Error message and stack
- Request ID
- Duration
- Context (query, location, etc.)

### 8. Crash-Proof Guarantees ✅
- **Nothing escapes uncaught**
- All async operations wrapped
- All JSON parsing wrapped
- All external API calls wrapped
- Geocoding failures don't crash (continues without location)
- Cache errors don't crash (logs and continues)
- Persistent cache writes are fire-and-forget

## Testing Checklist

### Local Testing
```bash
npm run dev
```

Then test:
1. ✅ Health check: `http://localhost:3000/api/places-search?ping=1`
2. ✅ Valid search: `?q=gym&location=New York&radius=5000`
3. ✅ Invalid query: `?q=a` (should return 400)
4. ✅ Missing query: `?location=NYC` (should return 400)
5. ✅ Invalid radius: `?q=gym&radius=abc` (should default to 25000)

### Vercel Deployment
```bash
vercel --prod
```

Monitor logs in Vercel dashboard for runtime behavior.

## Commit Message
```
fix: prevent places-search serverless crash + safe param parsing

- Add top-level try/catch wrapper (nothing escapes uncaught)
- Parse params from req.url instead of req.query (Vercel-safe)
- Add health check endpoint (?ping=1)
- Harden all internal helpers with proper error handling
- Add comprehensive runtime logging for debugging
- Ensure all errors return structured JSON (never throw)
- Handle REQUEST_DENIED, OVER_QUERY_LIMIT, ZERO_RESULTS properly
- Geocoding failures don't crash (continues without location)
```

## Deployment Steps
1. ✅ Code changes committed
2. Push to `main` branch
3. Push to `beta` branch
4. Monitor Vercel deployment logs
5. Test with `?ping=1` endpoint
6. Verify search functionality

## Key Improvements

### Before
- Could crash on invalid req.query
- Could crash on geocoding errors
- Limited runtime visibility
- Errors might escape uncaught

### After
- **Crash-proof**: All errors caught and handled
- **Vercel-safe**: Parses from req.url
- **Full observability**: Comprehensive logging
- **Structured errors**: Always returns JSON
- **Health check**: Quick status verification
- **Graceful degradation**: Geocode failure doesn't crash
