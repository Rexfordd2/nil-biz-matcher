# Vercel Project Configuration & Safety

**CRITICAL: Project-Branch Mapping**

This repository supports multiple deployment instances. To prevent cross-contamination and ensure correct deployments, follow these exact configurations:

| Vercel Project | Production Branch | Environment Variables | Purpose |
|----------------|-------------------|----------------------|----------|
| **Athlete Ledger** | `main` | `VITE_APP_INSTANCE=athlete-ledger-production` | Production site for Athlete Ledger |
| **Athlete Ledger Beta** | `beta` | `VITE_APP_INSTANCE=athlete-ledger-beta` | Beta/staging site for Athlete Ledger |
| **NIL BizMatcher** | (not connected) | N/A | Separate product - DO NOT connect to this repo |

## Setup Instructions

### 1. Athlete Ledger (Production)
- **Vercel Project**: "Athlete Ledger"
- **Git Integration**:
  - Repository: Connect this repository
  - Production Branch: `main`
- **Environment Variables**:
  ```
  VITE_APP_INSTANCE=athlete-ledger-production
  VITE_SUPABASE_URL=<your-production-supabase-url>
  VITE_SUPABASE_ANON_KEY=<your-production-anon-key>
  VITE_GOOGLE_MAPS_API_KEY=<your-api-key>
  ```
- **Domains**: `athleteledger.com`, `www.athleteledger.com`

### 2. Athlete Ledger Beta
- **Vercel Project**: "Athlete Ledger Beta"
- **Git Integration**:
  - Repository: Connect this repository
  - Production Branch: `beta`
- **Environment Variables**:
  ```
  VITE_APP_INSTANCE=athlete-ledger-beta
  VITE_SUPABASE_URL=<your-beta-supabase-url>
  VITE_SUPABASE_ANON_KEY=<your-beta-anon-key>
  VITE_GOOGLE_MAPS_API_KEY=<your-api-key>
  ```
- **Domains**: `beta.athleteledger.com`

### 3. NIL BizMatcher
- **DO NOT** connect this repository to the NIL BizMatcher Vercel project
- NIL BizMatcher is a separate product with its own repository

## Verification

After deployment, verify the correct instance is deployed:

1. Visit `/health` on your deployed domain (public route, no auth required)
2. Check the "App Instance" field matches your `VITE_APP_INSTANCE` setting
3. Verify the BUILD_ID is recent
4. Confirm environment variables are present (hasSupabaseUrl, hasAnonKey, hasGoogleMapsKey)

**Example verification URLs:**
- Production: `https://athleteledger.com/health`
- Beta: `https://beta.athleteledger.com/health`

## Safety Features

- The `/health` route displays the current `VITE_APP_INSTANCE` value
- The debug panel (`?debug=1`) shows instance and build information
- The footer displays instance and build ID on all pages
- These safety checks help prevent accidental deployments to the wrong project
