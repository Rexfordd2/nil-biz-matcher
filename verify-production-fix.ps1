# Production Fix Verification Script
# Tests /api/ping, /healthz, and /api/waitlist with cache-busting

param(
    [string]$BaseUrl = "https://athlete-ledger.vercel.app"
)

$ErrorActionPreference = "Continue"
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host "`n=== Vercel Production Fix Verification ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host "Timestamp: $timestamp (cache-busting)" -ForegroundColor Gray
Write-Host ""

$allTestsPassed = $true

# Test 1: /api/ping
Write-Host "Test 1: GET /api/ping (with cache-busting)" -ForegroundColor Yellow
$pingUrl = "$BaseUrl/api/ping?cb=$timestamp"
try {
    $response = curl.exe -s -i $pingUrl
    $headers = $response -split "`r`n`r`n" | Select-Object -First 1
    $body = $response -split "`r`n`r`n" | Select-Object -Skip 1 | Join-String -Separator "`r`n`r`n"
    
    # Check Content-Type
    if ($headers -match "Content-Type:\s*application/json") {
        Write-Host "  ✓ Content-Type: application/json" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Content-Type is NOT application/json" -ForegroundColor Red
        Write-Host "    Headers: $($headers -split "`r`n" | Select-String "Content-Type")" -ForegroundColor Gray
        $allTestsPassed = $false
    }
    
    # Check body is JSON with ok:true
    if ($body -match '\{"ok"\s*:\s*true\}' -or $body -match '{"ok":true}') {
        Write-Host "  ✓ Body: {`"ok`":true}" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Body is not {`"ok`":true}" -ForegroundColor Red
        Write-Host "    Actual: $($body.Substring(0, [Math]::Min(200, $body.Length)))" -ForegroundColor Gray
        $allTestsPassed = $false
    }
    
    # Check NOT cached HTML
    if ($headers -notmatch "text/html") {
        Write-Host "  ✓ Not serving HTML (good!)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Still serving HTML instead of JSON" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "  ✗ Request failed: $_" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 2: /healthz (rewrite to /api/healthz)
Write-Host "Test 2: GET /healthz (rewrite to /api/healthz, with cache-busting)" -ForegroundColor Yellow
$healthzUrl = "$BaseUrl/healthz?cb=$timestamp"
try {
    $response = curl.exe -s -i $healthzUrl
    $headers = $response -split "`r`n`r`n" | Select-Object -First 1
    $body = $response -split "`r`n`r`n" | Select-Object -Skip 1 | Join-String -Separator "`r`n`r`n"
    
    # Check Content-Type
    if ($headers -match "Content-Type:\s*application/json") {
        Write-Host "  ✓ Content-Type: application/json" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Content-Type is NOT application/json" -ForegroundColor Red
        $allTestsPassed = $false
    }
    
    # Check body contains buildId and timestamp
    if ($body -match '"buildId"' -and $body -match '"timestamp"') {
        Write-Host "  ✓ Body contains buildId and timestamp" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Body missing expected fields" -ForegroundColor Red
        Write-Host "    Actual: $($body.Substring(0, [Math]::Min(200, $body.Length)))" -ForegroundColor Gray
        $allTestsPassed = $false
    }
    
    # Check NOT cached HTML
    if ($headers -notmatch "text/html") {
        Write-Host "  ✓ Not serving HTML (good!)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Still serving HTML instead of JSON" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "  ✗ Request failed: $_" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 3: POST /api/waitlist
Write-Host "Test 3: POST /api/waitlist (with unique test email)" -ForegroundColor Yellow
$waitlistUrl = "$BaseUrl/api/waitlist"
$testEmail = "verify-fix-$timestamp@example.com"
$payload = @{
    email = $testEmail
    source = "verification_script"
} | ConvertTo-Json

try {
    $response = curl.exe -s -i -X POST $waitlistUrl `
        -H "Content-Type: application/json" `
        -d $payload
    
    $headers = $response -split "`r`n`r`n" | Select-Object -First 1
    $body = $response -split "`r`n`r`n" | Select-Object -Skip 1 | Join-String -Separator "`r`n`r`n"
    
    # Check status code
    if ($headers -match "HTTP/\d\.\d\s+200") {
        Write-Host "  ✓ Status: 200 OK" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Status is not 200" -ForegroundColor Red
        Write-Host "    Status line: $($headers -split "`r`n" | Select-Object -First 1)" -ForegroundColor Gray
        $allTestsPassed = $false
    }
    
    # Check Content-Type
    if ($headers -match "Content-Type:\s*application/json") {
        Write-Host "  ✓ Content-Type: application/json" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Content-Type is NOT application/json" -ForegroundColor Red
        $allTestsPassed = $false
    }
    
    # Check body contains ok:true
    if ($body -match '"ok"\s*:\s*true' -or $body -match '{"ok":true') {
        Write-Host "  ✓ Response: {`"ok`":true,...}" -ForegroundColor Green
        
        # Check status field
        if ($body -match '"status"\s*:\s*"created"') {
            Write-Host "  ✓ Status: created (persisted to Supabase)" -ForegroundColor Green
        } elseif ($body -match '"status"\s*:\s*"accepted_no_storage"') {
            Write-Host "  ⚠ Status: accepted_no_storage (Supabase not configured)" -ForegroundColor Yellow
            Write-Host "    This is OK if you haven't set SUPABASE_URL/KEY yet" -ForegroundColor Gray
        } elseif ($body -match '"status"\s*:\s*"honeypot_rejected"') {
            Write-Host "  ⚠ Status: honeypot_rejected (honeypot field was filled)" -ForegroundColor Yellow
        } else {
            Write-Host "  ? Status: unknown (see body below)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ✗ Response does not contain {`"ok`":true}" -ForegroundColor Red
        Write-Host "    Actual: $($body.Substring(0, [Math]::Min(200, $body.Length)))" -ForegroundColor Gray
        $allTestsPassed = $false
    }
    
    # Show full response body for debugging
    Write-Host "  Response body: $body" -ForegroundColor Gray
    
} catch {
    Write-Host "  ✗ Request failed: $_" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 4: SPA fallback (should still work for non-API routes)
Write-Host "Test 4: GET / (SPA fallback should still work)" -ForegroundColor Yellow
$homeUrl = "$BaseUrl/?cb=$timestamp"
try {
    $response = curl.exe -s -i $homeUrl
    $headers = $response -split "`r`n`r`n" | Select-Object -First 1
    $body = $response -split "`r`n`r`n" | Select-Object -Skip 1 | Join-String -Separator "`r`n`r`n"
    
    # Check status
    if ($headers -match "HTTP/\d\.\d\s+200") {
        Write-Host "  ✓ Status: 200 OK" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Status is not 200" -ForegroundColor Red
        $allTestsPassed = $false
    }
    
    # Check it's HTML
    if ($headers -match "Content-Type:\s*text/html") {
        Write-Host "  ✓ Content-Type: text/html (correct for SPA)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Content-Type is not text/html" -ForegroundColor Red
        $allTestsPassed = $false
    }
    
    # Check it contains <!doctype html>
    if ($body -match "<!doctype html>|<!DOCTYPE html>") {
        Write-Host "  ✓ Contains HTML doctype (SPA index.html)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Does not appear to be HTML" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "  ✗ Request failed: $_" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Summary
Write-Host "=== Summary ===" -ForegroundColor Cyan
if ($allTestsPassed) {
    Write-Host "✓ All tests PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Production fix verified successfully:" -ForegroundColor Green
    Write-Host "  • /api/ping returns JSON (not cached HTML)" -ForegroundColor Gray
    Write-Host "  • /healthz returns JSON (rewrite works)" -ForegroundColor Gray
    Write-Host "  • /api/waitlist accepts POST requests" -ForegroundColor Gray
    Write-Host "  • SPA fallback still works for non-API routes" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "✗ Some tests FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Check Vercel deployment logs for errors" -ForegroundColor Gray
    Write-Host "  2. Verify VITE_PUBLIC_MODE=true is set in Vercel env" -ForegroundColor Gray
    Write-Host "  3. Ensure latest vercel.json is deployed (routes not rewrites)" -ForegroundColor Gray
    Write-Host "  4. Try deploying with --force to clear CDN cache" -ForegroundColor Gray
    exit 1
}
