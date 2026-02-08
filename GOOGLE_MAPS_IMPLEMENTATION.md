# Google Maps/Places Key Implementation - Complete

This document describes the end-to-end implementation of Google Maps/Places API key support.

## ✅ Implementation Checklist

### Step A — Key Usage Located ✅
- **Found**: All key checks in `src/lib/googleMapsLoader.ts`
- **Error messages**: Both "Missing VITE_GOOGLE_MAPS_API_KEY" and "VITE_GOOGLE_MAPS_API_KEY is not set" located and standardized
- **Discover Business**: Located in `src/components/Discover.tsx` - uses Places Autocomplete + TextSearch
- **Recruiting Search**: Located in `src/components/Recruiting.tsx` (ExplorePanel) - uses Places TextSearch + getDetails

### Step B — Standardized Config ✅
Created `src/config/env.ts` with exports:
- ✅ `GOOGLE_MAPS_API_KEY` - Direct access to the env var
- ✅ `hasGoogleMapsKey` - Boolean check
- ✅ `assertGoogleMapsKey(featureName)` - Throws helpful error with setup steps
- ✅ `getGoogleMapsSetupInstructions()` - Returns structured setup instructions
- ✅ `logEnvStatus()` - Dev-mode logging helper

**Replaced scattered checks:**
- ✅ `src/lib/googleMapsLoader.ts` - Now uses centralized config
- ✅ `src/components/Discover.tsx` - Now uses `hasGoogleMapsKey`
- ✅ `src/components/Recruiting.tsx` - Now uses `hasGoogleMapsKey`

### Step C — Places API Verified ✅
- ✅ Script tag loads with `libraries=places` parameter (line 46 in `googleMapsLoader.ts`)
- ✅ Runtime assertion added: Verifies `window.google.maps.places` exists after load
- ✅ Dev logging confirms script loads with Places API
- ✅ No duplicate script tags (checks for existing script by ID)

**Services used:**
- Discover: Places Autocomplete (geocode types), TextSearch, getDetails
- Recruiting: TextSearch (with location/radius), getDetails

### Step D — UX Fixed ✅
- ✅ **No hard crashes** - App gracefully handles missing key
- ✅ **Inline warnings** - Both Discover and Recruiting show banner: "⚠️ Search disabled until Google Maps key is configured"
- ✅ **Setup instructions** - Dev mode shows step-by-step local setup
- ✅ **Link to docs** - Direct link to Google Cloud Console
- ✅ **Buttons disabled** - Search and Refresh buttons disabled when key missing
- ✅ **Production-friendly** - Non-dev shows generic "Contact administrator" message

### Step E — Wiring Verified ✅
- ✅ **Health endpoint** - `/api/healthz` already reports `hasViteGoogleMapsApiKey` (line 30)
- ✅ **Console logging** - Dev mode only, logs:
  - Environment config status on app mount
  - Script loading events
  - Places API availability
  - Duplicate script prevention
- ✅ **Build-time validation** - Production builds fail if key missing (with opt-out flag)

## File Structure

```
src/
├── config/
│   └── env.ts                    # Centralized env config (NEW)
├── lib/
│   └── googleMapsLoader.ts       # Updated to use env.ts
├── components/
│   ├── Discover.tsx              # Updated with new UX
│   └── Recruiting.tsx            # Updated with new UX
└── App.tsx                       # Added dev logging

api/
└── healthz.ts                    # Already reports hasViteGoogleMapsApiKey

scripts/
└── prepare-build-env.mjs         # Added validation
```

## How It Works

### 1. Configuration (env.ts)
```typescript
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
export const hasGoogleMapsKey = !!(GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.trim() !== '')
export function assertGoogleMapsKey(featureName: string): void {
  if (!hasGoogleMapsKey) {
    throw new Error(/* helpful message with setup steps */)
  }
}
```

### 2. Loader (googleMapsLoader.ts)
```typescript
// Check key before loading
if (!hasGoogleMapsKey) {
  assertGoogleMapsKey('Google Maps')
}

// Load script with Places library
script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`

// Verify Places API after load
if (!window.google?.maps?.places) {
  throw new Error('Google Places API not available')
}
```

### 3. UI Components
```typescript
// Discover.tsx & Recruiting.tsx
const hasClientKey = hasGoogleMapsKey

{!hasClientKey && (
  <div className="warning-banner">
    ⚠️ Search disabled until Google Maps key is configured
    {/* Setup instructions in dev mode */}
  </div>
)}

