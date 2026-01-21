# Deployment Proof - Vercel Functions & Routing

This document provides exact curl commands to verify that Vercel functions are deployed correctly and routing works as expected.

## Prerequisites

Replace `<url>` with your actual Vercel deployment URL (e.g., `https://your-project.vercel.app` or `https://your-project-git-branch.vercel.app`).

## Verification Commands

### 1. Test `/api/ping` endpoint (must return JSON)

```bash
curl -i <url>/api/ping
```

**Expected:**
- Status: `200 OK`
- `Content-Type: application/json`
- Body: `{"ok":true}`

---

### 2. Test `/api/healthz` endpoint (must return JSON)

```bash
curl -i <url>/api/healthz
```

**Expected:**
- Status: `200 OK`
- `Content-Type: application/json`
- `Cache-Control: no-store`
- `CDN-Cache-Control: no-store`
- Body: JSON object with `buildId`, `timestamp`, and `configPresence` fields

---

### 3. Test `/healthz` route (rewritten to `/api/healthz`, must return JSON)

```bash
curl -i <url>/healthz
```

**Expected:**
- Status: `200 OK`
- `Content-Type: application/json`
- `Cache-Control: no-store`
- `CDN-Cache-Control: no-store`
- Body: Same JSON response as `/api/healthz`

---

### 4. Test SPA fallback route (must return HTML)

```bash
curl -i <url>/some/spa/route
```

**Expected:**
- Status: `200 OK`
- `Content-Type: text/html`
- Body: HTML content (should be your `index.html` from the `dist` directory)

---

## Quick Test Script

You can run all tests at once (replace `<url>` first):

```bash
echo "Testing /api/ping..."
curl -i <url>/api/ping
echo -e "\n\nTesting /api/healthz..."
curl -i <url>/api/healthz
echo -e "\n\nTesting /healthz..."
curl -i <url>/healthz
echo -e "\n\nTesting SPA fallback..."
curl -i <url>/some/spa/route
```

---

## PowerShell Deployment & Verification Commands

### Step 1: Deploy Preview Deployment

```powershell
vercel deploy --prebuilt --token $env:VERCEL_TOKEN
```

**Note:** Copy the deployment URL from the output (e.g., `https://your-project-abc123.vercel.app`)

---

### Step 2: Capture Deployment URL (Manual)

After deployment, set the URL as a variable:

```powershell
$deploymentUrl = "https://your-project-abc123.vercel.app"
```

**Or extract automatically from deployment output:**

```powershell
$deployOutput = vercel deploy --prebuilt --token $env:VERCEL_TOKEN 2>&1 | Out-String
$deploymentUrl = ($deployOutput | Select-String -Pattern 'https://[^\s]+\.vercel\.app' | Select-Object -First 1).Matches.Value
Write-Host "Deployment URL: $deploymentUrl"
```

---

### Step 3: Inspect Routes & Functions

```powershell
vercel inspect $deploymentUrl --token $env:VERCEL_TOKEN
```

---

### Step 4: Run Proof Checks

#### Test 1: `/api/ping` (must return JSON)

```powershell
Invoke-WebRequest -Uri "$deploymentUrl/api/ping" -Method GET -UseBasicParsing | Select-Object StatusCode, @{Name='ContentType';Expression={$_.Headers['Content-Type']}}, Content
```

**Expected:** StatusCode: 200, ContentType: `application/json`, Content: `{"ok":true}`

---

#### Test 2: `/api/healthz` (must return JSON with cache headers)

```powershell
$response = Invoke-WebRequest -Uri "$deploymentUrl/api/healthz" -Method GET -UseBasicParsing
Write-Host "Status: $($response.StatusCode)"
Write-Host "Content-Type: $($response.Headers['Content-Type'])"
Write-Host "Cache-Control: $($response.Headers['Cache-Control'])"
Write-Host "CDN-Cache-Control: $($response.Headers['CDN-Cache-Control'])"
Write-Host "Body: $($response.Content)"
```

**Expected:** Status: 200, Content-Type: `application/json`, Cache-Control: `no-store`, Body contains `buildId`

---

#### Test 3: `/healthz` (routed, must return JSON)

```powershell
$response = Invoke-WebRequest -Uri "$deploymentUrl/healthz" -Method GET -UseBasicParsing
Write-Host "Status: $($response.StatusCode)"
Write-Host "Content-Type: $($response.Headers['Content-Type'])"
Write-Host "Cache-Control: $($response.Headers['Cache-Control'])"
Write-Host "Body: $($response.Content)"
```

**Expected:** Status: 200, Content-Type: `application/json`, Cache-Control: `no-store`, Body contains `buildId`

---

#### Test 4: SPA Fallback (must return HTML)

```powershell
$response = Invoke-WebRequest -Uri "$deploymentUrl/some/spa/route" -Method GET -UseBasicParsing
Write-Host "Status: $($response.StatusCode)"
Write-Host "Content-Type: $($response.Headers['Content-Type'])"
Write-Host "Body starts with: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))"
```

**Expected:** Status: 200, Content-Type: `text/html`, Body starts with `<!DOCTYPE` or `<html`

---

### Alternative: Using curl.exe (if available)

If you have `curl.exe` available in PowerShell:

```powershell
curl.exe -i "$deploymentUrl/api/ping"
curl.exe -i "$deploymentUrl/api/healthz"
curl.exe -i "$deploymentUrl/healthz"
curl.exe -i "$deploymentUrl/some/spa/route"
```

---

### Complete PowerShell Script

For a complete automated script, see `DEPLOY_PROOF.ps1` in this repository.

---

## What This Proves

✅ **Functions are deployed**: `/api/ping` and `/api/healthz` return JSON responses  
✅ **Routing works**: `/healthz` correctly routes to `/api/healthz`  
✅ **Filesystem handle works**: `/api/*` routes are not intercepted by SPA fallback  
✅ **SPA fallback works**: Non-API routes serve `index.html`  
✅ **Headers are correct**: JSON endpoints return `application/json`, healthz has cache headers
