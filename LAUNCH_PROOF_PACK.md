# Launch Proof Pack - Athlete Ledger Production

**Production URL**: https://athlete-ledger.vercel.app  
**Date**: 2026-01-22  
**Last Updated**: 2026-01-22

---

## New Behavior: Anonymous Mode

**Key Change**: The app now works fully without login/authentication.

- ✅ `/app` route is accessible to unauthenticated users (no redirect)
- ✅ All features work in anonymous mode (Discover, Recruiting, etc.)
- ✅ Progress is saved to device localStorage
- ✅ Anonymous users get a unique `anon_id` stored in localStorage
- ✅ Waitlist submissions include `anon_id` for future account linking
- ✅ No blocking auth calls - app renders immediately
- ✅ Settings page shows "Claim Account Later" placeholder for anonymous users

---

## Production URLs

| Endpoint | URL |
|----------|-----|
| Landing Page | https://athlete-ledger.vercel.app/ |
| Demo Page | https://athlete-ledger.vercel.app/demo |
| **App (Anonymous Access)** | **https://athlete-ledger.vercel.app/app** |
| Health Check (Rewrite) | https://athlete-ledger.vercel.app/healthz |
| API Ping | https://athlete-ledger.vercel.app/api/ping |
| API Health Check | https://athlete-ledger.vercel.app/api/healthz |

---

## Production Build Configuration

**Important**: Production builds require explicit debug route protection configuration.

### Setting VITE_DEBUG_KEY for Production Builds

To allow production builds to pass without enabling full diagnostics, set `VITE_DEBUG_KEY`:

**In Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add new variable:
   - **Name**: `VITE_DEBUG_KEY`
   - **Value**: `<your-secret-key>` (use a strong random string)
   - **Environment**: Production (and Preview if desired)
3. Save and redeploy

**For Local Production Builds:**
```powershell
# Set VITE_DEBUG_KEY before building
$env:VITE_DEBUG_KEY = "your-secret-key-here"
npm run build
```

**Build Protection Logic:**
- ✅ `VITE_DIAGNOSTICS=true` → Build passes (full diagnostics enabled)
- ✅ `VITE_DEBUG_KEY` is set (non-empty) → Build passes (debug key protection)
- ❌ Neither set → Build fails with security error

**Runtime Protection:**
- Debug routes are protected at runtime via `RootRouter.tsx`
- Access requires `?debugKey=<secret>` query parameter matching `VITE_DEBUG_KEY`
- This allows secure debug access without exposing routes publicly

---

## Automated Verification (PowerShell)

Copy and paste these commands in PowerShell to verify production endpoints:

### 1. Verify Demo Page OG Tags
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$demoHtml = curl.exe -s "https://athlete-ledger.vercel.app/demo?cb=$ts"
$demoOgTitle = $demoHtml | Select-String -Pattern 'property="og:title"\s+content="([^"]+)"' | ForEach-Object { $_.Matches.Groups[1].Value }
if ($demoOgTitle -eq "Athlete Ledger - Demo") { Write-Host "PASS" } else { Write-Host "FAIL: Expected 'Athlete Ledger - Demo', got '$demoOgTitle'" }
```
**Expected PASS**: `og:title` exactly contains `Athlete Ledger - Demo`

### 1b. Verify Home Page OG Tags
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$homeHtml = curl.exe -s "https://athlete-ledger.vercel.app/?cb=$ts"
$homeOgTitle = $homeHtml | Select-String -Pattern 'property="og:title"\s+content="([^"]+)"' | ForEach-Object { $_.Matches.Groups[1].Value }
if ($homeOgTitle -eq "Athlete Ledger - Connect with College Coaches") { Write-Host "PASS" } else { Write-Host "FAIL: Expected 'Athlete Ledger - Connect with College Coaches', got '$homeOgTitle'" }
```
**Expected PASS**: `og:title` exactly contains `Athlete Ledger - Connect with College Coaches`