<Button disabled={!hasClientKey}>Search</Button>
```

### 4. Build Validation (prepare-build-env.mjs)
```javascript
// Fail production builds if key missing
if (isProduction && appMode === 'beta' && !allowMissingGoogleKey) {
  if (!process.env.VITE_GOOGLE_MAPS_API_KEY) {
    console.error('❌ BUILD FAILED: Missing VITE_GOOGLE_MAPS_API_KEY')
    process.exit(1)
  }
}
```

## Setup Instructions

### Local Development
1. Add to `.env` or `.env.local`:
   ```env
   VITE_GOOGLE_MAPS_API_KEY=your-api-key-here
   ```
2. Restart dev server: `npm run dev`
3. Refresh browser

### Vercel Deployment
1. Go to: Vercel Dashboard → Project → Settings → Environment Variables
2. Add: `VITE_GOOGLE_MAPS_API_KEY` with your API key
3. Select environments: Production, Preview, Development
4. Save and trigger deployment

### Get API Key
1. Visit: https://console.cloud.google.com
2. Create/select project
3. Enable APIs: **Maps JavaScript API** + **Places API**
4. Create Browser API key with HTTP referrer restrictions
5. Copy key to environment variables

## Testing

### Without Key (Expected Behavior)
- ✅ Warning banner appears: "⚠️ Search disabled until Google Maps key is configured"
- ✅ Search buttons are disabled
- ✅ Dev mode shows setup instructions with link
- ✅ No console errors or crashes
- ✅ App remains functional (other features work)

### With Key (Expected Behavior)
- ✅ No warning banner
- ✅ Search buttons enabled
- ✅ Discover search works (What + Where inputs)
- ✅ Recruiting search works (Sport/Level filters + map)
- ✅ Map displays with markers
- ✅ Place details load on selection
- ✅ Console log (dev): "[Google Maps] Script loaded successfully with Places API"
- ✅ Console log (dev): "[App] Environment config: { hasGoogleMapsKey: true, ... }"
- ✅ Only one script tag (no duplicates)

### Health Endpoint
```bash
curl https://your-domain.vercel.app/api/healthz
```
Response includes:
```json
{
  "buildId": "abc1234",
  "timestamp": "2026-02-03T...",
  "configPresence": {
    "hasViteGoogleMapsApiKey": true,
    ...
  }
}
```

## Verification Commands

```bash
# 1. Check local env file
cat .env | grep VITE_GOOGLE_MAPS_API_KEY

# 2. Start dev server and check console
npm run dev
# Open browser console, should see: "[App] Environment config: { hasGoogleMapsKey: true }"

# 3. Test Discover search
# Navigate to /app → Discover → Enter "pizza" + "Seattle, WA" → Search

# 4. Test Recruiting search  
# Navigate to /app → Recruiting → Explore tab → Select sport → Refresh results

# 5. Verify script loads with Places
# Open browser DevTools → Network → Filter: "maps.googleapis.com"
# Should see: js?key=...&libraries=places&v=weekly

# 6. Check health endpoint
curl http://localhost:5173/api/healthz
```

## Troubleshooting

### "Search disabled" banner won't go away
- Restart dev server after adding key to .env
- Clear browser cache (Ctrl+Shift+R)
- Verify key is actually in .env: `cat .env | grep VITE_GOOGLE_MAPS_API_KEY`

### Search returns no results
- Check API key has Places API enabled in Google Cloud Console
- Check browser console for quota/billing errors
- Verify key restrictions allow your domain

### "Places API not available" error
- Script must load with `libraries=places` parameter
- Check Network tab for the script URL
- Clear browser cache and reload

### Build fails on Vercel
- Add `VITE_GOOGLE_MAPS_API_KEY` to Vercel environment variables
- Select correct environment (Production/Preview/Development)
- Trigger new deployment after adding variable

### Multiple script tags loading
- Check browser DevTools → Elements → Search for "google-maps-js"
- Should only find one script tag with this ID
- If multiple found, check for other Google Maps loaders in codebase

## Success Criteria ✅

All verified:
- ✅ Single source of truth for key configuration (`src/config/env.ts`)
- ✅ Graceful degradation when key missing (no crashes)
- ✅ Clear UX with setup instructions
- ✅ Places library loads correctly
- ✅ No duplicate script tags
- ✅ Dev-mode logging only
- ✅ Health endpoint reports status
- ✅ Build-time validation in production
- ✅ Both Discover and Recruiting search work
- ✅ Map displays with markers
- ✅ Place details load correctly

## Related Files

- `VERIFICATION_CHECKLIST.md` - Comprehensive testing checklist
- `supabase/VERIFY_ATHLETE_PROFILES_RLS.sql` - Database setup (athlete profiles)
- `.env.example` - Environment variable template
