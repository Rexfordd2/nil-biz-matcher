# Verify API endpoints return JSON after routing fix
$ErrorActionPreference = "Stop"

$baseUrl = "https://athlete-ledger.vercel.app"
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

function TestEndpoint($name, $path) {
    Write-Host "`n=== Testing $name ===" -ForegroundColor Cyan
    $url = "$baseUrl$path?cb=$timestamp"
    Write-Host "URL: $url"
    
    $response = curl.exe -i $url 2>&1 | Out-String
    
    # Extract status code
    if ($response -match 'HTTP/\d\.\d\s+(\d+)') {
        $status = $matches[1]
        Write-Host "Status: $status" -ForegroundColor $(if ($status -eq "200") { "Green" } else { "Red" })
    }
    
    # Extract Content-Type
    if ($response -match '(?im)^content-type:\s*([^\r\n;]+)') {
        $contentType = $matches[1].Trim().ToLower()
        Write-Host "Content-Type: $contentType" -ForegroundColor $(if ($contentType -like "application/json*") { "Green" } else { "Red" })
        
        if ($contentType -notlike "application/json*") {
            Write-Host "❌ FAIL: Expected application/json but got $contentType" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "❌ FAIL: No Content-Type header found" -ForegroundColor Red
        return $false
    }
    
    # Extract first 120 chars of body
    $bodyMatch = $response -split "(\r?\n){2}", 2
    if ($bodyMatch.Length -ge 2) {
        $body = $bodyMatch[1].Trim()
        $preview = if ($body.Length -gt 120) { $body.Substring(0, 120) + "..." } else { $body }
        Write-Host "Body preview: $preview" -ForegroundColor Gray
        
        if (-not ($body.StartsWith("{") -or $body.StartsWith("["))) {
            Write-Host "❌ FAIL: Body is not JSON" -ForegroundColor Red
            return $false
        }
    }
    
    Write-Host "✅ PASS: $name returns JSON" -ForegroundColor Green
    return $true
}

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "API Routing Fix Verification" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Yellow

$allPassed = $true

$allPassed = (TestEndpoint "/api/ping" "/api/ping") -and $allPassed
$allPassed = (TestEndpoint "/api/healthz" "/api/healthz") -and $allPassed
$allPassed = (TestEndpoint "/healthz" "/healthz") -and $allPassed

Write-Host "`n========================================" -ForegroundColor Yellow
if ($allPassed) {
    Write-Host "✅ ALL TESTS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
    exit 1
}
