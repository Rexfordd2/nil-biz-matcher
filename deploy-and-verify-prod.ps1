$ErrorActionPreference = "Stop"

function Write-Status($msg) {
  Write-Host "`n=== $msg ===" -ForegroundColor Cyan
}

function Test-Endpoint($url, $name) {
  Write-Status "Testing $name"
  try {
    $response = curl.exe -i -s -w "`nHTTP_CODE:%{http_code}" $url 2>&1
    $output = ($response | Out-String)
    
    # Extract status code
    if ($output -match "HTTP_CODE:(\d+)") {
      $statusCode = $matches[1]
    } else {
      $statusCode = "unknown"
    }
    
    # Extract content-type
    $contentType = ""
    if ($output -match "(?im)^content-type:\s*([^\r\n;]+)") {
      $contentType = $matches[1].Trim().ToLower()
    }
    
    # Extract first 120 chars of body
    $bodyStart = ""
    $bodyMatch = $output -split "(\r?\n){2,}", 2
    if ($bodyMatch.Length -ge 2) {
      $body = $bodyMatch[1]
      $bodyStart = $body.Substring(0, [Math]::Min(120, $body.Length))
    }
    
    Write-Host "Status: $statusCode"
    Write-Host "Content-Type: $contentType"
    Write-Host "Body (first 120 chars): $bodyStart"
    
    return @{
      Status = $statusCode
      ContentType = $contentType
      BodyStart = $bodyStart
      Success = ($statusCode -eq "200" -and $contentType -like "application/json*")
    }
  } catch {
    Write-Host "Error: $_" -ForegroundColor Red
    return @{ Success = $false }
  }
}

# Check for VERCEL_TOKEN
if (-not $env:VERCEL_TOKEN) {
  Write-Host "ERROR: VERCEL_TOKEN environment variable is not set." -ForegroundColor Red
  Write-Host "Set it with: `$env:VERCEL_TOKEN='your-token'" -ForegroundColor Yellow
  exit 1
}

Write-Status "Deploying to Production"
$deployOutput = & npx vercel deploy --prod --yes --token $env:VERCEL_TOKEN 2>&1
$deployText = ($deployOutput | Out-String)

# Parse production URL
$urlMatch = [regex]::Match($deployText, "(https://[^\s]+\.vercel\.app)")
if (-not $urlMatch.Success) {
  Write-Host "ERROR: Could not parse deployment URL from output" -ForegroundColor Red
  Write-Host $deployText
  exit 1
}

$prodUrl = $urlMatch.Groups[1].Value
Write-Host "`nProduction URL: $prodUrl" -ForegroundColor Green

# Wait a moment for deployment to propagate
Write-Status "Waiting for deployment to propagate..."
Start-Sleep -Seconds 5

# Test endpoints
Write-Status "Testing Production Endpoints"
$pingResult = Test-Endpoint "$prodUrl/api/ping" "/api/ping"
$healthApiResult = Test-Endpoint "$prodUrl/api/healthz" "/api/healthz"
$healthResult = Test-Endpoint "$prodUrl/healthz" "/healthz"

# Summary
Write-Status "Test Results Summary"
$allPass = $pingResult.Success -and $healthApiResult.Success -and $healthResult.Success

if ($allPass) {
  Write-Host "`n✅ All endpoints returned JSON successfully!" -ForegroundColor Green
} else {
  Write-Host "`n❌ Some endpoints failed. Check output above." -ForegroundColor Red
  exit 1
}

Write-Status "Running Launch Status Check"
$env:DOMAINS = $prodUrl
$env:ALLOW_STRICT_WITHOUT_DEBUG = "true"
$launchStatusOutput = & npm run launch:status -- --strict 2>&1
$exitCode = $LASTEXITCODE

Write-Host "`nLaunch Status Exit Code: $exitCode"
Write-Host "`nLaunch Status Output:"
Write-Host ($launchStatusOutput | Out-String)

if (Test-Path "LAUNCH_STATUS.md") {
  Write-Status "Top Section of LAUNCH_STATUS.md"
  $launchStatusContent = Get-Content "LAUNCH_STATUS.md" -TotalCount 50
  Write-Host ($launchStatusContent -join "`n")
}

if ($exitCode -eq 0) {
  Write-Host "`n✅ PASS: All checks passed!" -ForegroundColor Green
  exit 0
} else {
  Write-Host "`n❌ FAIL: Launch status check failed. Fix issues and retry." -ForegroundColor Red
  exit 1
}
