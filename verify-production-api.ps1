# Verify production deployment via API endpoint
# Hits /api/build-id to get the current build ID and commit SHA

$ErrorActionPreference = "Stop"

$url = "https://athlete-ledger.vercel.app/api/build-id"
$cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$fullUrl = "$url?cb=$cacheBuster"

Write-Host "Fetching build info from: $fullUrl"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $fullUrl -Method Get -Headers @{
        "Cache-Control" = "no-cache"
        "Pragma" = "no-cache"
    }
    
    Write-Host "BUILD_ID: $($response.buildId)"
    Write-Host "COMMIT: $($response.commit)"
    Write-Host ""
    
    # Check if it's the expected new commit
    $expectedCommit = "3627261"
    if ($response.buildId -match $expectedCommit -or $response.commit -match $expectedCommit) {
        Write-Host "✓ SUCCESS: Production is serving commit >= $expectedCommit" -ForegroundColor Green
        exit 0
    } elseif ($response.buildId -eq "ac87f4b" -or $response.commit -match "ac87f4b") {
        Write-Host "✗ FAILED: Still serving old build (ac87f4b)" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "? UNKNOWN: Build ID is '$($response.buildId)', commit is '$($response.commit)'" -ForegroundColor Yellow
        Write-Host "  Expected: $expectedCommit or newer" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "ERROR: Failed to fetch build info" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