### 2. Verify API Ping Endpoint
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
curl.exe -s "https://athlete-ledger.vercel.app/api/ping?cb=$ts"
```
**Expected PASS**: `{"ok":true}`

### 3. Verify API Ping Content-Type
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
curl.exe -s -I "https://athlete-ledger.vercel.app/api/ping?cb=$ts" | Select-String -Pattern "Content-Type"
```
**Expected PASS**: `Content-Type: application/json` or `Content-Type: application/json; charset=utf-8`

### 4. Verify Health Check Endpoint
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
curl.exe -s "https://athlete-ledger.vercel.app/healthz?cb=$ts"
```
**Expected PASS**: JSON containing `buildId` and `configPresence` fields

### 5. Verify API Health Check Endpoint
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
curl.exe -s "https://athlete-ledger.vercel.app/api/healthz?cb=$ts"
```
**Expected PASS**: JSON containing `buildId` and `configPresence` fields

### 6. Verify /app Loads Without Redirect (Anonymous Access)
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$appResponse = curl.exe -s -L -w "%{http_code}" "https://athlete-ledger.vercel.app/app?cb=$ts" -o $null
if ($appResponse -eq "200") { Write-Host "PASS: /app loads without redirect" } else { Write-Host "FAIL: /app returned HTTP $appResponse" }
```
**Expected PASS**: HTTP 200 (no redirect to login)

### 7. Verify /app Returns HTML (Not JSON Error)
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$appHtml = curl.exe -s "https://athlete-ledger.vercel.app/app?cb=$ts"
if ($appHtml -match "<!DOCTYPE html>" -or $appHtml -match "<html") { Write-Host "PASS: /app returns HTML" } else { Write-Host "FAIL: /app does not return HTML" }
```
**Expected PASS**: Returns HTML content (not JSON error)

---

## Manual QA Checklist

### Anonymous Mode & App Access (`/app`)

- [ ] **App Loads Without Login**
  - Navigate to `https://athlete-ledger.vercel.app/app` in incognito/private window
  - Page loads immediately (no redirect to login)
  - No "Loading auth..." blocking message
  - App renders with all tabs accessible

- [ ] **Anonymous ID Created**
  - Open browser DevTools → Application → Local Storage
  - Verify `anon_user_id` key exists with UUID value
  - Verify `anon_user_created_at` key exists with ISO timestamp
  - ID persists across page refreshes

- [ ] **Discover Works Without Session**
  - Navigate to `/app` → Click "Discover" tab
  - Enter search terms (e.g., "gym" in "New York, NY")
  - Click "Search"
  - Results display without errors
  - Map shows results correctly
  - No "Please log in" errors

- [ ] **Recruiting Works Without Session**
  - Navigate to `/app` → Click "Recruiting" tab
  - Select "Explore (Map)" tab
  - Map loads and shows results
  - Can filter by sport/level/org type
  - No "Please log in" errors

- [ ] **Settings Shows Anonymous Mode Message**
  - Navigate to `/app` → Click "Settings" in sidebar
  - Verify "Anonymous Mode" card appears
  - Message: "You're using anonymous mode. Your progress is saved to this device."
  - "Join waitlist to save progress to email" button present
  - Button navigates to home page waitlist form

- [ ] **Footer Shows Anonymous Mode Note**
  - Scroll to bottom of `/app` page
  - Verify footer banner appears (only when not logged in)
  - Message: "Anonymous mode: Your progress is saved to this device."
  - "Join waitlist to save progress to email" button present

- [ ] **No Network Errors**
  - Open browser DevTools → Network tab
  - Navigate through app (Discover, Recruiting, Settings)
  - Verify no failed requests to `/api/auth/me` or `/api/auth/*`
  - Verify no failed Supabase `getSession()` calls
  - No "Network error" messages in UI

- [ ] **Progress Saved Locally**
  - Fill out Athlete Profile form
  - Add businesses
  - Refresh page
  - Verify data persists (stored in localStorage)

### Landing Page (`/`)

- [ ] **CTA Buttons Functional**
  - "Try Demo" button navigates to `/demo`
  - "Join Waitlist" button scrolls to waitlist form
  - "Create Profile" button navigates to `/auth/signup`

