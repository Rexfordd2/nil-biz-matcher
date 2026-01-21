# PowerShell Deployment & Verification Script
# Vercel Preview Deployment with Proof Checks

# Step 1: Deploy preview deployment and capture URL
Write-Host "`n=== Step 1: Deploying to Vercel Preview ===" -ForegroundColor Cyan
$deployOutput = vercel deploy --prebuilt --token $env:VERCEL_TOKEN 2>&1 | Out-String

# Extract deployment URL from output
$deploymentUrl = ($deployOutput | Select-String -Pattern 'https://[^\s]+\.vercel\.app' | Select-Object -First 1).Matches.Value

if (-not $deploymentUrl) {
    Write-Host "ERROR: Could not extract deployment URL from output" -ForegroundColor Red
    Write-Host "Deploy output:" -ForegroundColor Yellow
    Write-Host $deployOutput
    exit 1
}

Write-Host "Deployment URL: $deploymentUrl" -ForegroundColor Green

# Step 2: Inspect routes/functions
Write-Host "`n=== Step 2: Inspecting Routes & Functions ===" -ForegroundColor Cyan
vercel inspect $deploymentUrl --token $env:VERCEL_TOKEN

# Step 3: Run proof checks
Write-Host "`n=== Step 3: Running Proof Checks ===" -ForegroundColor Cyan

# Test 1: /api/ping
Write-Host "`n[1] Testing /api/ping (must return JSON)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$deploymentUrl/api/ping" -Method GET -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Green
    Write-Host "Body: $($response.Content)" -ForegroundColor Green
    if ($response.Content -match '{"ok":true}') {
        Write-Host "✓ PASS: /api/ping returns correct JSON" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: /api/ping does not return expected JSON" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Error testing /api/ping" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Test 2: /api/healthz
Write-Host "`n[2] Testing /api/healthz (must return JSON with cache headers)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$deploymentUrl/api/healthz" -Method GET -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Green
    Write-Host "Cache-Control: $($response.Headers['Cache-Control'])" -ForegroundColor Green
    Write-Host "CDN-Cache-Control: $($response.Headers['CDN-Cache-Control'])" -ForegroundColor Green
    Write-Host "Body (first 200 chars): $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor Green
    if ($response.Content -match 'buildId') {
        Write-Host "✓ PASS: /api/healthz returns correct JSON" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: /api/healthz does not return expected JSON" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Error testing /api/healthz" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Test 3: /healthz (routed)
Write-Host "`n[3] Testing /healthz (must route to /api/healthz and return JSON)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$deploymentUrl/healthz" -Method GET -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Green
    Write-Host "Cache-Control: $($response.Headers['Cache-Control'])" -ForegroundColor Green
    Write-Host "Body (first 200 chars): $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor Green
    if ($response.Content -match 'buildId') {
        Write-Host "✓ PASS: /healthz routes correctly and returns JSON" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: /healthz does not return expected JSON" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Error testing /healthz" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Test 4: SPA fallback
Write-Host "`n[4] Testing /some/spa/route (must return HTML)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$deploymentUrl/some/spa/route" -Method GET -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Green
    Write-Host "Body (first 200 chars): $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor Green
    if ($response.Content -match '<html|<!DOCTYPE') {
        Write-Host "✓ PASS: SPA fallback returns HTML" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: SPA fallback does not return HTML" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Error testing SPA fallback" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
Write-Host "Deployment URL: $deploymentUrl" -ForegroundColor Green
