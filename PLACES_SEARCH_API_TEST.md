# Places Search API - Test Examples

## Endpoint
`/api/places-search`

## Parameters

### Required
- `q` or `query` (string): Search query, minimum 2 characters

### Optional
- `location` (string): Location filter as "lat,lng" or address text (e.g., "los angeles, ca")
- `radius` (number): Search radius in meters (100-50000, default: 25000)

## Test Examples

### Basic Search (using 'q' parameter)
```
/api/places-search?q=coffee
```

### Basic Search (using 'query' parameter)
```
/api/places-search?query=coffee
```

### Search with Location (address text)
```
/api/places-search?q=coffee&location=los%20angeles%2C%20ca
```

### Search with Location (lat,lng coordinates)
```
/api/places-search?q=pizza&location=34.0522,-118.2437
```

### Search with Custom Radius
```
/api/places-search?q=gyms&location=new%20york%2C%20ny&radius=5000
```

### Both Parameter Variants Work
```
/api/places-search?query=restaurants&location=san%20francisco%2C%20ca
/api/places-search?q=restaurants&location=san%20francisco%2C%20ca
```

## Response Format

### Success Response
```json
{
  "ok": true,
  "requestId": "req_1234567890_abc",
  "cached": false,
  "ts": "2026-02-06T12:00:00.000Z",
  "results": [
    {
      "placeId": "ChIJxxx",
      "name": "Example Place",
      "formattedAddress": "123 Main St, City, State",
      "location": { "lat": 34.0522, "lng": -118.2437 },
      "rating": 4.5,
      "userRatingsTotal": 100,
      "types": ["cafe", "food"],
      "photoReference": "photo_ref_xxx"
    }
  ],
  "durationMs": 250
}
```

### Error Response (Invalid Request)
```json
{
  "ok": false,
  "code": "INVALID_REQUEST",
  "userMessage": "Enter at least 2 characters to search.",
  "httpStatus": 400
}
```

### Error Response (Server Error)
```json
{
  "ok": false,
  "code": "SERVER_ERROR",
  "userMessage": "Search temporarily unavailable. Please try again.",
  "httpStatus": 500,
  "devDetails": "{\"name\":\"Error\",\"message\":\"...\",\"stack\":\"...\"}"
}
```

### Error Response (Missing API Key)
```json
{
  "ok": false,
  "code": "MISSING_SERVER_KEY",
  "userMessage": "Search is not configured (missing server key).",
  "httpStatus": 500
}
```

### Error Response (Rate Limited)
```json
{
  "ok": false,
  "code": "OVER_QUERY_LIMIT",
  "userMessage": "Too many searches right now. Please try again in a few seconds.",
  "httpStatus": 429,
  "retryAfter": 60
}
```

## Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `INVALID_REQUEST` | 400 | Query too short or invalid parameters |
| `MISSING_SERVER_KEY` | 500 | Google Maps API key not configured |
| `KEY_RESTRICTED` | 502 | Google API key is restricted |
| `OVER_QUERY_LIMIT` | 429 | Rate limit exceeded |
| `SERVER_ERROR` | 500 | Unexpected server error |
| `NETWORK` | 500 | Network connectivity issue |
| `ZERO_RESULTS` | 200 | No results found (returns empty array) |

## Testing Locally

```bash
# Start dev server
npm run dev

# Test in browser or curl
curl "http://localhost:5173/api/places-search?q=coffee&location=seattle%2C%20wa"

# Test both parameter variants
curl "http://localhost:5173/api/places-search?query=pizza"
curl "http://localhost:5173/api/places-search?q=pizza"

# Test error case (query too short)
curl "http://localhost:5173/api/places-search?q=a"

# Test with radius
curl "http://localhost:5173/api/places-search?q=gyms&location=34.0522,-118.2437&radius=10000"
```

## Production Testing

```bash
# Test on deployed endpoint
curl "https://your-domain.vercel.app/api/places-search?q=coffee&location=los%20angeles%2C%20ca"

# Verify structured error responses (not HTML)
curl -i "https://your-domain.vercel.app/api/places-search?q=x"
# Should return JSON with Content-Type: application/json
```
