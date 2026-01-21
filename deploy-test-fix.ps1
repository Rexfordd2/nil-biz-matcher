#!/usr/bin/env pwsh
# Deploy preview, test endpoints, fix root cause, redeploy and verify

param(
    [string]$Token = $env:VERCEL_TOKEN
)

if (-not $Token) {
    Write-Host "ERROR: VERCEL_TOKEN not set. Set it with: `$env:VERCEL_TOKEN = 'your-token'" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== STEP 1: Deploy Preview ===" -ForegroundColor Cyan
$deployOutput = npx vercel deploy --yes --token $Token 2>&1
$deployOutput | Write-Host

# Extract preview URL
$previewUrl = ($deployOutput | Select-String -Pattern 'https://[^\s]+\.vercel\.app').Matches[0].Value
if (-not $previewUrl) {
    Write-Host "ERROR: Could not extract preview URL from deployment output" -ForegroundColor Red
    exit 1
}

Write-Host "`nPreview URL: $previewUrl" -ForegroundColor Green

Write-Host "`n=== STEP 2: Test Endpoints (BEFORE FIX) ===" -ForegroundColor Cyan

function Test-Endpoint {
    param([string]$Url, [string]$Name)
    Write-Host "`nTesting $Name : $Url" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -ErrorAction Stop
        $status = $response.StatusCode
        $contentType = $response.Headers['Content-Type']
        $first120 = ($response.Content -replace "`n", " " -replace "`r", "").Substring(0, [Math]::Min(120, $response.Content.Length))
        Write-Host "  Status: $status" -ForegroundColor $(if ($status -eq 200) { "Green" } else { "Yellow" })
        Write-Host "  Content-Type: $contentType" -ForegroundColor $(if ($contentType -like "*json*") { "Green" } else { "Red" })
        Write-Host "  First 120 chars: $first120" -ForegroundColor White
        return @{ Status = $status; ContentType = $contentType; IsJson = $contentType -like "*json*" }
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        Write-Host "  Status: $status" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        return @{ Status = $status; ContentType = "error"; IsJson = $false }
    }
}

$pingResult = Test-Endpoint -Url "$previewUrl/api/ping" -Name "/api/ping"
$healthzResult = Test-Endpoint -Url "$previewUrl/api/healthz" -Name "/api/healthz"
$healthzRootResult = Test-Endpoint -Url "$previewUrl/healthz" -Name "/healthz"

$allReturnHtml = (-not $pingResult.IsJson) -and (-not $healthzResult.IsJson) -and (-not $healthzRootResult.IsJson)

if ($allReturnHtml) {
    Write-Host "`n=== STEP 3: Root Cause Analysis ===" -ForegroundColor Cyan
    Write-Host "All /api/* endpoints return HTML. Root cause: outputDirectory='dist' makes Vercel treat dist/ as root." -ForegroundColor Yellow
    Write-Host "API functions at api/ (repo root) are not found because Vercel looks relative to dist/." -ForegroundColor Yellow
    
    Write-Host "`n=== STEP 4: Fix - Restore API Copy Step ===" -ForegroundColor Cyan
    
    # Read package.json
    $packageJson = Get-Content package.json -Raw | ConvertFrom-Json
    
    # Check if copy step exists
    $vercelBuildScript = $packageJson.scripts.'vercel-build'
    if ($vercelBuildScript -notlike "*copy-api-to-dist*") {
        Write-Host "Adding copy-api-to-dist.mjs to vercel-build script..." -ForegroundColor Yellow
        $packageJson.scripts.'vercel-build' = "$vercelBuildScript && node scripts/copy-api-to-dist.mjs"
        $packageJson | ConvertTo-Json -Depth 10 | Set-Content package.json
        Write-Host "Fixed: vercel-build now includes copy-api-to-dist.mjs" -ForegroundColor Green
    } else {
        Write-Host "Copy step already exists in vercel-build" -ForegroundColor Green
    }
    
    Write-Host "`n=== STEP 5: Redeploy Preview ===" -ForegroundColor Cyan
    $deployOutput2 = npx vercel deploy --yes --token $Token 2>&1
    $deployOutput2 | Write-Host
    
    $previewUrl2 = ($deployOutput2 | Select-String -Pattern 'https://[^\s]+\.vercel\.app').Matches[0].Value
    if (-not $previewUrl2) {
        Write-Host "ERROR: Could not extract preview URL from second deployment" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "`nNew Preview URL: $previewUrl2" -ForegroundColor Green
    
    Write-Host "`n=== STEP 6: Test Endpoints (AFTER FIX) ===" -ForegroundColor Cyan
    $pingResult2 = Test-Endpoint -Url "$previewUrl2/api/ping" -Name "/api/ping"
    $healthzResult2 = Test-Endpoint -Url "$previewUrl2/api/healthz" -Name "/api/healthz"
    $healthzRootResult2 = Test-Endpoint -Url "$previewUrl2/healthz" -Name "/healthz"
    
    $allReturnJson = $pingResult2.IsJson -and $healthzResult2.IsJson -and $healthzRootResult2.IsJson
    
    if ($allReturnJson) {
        Write-Host "`n=== SUCCESS: All endpoints return JSON ===" -ForegroundColor Green
        Write-Host "`nPreview URLs:" -ForegroundColor Cyan
        Write-Host "  Before fix: $previewUrl" -ForegroundColor White
        Write-Host "  After fix:  $previewUrl2" -ForegroundColor White
        Write-Host "`nRoot Directory Setting:" -ForegroundColor Cyan
        Write-Host "  Vercel Root Directory: . (repo root)" -ForegroundColor White
        Write-Host "  outputDirectory: dist (static files)" -ForegroundColor White
        Write-Host "  API functions: copied to dist/api/ during build" -ForegroundColor White
    } else {
        Write-Host "`n=== FAILURE: Some endpoints still return HTML ===" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`nEndpoints already return JSON. No fix needed." -ForegroundColor Green
}
