# Google Maps API Setup Guide

This guide provides step-by-step instructions for configuring the Google Maps API key required for Discover and Recruiting features.

## Overview

The Discover and Recruiting features use Google Maps JavaScript API and Places API to search for businesses and organizations on a map. These features will show a disabled state (not crash) when the API key is not configured.

## Required APIs

You need to enable these two APIs in Google Cloud Console:
- **Maps JavaScript API** - For map rendering
- **Places API** - For business search and details

## Step 1: Get a Google Maps API Key

### 1.1 Go to Google Cloud Console
Visit: https://console.cloud.google.com

### 1.2 Create or Select a Project
- If you don't have a project, click **"Create Project"**
- Give it a name (e.g., "Athlete Ledger Maps")
- Click **"Create"**

### 1.3 Enable Required APIs
1. In the Google Cloud Console, go to **"APIs & Services" → "Library"**
2. Search for **"Maps JavaScript API"**
3. Click on it and click **"Enable"**
4. Repeat for **"Places API"**

### 1.4 Create an API Key
1. Go to **"APIs & Services" → "Credentials"**
2. Click **"Create Credentials" → "API key"**
3. A new API key will be generated

### 1.5 Restrict the API Key (Recommended)
1. Click on the newly created API key to edit it
2. Under **"Application restrictions"**:
   - Select **"HTTP referrers (websites)"**
   - Add your domains:
     - `http://localhost:5173/*` (for local dev)
     - `https://your-production-domain.vercel.app/*`
     - `https://*.vercel.app/*` (for preview deployments)
3. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Select only:
     - Maps JavaScript API
     - Places API
4. Click **"Save"**

### 1.6 Copy the API Key
Copy the API key for use in the next steps.

## Step 2: Configure for Local Development

### 2.1 Create .env.local file
In your project root, create a file named `.env.local`:

```bash
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...your-key-here
```

### 2.2 Restart Dev Server
After adding the environment variable, restart your dev server:

```bash
npm run dev
```

### 2.3 Verify
1. Navigate to the Discover or Recruiting page
2. The map should load without showing the disabled notice
3. Search functionality should work

## Step 3: Configure for Vercel Deployment

### 3.1 Access Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Select your project (e.g., "athlete-ledger")

### 3.2 Add Environment Variable
1. Click **Settings** → **Environment Variables**
2. Click **"Add New"**
3. Fill in:
   - **Name**: `VITE_GOOGLE_MAPS_API_KEY`
   - **Value**: Your API key (e.g., `AIzaSy...`)
4. **Select Environments**:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. Click **"Save"**

### 3.3 Redeploy
Vercel will not automatically rebuild with the new environment variable. You need to trigger a new deployment:

**Option A - Push a new commit:**
```bash
git commit --allow-empty -m "Add Google Maps API key"
git push
```

**Option B - Manual redeploy in Vercel Dashboard:**
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the three dots (...) menu
4. Click **"Redeploy"**

### 3.4 Verify Production
After deployment completes:
1. Visit your production URL
2. Navigate to Discover or Recruiting
3. Verify the map loads and search works

## Troubleshooting

### "Search disabled until Google Maps key is configured"
**Cause:** The `VITE_GOOGLE_MAPS_API_KEY` environment variable is not set or is empty.

**Solution:**
- **Local:** Ensure `.env.local` has the key and restart dev server
- **Vercel:** Verify the environment variable is set and redeploy

### "This page can't load Google Maps correctly"
**Cause:** API key restrictions or billing not enabled.

**Solutions:**
1. Check that HTTP referrer restrictions allow your domain
2. Ensure Maps JavaScript API and Places API are enabled
3. Verify billing is enabled in Google Cloud (required for production use)

### "OVER_QUERY_LIMIT" errors
**Cause:** You've exceeded the free tier quota or rate limits.

**Solutions:**
1. Enable billing in Google Cloud Console
2. Set up billing alerts to monitor usage
3. The app includes automatic retry logic for transient quota errors

### Map loads but search doesn't work
**Cause:** Places API might not be enabled.

**Solution:**
1. Go to Google Cloud Console → APIs & Services → Library
2. Search for "Places API"
3. Click "Enable" if not already enabled

### Environment variable not updating in Vercel
**Cause:** Vercel caches build outputs.

**Solution:**
1. After changing environment variables in Vercel, always trigger a new deployment
2. Force rebuild by pushing an empty commit or using "Redeploy" in Vercel Dashboard

## Cost and Quotas

### Free Tier (Google Maps Platform)
- $200/month credit (approximately 28,000 map loads)
- See pricing: https://mapsplatform.google.com/pricing/

### Best Practices to Minimize Costs
1. Use HTTP referrer restrictions to prevent unauthorized use
2. Enable billing alerts in Google Cloud
3. Monitor usage in Google Cloud Console

## Security Best Practices

1. **Never commit API keys to git**
   - Use `.env.local` for local development
   - `.env.local` is in `.gitignore` by default

2. **Always use HTTP referrer restrictions**
   - Prevents unauthorized domains from using your key
   - Update restrictions when adding new domains

3. **Use separate keys for dev/prod** (optional)
   - Create different keys for local vs production
   - Makes it easier to rotate keys if compromised

## Additional Resources

- [Google Maps JavaScript API Documentation](https://developers.google.com/maps/documentation/javascript)
- [Places API Documentation](https://developers.google.com/maps/documentation/places/web-service)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)

## Related Files

- `.env.example` - Example environment variables file
- `src/config/env.ts` - Centralized environment configuration
- `src/lib/google/loader.ts` - Google Maps script loader (singleton)
- `src/lib/google/maps.ts` - Google Maps and Places API utilities
- `src/components/GoogleMapsDisabledNotice.tsx` - Disabled state UI component
