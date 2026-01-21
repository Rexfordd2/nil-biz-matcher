#!/usr/bin/env pwsh
# Deploy preview, test endpoints, fix if needed, redeploy and prove

param(
    [string]$Token = $env:VERCEL_TOKEN
)

if (-not $Token) {
    Write-Host "ERROR: VERCEL_TOKEN not set." -ForegroundColor Red
    Write-Host "Set it with: `$env:VERCEL_TOKEN = 'your-token'" -ForegroundColor Yellow
    exit 1
}

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "STEP 1: Deploy Preview (BEFORE FIX)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$deploy1 = npx vercel deploy --yes --token $Token 2>&1 | Out-String
Write-Host $deploy1

$previewUrl1 = ([regex]::Matches($deploy1, 'https://[^\s]+\.vercel\.app'))[0].Value
if (-not $previewUrl1) {
    Write-Host "ERROR: Could not extract preview URL" -ForegroundColor Red
    exit 1
}

Write-Host "`nPreview URL: $previewUrl1" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "STEP 2: Test Endpoints (BEFORE FIX)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

function Test-Endpoint {
    param([string]$Url, [string]$Name)
    Write-Host "$Name" -ForegroundColor Yellow
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop
        $status = $r.StatusCode
        $ct = $r.Headers['Content-Type']
        $body = $r.Content
        $preview = if ($body.Length -gt 120) { $body.Substring(0, 120) + "..." } else { $body }
        $preview = $preview -replace "`n", " " -replace "`r", ""
        Write-Host "  Status: $status | Content-Type: $ct" -ForegroundColor $(if ($ct -like "*json*") { "Green" } else { "Red" })
        Write-Host "  Body (first 120 chars): $preview" -ForegroundColor White
        Write-Host ""
        return @{ Status = $status; ContentType = $ct; IsJson = $ct -like "*json*"; Body = $body }
    } catch {
        $status = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
        Write-Host "  Status: $status | Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        return @{ Status = $status; ContentType = "error"; IsJson = $false; Body = "" }
    }
}

$ping1 = Test-Endpoint "$previewUrl1/api/ping" "/api/ping"
$healthz1 = Test-Endpoint "$previewUrl1/api/healthz" "/api/healthz"
$healthzRoot1 = Test-Endpoint "$previewUrl1/healthz" "/healthz"

$needsFix = -not ($ping1.IsJson -and $healthz1.IsJson -and $healthzRoot1.IsJson)

if ($needsFix) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "STEP 3: Root Cause Analysis" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "ISSUE: /api/* endpoints return HTML instead of JSON" -ForegroundColor Red
    Write-Host "ROOT CAUSE: outputDirectory='dist' makes Vercel treat dist/ as root." -ForegroundColor Yellow
    Write-Host "  - API functions at api/ (repo root) are not found" -ForegroundColor Yellow
    Write-Host "  - Vercel looks for functions relative to dist/" -ForegroundColor Yellow
    Write-Host "  - Solution: Build api/ to dist/api/ during build`n" -ForegroundColor Yellow
    
    Write-Host "Checking vercel-build script..." -ForegroundColor Cyan
    $pkg = Get-Content package.json -Raw | ConvertFrom-Json
    $hasBuild = $pkg.scripts.'vercel-build' -like "*build-api*"
    
    if (-not $hasBuild) {
        Write-Host "FIXING: Adding build-api.mjs to vercel-build..." -ForegroundColor Yellow
        $pkg.scripts.'vercel-build' = $pkg.scripts.'vercel-build' + " && node scripts/build-api.mjs"
        $pkg | ConvertTo-Json -Depth 10 | Set-Content package.json -NoNewline
        Write-Host "FIXED: vercel-build now includes build step`n" -ForegroundColor Green
    } else {
        Write-Host "ALREADY FIXED: vercel-build includes build-api.mjs`n" -ForegroundColor Green
    }
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "STEP 4: Redeploy Preview (AFTER FIX)" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    $deploy2 = npx vercel deploy --yes --token $Token 2>&1 | Out-String
    Write-Host $deploy2
    
    $previewUrl2 = ([regex]::Matches($deploy2, 'https://[^\s]+\.vercel\.app'))[0].Value
    if (-not $previewUrl2) {
        Write-Host "ERROR: Could not extract preview URL from second deployment" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "`nNew Preview URL: $previewUrl2" -ForegroundColor Green
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "STEP 5: Test Endpoints (AFTER FIX)" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    $ping2 = Test-Endpoint "$previewUrl2/api/ping" "/api/ping"
    $healthz2 = Test-Endpoint "$previewUrl2/api/healthz" "/api/healthz"
    $healthzRoot2 = Test-Endpoint "$previewUrl2/healthz" "/healthz"
    
    $allJson = $ping2.IsJson -and $healthz2.IsJson -and $healthzRoot2.IsJson
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "PROOF SUMMARY" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "Preview URLs:" -ForegroundColor Cyan
    Write-Host "  Before fix: $previewUrl1" -ForegroundColor White
    Write-Host "  After fix:  $previewUrl2" -ForegroundColor White
    Write-Host ""
    
    Write-Host "Before Fix Results:" -ForegroundColor Cyan
    Write-Host "  /api/ping:    $($ping1.ContentType)" -ForegroundColor $(if ($ping1.IsJson) { "Green" } else { "Red" })
    Write-Host "  /api/healthz: $($healthz1.ContentType)" -ForegroundColor $(if ($healthz1.IsJson) { "Green" } else { "Red" })
    Write-Host "  /healthz:     $($healthzRoot1.ContentType)" -ForegroundColor $(if ($healthzRoot1.IsJson) { "Green" } else { "Red" })
    Write-Host ""
    
    Write-Host "After Fix Results:" -ForegroundColor Cyan
    Write-Host "  /api/ping:    $($ping2.ContentType)" -ForegroundColor $(if ($ping2.IsJson) { "Green" } else { "Red" })
    Write-Host "  /api/healthz: $($healthz2.ContentType)" -ForegroundColor $(if ($healthz2.IsJson) { "Green" } else { "Red" })
    Write-Host "  /healthz:     $($healthzRoot2.ContentType)" -ForegroundColor $(if ($healthzRoot2.IsJson) { "Green" } else { "Red" })
    Write-Host ""
    
    Write-Host "Root Directory Configuration:" -ForegroundColor Cyan
    Write-Host "  Vercel Root Directory: . (repo root)" -ForegroundColor White
    Write-Host "  vercel.json outputDirectory: dist" -ForegroundColor White
    Write-Host "  API functions: api/ → dist/api/ (compiled during build)" -ForegroundColor White
    Write-Host ""
    
    if ($allJson) {
        Write-Host "✅ SUCCESS: All endpoints return JSON" -ForegroundColor Green
        Write-Host "`nReady to deploy to production." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "❌ FAILURE: Some endpoints still return HTML" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Endpoints already return JSON. No fix needed." -ForegroundColor Green
    Write-Host "`nPreview URL: $previewUrl1" -ForegroundColor Green
    exit 0
}