- [ ] **Waitlist Form - New Email**
  - Enter email address in waitlist form
  - Click "Join Waitlist"
  - Success message appears: "You're in! We'll notify you when we launch."
  - Email field clears after successful submission
  - **Verify anon_id is saved**: Check browser DevTools → Application → Local Storage → `anon_user_id` exists before submitting
  - **Verify anon_id in database**: (Admin) Check Supabase `waitlist` table - `anon_id` column should contain UUID matching localStorage

- [ ] **Waitlist Form - Duplicate Email**
  - Submit same email address again
  - Shows "You're in" success state (not error)
  - No duplicate entry error message

- [ ] **Waitlist from Settings**
  - Navigate to `/app` → Settings
  - Click "Join waitlist to save progress to email"
  - Page navigates to `/` and scrolls to waitlist form
  - Form is pre-focused and ready for input

### Demo Page (`/demo`)

- [ ] **Demo Discover Search**
  - Navigate to `/demo`
  - Enter search terms (e.g., "gym" in "New York")
  - Click "Search"
  - Results display without errors
  - No red error UI appears

- [ ] **Demo Recruiting Search**
  - Click "Recruiting" tab on `/demo`
  - Enter search terms (e.g., "basketball" in "California")
  - Click "Search"
  - Results display without errors
  - No red error UI appears

- [ ] **Demo Share Link**
  - Perform a search on `/demo`
  - Click "Share" button
  - Share link is generated with query parameters
  - Copy link and open in new tab
  - Search parameters are preserved in URL

- [ ] **No Crashes or Errors**
  - Navigate through all demo features
  - Check browser console (F12) for errors
  - Verify no red error UI appears anywhere
  - Page remains responsive throughout

### General

- [ ] **Page Load Performance**
  - All pages load within 3 seconds
  - No broken images or missing assets
  - Navigation is smooth and responsive

- [ ] **Mobile Responsiveness** (Optional)
  - Test on mobile device or browser dev tools
  - Layout adapts correctly to smaller screens
  - All buttons and forms remain functional

- [ ] **Anonymous to Authenticated Transition**
  - Start in anonymous mode (`/app` without login)
  - Use app features (Discover, Recruiting, etc.)
  - Click "Sign Up" or "Log In" in header
  - Complete authentication
  - Verify app continues working with authenticated session
  - Verify cloud sync becomes available

---

## Known Limitations

1. **Anonymous Mode Limitations**
   - Progress saved to device localStorage only (not cloud)
   - Data lost if localStorage is cleared
   - Cannot access data from other devices
   - Some features require authentication (saving businesses to cloud, etc.)

2. **Demo Mode Uses Mock Data**
   - Demo discover and recruiting searches use sample/mock data only
   - Results are not real-time and do not reflect actual database content
   - This is intentional to allow public access without authentication

3. **Hobby Plan Constraints**
   - Vercel Hobby plan has execution time limits
   - API endpoints may have cold start delays (first request after inactivity)
   - Rate limiting may apply under high traffic

4. **Waitlist Only (No Email Sending)**
   - Waitlist submissions are stored in database with `anon_id`
   - No automated email notifications are sent to users
   - Email functionality requires additional SMTP configuration
   - `anon_id` allows future account linking when user signs up

5. **Public Demo Only**
   - Demo mode does not require authentication
   - Full app features work in anonymous mode
   - Demo data is read-only and cannot be modified

6. **Social Sharing Previews**
   - OG tags are present and verified
   - Social media platforms may cache previews (24-48 hour refresh)
   - Use Facebook Debugger or Twitter Card Validator to force refresh if needed

---

## Quick Verification Script

Run this PowerShell script to verify all endpoints at once:

