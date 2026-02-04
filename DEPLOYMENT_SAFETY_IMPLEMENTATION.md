# Deployment Safety Implementation Summary

## Overview
Implemented deployment safety features to ensure correct Vercel project configuration and prevent accidental cross-project deployments.

## Changes Implemented

### 1. VITE_APP_INSTANCE Environment Variable Support

#### Files Modified:
- **`src/config/env.ts`**: Added `APP_INSTANCE` constant that reads from `import.meta.env.VITE_APP_INSTANCE`
- **`.env.example`**: Added `VITE_APP_INSTANCE` with example value and documentation

#### Usage:
```typescript
import { APP_INSTANCE } from './config/env'
// Returns: 'athlete-ledger-production', 'athlete-ledger-beta', or 'unknown'
```

### 2. Public /health Route

#### Files Created:
- **`src/pages/Health.tsx`**: New public health check page component

#### Files Modified:
- **`src/routes/RootRouter.tsx`**: Added `/health` route to router
- **`api/healthz.ts`**: Enhanced to include `appInstance` field in response

#### Features:
- **Public access**: No authentication required
- **App Instance**: Displays current `VITE_APP_INSTANCE` value
- **Build Information**: Shows client and server BUILD_ID
- **Environment Configuration**: Boolean checks for key environment variables:
  - `hasSupabaseUrl`
  - `hasAnonKey`
  - `hasGoogleMapsKey`
- **Auth State**: Current authentication status (logged-in/logged-out/checking)
- **Supabase Health**: Connection test and error reporting
- **JSON Export**: Copy full health data as JSON

#### Endpoints:
- **Frontend**: `/health` - Public health check page
- **Backend**: `/api/healthz` - Health check API endpoint (returns JSON)

### 3. Debug Panel Enhancement (?debug=1)

#### Files Modified:
- **`src/App.tsx`**: Enhanced debug panel to display:
  - App Instance
  - Build ID
  - User ID
  - Environment configuration status

#### Usage:
Visit any page with `?debug=1` query parameter to see the debug panel.

### 4. Footer Label

#### Files Modified:
- **`src/App.tsx`**: Added persistent footer label showing:
  - Instance name (from `VITE_APP_INSTANCE`)
  - Build ID

The footer is visible on all pages to quickly identify which deployment you're viewing.

### 5. Documentation

#### Files Created:
- **`VERCEL_PROJECT_WIRING.md`**: Comprehensive Vercel project configuration guide with:
  - Project-branch mapping table
  - Step-by-step setup instructions for each project
  - Verification procedures
  - Safety features explanation

#### Files Modified:
- **`README.md`**: Added reference to `VERCEL_PROJECT_WIRING.md` in Deployment section

## Vercel Project Configuration

### Required Environment Variables

#### Athlete Ledger (Production)
```
VITE_APP_INSTANCE=athlete-ledger-production
VITE_SUPABASE_URL=<production-url>
VITE_SUPABASE_ANON_KEY=<production-key>
VITE_GOOGLE_MAPS_API_KEY=<api-key>
```
- **Production Branch**: `main`
- **Domains**: `athleteledger.com`, `www.athleteledger.com`

#### Athlete Ledger Beta
```
VITE_APP_INSTANCE=athlete-ledger-beta
VITE_SUPABASE_URL=<beta-url>
VITE_SUPABASE_ANON_KEY=<beta-key>
VITE_GOOGLE_MAPS_API_KEY=<api-key>
```
- **Production Branch**: `beta`
- **Domains**: `beta.athleteledger.com`

#### NIL BizMatcher
**DO NOT** connect this repository to NIL BizMatcher Vercel project. It's a separate product.

## Verification Steps

After deployment to any environment:

1. **Visit `/health` route**:
   - Production: `https://athleteledger.com/health`
   - Beta: `https://beta.athleteledger.com/health`

2. **Verify App Instance**:
   - Check that "Instance" field matches expected value
   - Production should show: `athlete-ledger-production`
   - Beta should show: `athlete-ledger-beta`

3. **Check Build ID**:
   - Verify client and server BUILD_ID match
   - Ensure BUILD_ID is recent (not "unknown")

4. **Verify Environment Variables**:
   - All key variables should show `true`:
     - `hasSupabaseUrl`
     - `hasAnonKey`
     - `hasGoogleMapsKey`

5. **Check Footer**:
   - Footer on any page shows correct instance and build ID

6. **Debug Panel** (optional):
   - Add `?debug=1` to any URL
   - Verify instance, build, and user info displayed correctly

## Safety Features

### Multiple Layers of Protection

1. **Environment Variable**: `VITE_APP_INSTANCE` explicitly identifies each deployment
2. **Health Route**: Public endpoint for instant verification without login
3. **Debug Panel**: Developer-friendly diagnostics with `?debug=1`
4. **Footer Label**: Always-visible instance and build identification
5. **API Endpoint**: `/api/healthz` for automated health checks and CI/CD

### Benefits

- **Prevent Wrong Deployments**: Immediately see which instance you're on
- **Quick Verification**: Public `/health` route requires no authentication
- **CI/CD Integration**: Health endpoint can be called by deployment scripts
- **Developer Experience**: Debug panel provides detailed diagnostics
- **Audit Trail**: Build ID tracking helps identify which commit is deployed

## Testing

### Local Development

1. Set `VITE_APP_INSTANCE=local-dev` in your `.env` file
2. Run `npm run dev`
3. Visit `http://localhost:5173/health`
4. Verify instance shows "local-dev"

### Production Deployment

1. Set correct `VITE_APP_INSTANCE` in Vercel environment variables
2. Deploy to Vercel
3. Visit `https://your-domain.com/health`
4. Verify:
   - Instance name is correct
   - Build ID is not "unknown"
   - Environment variables are present
   - Auth state is accurate

## API Response Example

**GET** `/api/healthz`:

```json
{
  "buildId": "a1b2c3d",
  "appInstance": "athlete-ledger-production",
  "timestamp": "2026-02-04T12:34:56.789Z",
  "configPresence": {
    "hasViteSupabaseUrl": true,
    "hasViteSupabaseAnonKey": true,
    "hasViteGoogleMapsApiKey": true,
    "hasGoogleMapsServerKey": true,
    "hasVercelGitCommitSha": true
  },
  "supabase": {
    "configured": true,
    "connected": true,
    "error": null
  }
}
```

## Implementation Notes

- **No Breaking Changes**: All changes are additive
- **Backward Compatible**: Works with existing deployments
- **Public Access**: `/health` route is intentionally public for quick verification
- **Security**: No sensitive data exposed (only boolean presence checks)
- **Performance**: Health checks are fast and non-blocking

## Next Steps

1. Set `VITE_APP_INSTANCE` in all Vercel projects
2. Verify correct branch mapping in Vercel Git settings
3. Test `/health` endpoint on all deployments
4. Update deployment runbooks to reference this documentation
