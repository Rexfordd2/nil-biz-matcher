# Verify production deployment via API endpoint
# Hits /api/build-id to get the current build ID and commit SHA

$ErrorActionPreference = "Stop"

# Get the latest commit SHA from origin/main
Write-Host "Fetching latest origin/main SHA..."
git fetch origin main 2>&1 | Out-Null
$expectedSha = git rev-parse origin/main
$expectedShortSha = $expectedSha.Substring(0, 7)

Write-Host "Expected SHA: $expectedSha (short: $expectedShortSha)"
Write-Host ""

$baseUrl = "https://athlete-ledger.vercel.app"
$cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

# Check /api/healthz
Write-Host "=== Checking /api/healthz ==="
$healthzUrl = "${baseUrl}/api/healthz?cb=${cacheBuster}"
Write-Host "URL: $healthzUrl"

try {
    $healthzResponse = Invoke-WebRequest -Uri $healthzUrl -Method Get -Headers @{
        "Cache-Control" = "no-cache"
        "Pragma" = "no-cache"
    }
    Write-Host "HTTP Status: $($healthzResponse.StatusCode)"
    
    $healthzData = $healthzResponse.Content | ConvertFrom-Json
    Write-Host "Build ID: $($healthzData.buildId)"
    Write-Host "Timestamp: $($healthzData.timestamp)"
    
    if ($healthzData.buildId -eq "ac87f4b") {
        Write-Host "[WARNING] /api/healthz is still showing old build (ac87f4b)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "HTTP Status: $($_.Exception.Response.StatusCode.Value__)" -ForegroundColor Red
    Write-Host "ERROR: Failed to fetch /api/healthz" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""

# Check /api/build-id
Write-Host "=== Checking /api/build-id ==="
$buildIdUrl = "${baseUrl}/api/build-id?cb=${cacheBuster}"
Write-Host "URL: $buildIdUrl"

try {
    $buildIdResponse = Invoke-WebRequest -Uri $buildIdUrl -Method Get -Headers @{
        "Cache-Control" = "no-cache"
        "Pragma" = "no-cache"
    }
    Write-Host "HTTP Status: $($buildIdResponse.StatusCode)"
    
    $buildIdData = $buildIdResponse.Content | ConvertFrom-Json
    Write-Host "Build ID: $($buildIdData.buildId)"
    Write-Host "Git Commit SHA: $($buildIdData.gitCommitSha)"
    Write-Host "Timestamp: $($buildIdData.timestamp)"
    Write-Host ""
    
    # Verify against expected SHA
    Write-Host "=== Verification ==="
    Write-Host "Expected SHA: $expectedSha"
    Write-Host "Observed gitCommitSha: $($buildIdData.gitCommitSha)"
    Write-Host "Observed buildId: $($buildIdData.buildId)"
    Write-Host ""
    
    # Check if gitCommitSha starts with or equals expected SHA
    if ($buildIdData.gitCommitSha -eq $expectedSha -or $buildIdData.gitCommitSha.StartsWith($expectedSha)) {
        Write-Host "[SUCCESS] Production is serving the latest commit!" -ForegroundColor Green
        Write-Host "  gitCommitSha matches: $($buildIdData.gitCommitSha)" -ForegroundColor Green
        exit 0
    } elseif ($buildIdData.buildId -eq $expectedShortSha -or $buildIdData.buildId -eq $expectedSha) {
        Write-Host "[SUCCESS] Production is serving the latest commit!" -ForegroundColor Green
        Write-Host "  buildId matches: $($buildIdData.buildId)" -ForegroundColor Green
        exit 0
    } elseif ($buildIdData.gitCommitSha -eq "ac87f4b" -or $buildIdData.buildId -eq "ac87f4b") {
        Write-Host "[FAILED] Production is still serving old build (ac87f4b)" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "[FAILED] Production is NOT serving the latest commit" -ForegroundColor Red
        Write-Host "  Expected: $expectedSha (or short: $expectedShortSha)" -ForegroundColor Red
        Write-Host "  Got gitCommitSha: $($buildIdData.gitCommitSha)" -ForegroundColor Red
        Write-Host "  Got buildId: $($buildIdData.buildId)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "HTTP Status: $($_.Exception.Response.StatusCode.Value__)" -ForegroundColor Red
    Write-Host "ERROR: Failed to fetch /api/build-id" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