```powershell
$baseUrl = "https://athlete-ledger.vercel.app"
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
Write-Host "=== Verifying Production Endpoints ===" -ForegroundColor Cyan

# Demo OG tags
$demoHtml = curl.exe -s "$baseUrl/demo?cb=$ts"
$demoOgTitle = $demoHtml | Select-String -Pattern 'property="og:title"\s+content="([^"]+)"' | ForEach-Object { $_.Matches.Groups[1].Value }
if ($demoOgTitle -eq "Athlete Ledger - Demo") { Write-Host "✓ Demo OG tags: PASS" -ForegroundColor Green } else { Write-Host "✗ Demo OG tags: FAIL" -ForegroundColor Red }

# Home OG tags
$homeHtml = curl.exe -s "$baseUrl/?cb=$ts"
$homeOgTitle = $homeHtml | Select-String -Pattern 'property="og:title"\s+content="([^"]+)"' | ForEach-Object { $_.Matches.Groups[1].Value }
if ($homeOgTitle -eq "Athlete Ledger - Connect with College Coaches") { Write-Host "✓ Home OG tags: PASS" -ForegroundColor Green } else { Write-Host "✗ Home OG tags: FAIL" -ForegroundColor Red }

# API Ping
$ping = curl.exe -s "$baseUrl/api/ping?cb=$ts"
if ($ping -match '{"ok":true}') { Write-Host "✓ API Ping: PASS" -ForegroundColor Green } else { Write-Host "✗ API Ping: FAIL" -ForegroundColor Red }

# Health Check
$healthz = curl.exe -s "$baseUrl/healthz?cb=$ts"
if ($healthz -match "buildId") { Write-Host "✓ Health Check: PASS" -ForegroundColor Green } else { Write-Host "✗ Health Check: FAIL" -ForegroundColor Red }

# API Health Check
$apiHealthz = curl.exe -s "$baseUrl/api/healthz?cb=$ts"
if ($apiHealthz -match "buildId") { Write-Host "✓ API Health Check: PASS" -ForegroundColor Green } else { Write-Host "✗ API Health Check: FAIL" -ForegroundColor Red }

# /app loads without redirect
$appResponse = curl.exe -s -L -w "%{http_code}" "$baseUrl/app?cb=$ts" -o $null
if ($appResponse -eq "200") { Write-Host "✓ /app loads without redirect: PASS" -ForegroundColor Green } else { Write-Host "✗ /app loads without redirect: FAIL (HTTP $appResponse)" -ForegroundColor Red }

# /app returns HTML
$appHtml = curl.exe -s "$baseUrl/app?cb=$ts"
if ($appHtml -match "<!DOCTYPE html>" -or $appHtml -match "<html") { Write-Host "✓ /app returns HTML: PASS" -ForegroundColor Green } else { Write-Host "✗ /app returns HTML: FAIL" -ForegroundColor Red }

Write-Host "`nVerification complete." -ForegroundColor Cyan
```

---

**Last Updated**: 2026-01-22  
**Status**: Production Ready ✅

---

## Waitlist & Anonymous ID Details

### How Waitlist Saves anon_id

1. **Anonymous ID Generation**
   - Generated on first app load via `initAnonIdentity()` in `main.tsx`
   - Stored in localStorage as `anon_user_id` (UUID format)
   - Persists across sessions on same device

2. **Waitlist Submission**
   - When user submits waitlist form, `submitWaitlistEmail()` is called
   - Function retrieves `anon_id` from localStorage via `getAnonId()`
   - `anon_id` is included in waitlist insert payload
   - Saved to Supabase `waitlist` table with email and metadata

3. **Future Account Linking**
   - When user later signs up with same email, `anon_id` can be used to:
     - Link anonymous session data to authenticated account
     - Migrate localStorage data to cloud storage
     - Provide seamless transition from anonymous to authenticated mode

### Database Schema

The `waitlist` table includes:
- `email` (unique, required)
- `anon_id` (nullable, UUID from localStorage)
- `source` (e.g., 'landing', 'settings')
- UTM tracking fields (`utm_source`, `utm_medium`, etc.)
- `created_at` timestamp

### Verification (Admin/Database)

To verify waitlist submissions include `anon_id`:

```sql
-- Check recent waitlist submissions with anon_id
SELECT email, anon_id, source, created_at 
FROM waitlist 
WHERE anon_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

Expected: Recent submissions should have `anon_id` populated (unless localStorage unavailable).
