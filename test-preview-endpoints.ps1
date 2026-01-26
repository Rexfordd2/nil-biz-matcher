#!/usr/bin/env pwsh
# Test preview endpoints and show proof

param(
    [Parameter(Mandatory=$true)]
    [string]$PreviewUrl
)

Write-Host "`n=== Testing Preview Endpoints ===" -ForegroundColor Cyan
Write-Host "Preview URL: $PreviewUrl`n" -ForegroundColor Yellow

function Test-Endpoint {
    param([string]$Url, [string]$Name)
    Write-Host "Testing $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -ErrorAction Stop
        $status = $response.StatusCode
        $contentType = $response.Headers['Content-Type']
        $first120 = ($response.Content -replace "`n", " " -replace "`r", "").Substring(0, [Math]::Min(120, $response.Content.Length))
        Write-Host "  Status: $status" -ForegroundColor $(if ($status -eq 200) { "Green" } else { "Yellow" })
        Write-Host "  Content-Type: $contentType" -ForegroundColor $(if ($contentType -like "*json*") { "Green" } else { "Red" })
        Write-Host "  First 120 chars: $first120" -ForegroundColor White
        Write-Host ""
        return @{ Status = $status; ContentType = $contentType; IsJson = $contentType -like "*json*" }
    } catch {
        $status = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
        Write-Host "  Status: $status" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        return @{ Status = $status; ContentType = "error"; IsJson = $false }
    }
}

$pingResult = Test-Endpoint -Url "$PreviewUrl/api/ping" -Name "/api/ping"
$healthzResult = Test-Endpoint -Url "$PreviewUrl/api/healthz" -Name "/api/healthz"
$healthzRootResult = Test-Endpoint -Url "$PreviewUrl/healthz" -Name "/healthz"

Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "/api/ping returns JSON: $($pingResult.IsJson)" -ForegroundColor $(if ($pingResult.IsJson) { "Green" } else { "Red" })
Write-Host "/api/healthz returns JSON: $($healthzResult.IsJson)" -ForegroundColor $(if ($healthzResult.IsJson) { "Green" } else { "Red" })
Write-Host "/healthz returns JSON: $($healthzRootResult.IsJson)" -ForegroundColor $(if ($healthzRootResult.IsJson) { "Green" } else { "Red" })

if ($pingResult.IsJson -and $healthzResult.IsJson -and $healthzRootResult.IsJson) {
    Write-Host "`n✅ SUCCESS: All endpoints return JSON" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ FAILURE: Some endpoints return HTML" -ForegroundColor Red
    exit 1
}
