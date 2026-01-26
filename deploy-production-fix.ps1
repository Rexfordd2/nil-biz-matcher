$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
  Write-Host "ERROR: VERCEL_TOKEN is not set. Set it first:" -ForegroundColor Red
  Write-Host '  $env:VERCEL_TOKEN="your-token"' -ForegroundColor Yellow
  exit 1
}

# Step 1: Deploy preview
Write-Host "`n=== Deploying Preview ===" -ForegroundColor Cyan
$previewOutput = & npx vercel deploy --yes --force --token $env:VERCEL_TOKEN 2>&1 | Out-String
$previewUrlMatch = [regex]::Match($previewOutput, 'https://[a-zA-Z0-9\-]+\.vercel\.app')
if (-not $previewUrlMatch.Success) {
  Write-Host "FAIL: Could not parse preview URL" -ForegroundColor Red
  Write-Host $previewOutput
  exit 1
}
$previewUrl = $previewUrlMatch.Value.Trim()
Write-Host "Preview URL: $previewUrl" -ForegroundColor Green

# Wait for deployment
Start-Sleep -Seconds 10

# Step 2: Verify preview endpoints with cache-busting
Write-Host "`n=== Verifying Preview Endpoints ===" -ForegroundColor Cyan
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$pingResp = & curl.exe -s -i "$previewUrl/api/ping?t=$timestamp" 2>&1 | Out-String
$healthzApiResp = & curl.exe -s -i "$previewUrl/api/healthz?t=$timestamp" 2>&1 | Out-String
$healthzResp = & curl.exe -s -i "$previewUrl/healthz?t=$timestamp" 2>&1 | Out-String

Write-Host "`n/api/ping:" -ForegroundColor Yellow
$pingStatus = ([regex]::Match($pingResp, '(?im)^HTTP/[^\s]+\s+(\d+)')).Groups[1].Value
$pingContentType = ([regex]::Match($pingResp, '(?im)^content-type:\s*([^\r\n;]+)')).Groups[1].Value.Trim()
$pingBody = ($pingResp -split "(\r?\n){2}", 2)[1]
$pingPreview = $pingBody.Substring(0, [Math]::Min(120, $pingBody.Length))
Write-Host "  Status: $pingStatus"
Write-Host "  Content-Type: $pingContentType"
Write-Host "  Body (first 120 chars): $pingPreview"

Write-Host "`n/api/healthz:" -ForegroundColor Yellow
$healthzApiStatus = ([regex]::Match($healthzApiResp, '(?im)^HTTP/[^\s]+\s+(\d+)')).Groups[1].Value
$healthzApiContentType = ([regex]::Match($healthzApiResp, '(?im)^content-type:\s*([^\r\n;]+)')).Groups[1].Value.Trim()
$healthzApiBody = ($healthzApiResp -split "(\r?\n){2}", 2)[1]
$healthzApiPreview = $healthzApiBody.Substring(0, [Math]::Min(120, $healthzApiBody.Length))
Write-Host "  Status: $healthzApiStatus"
Write-Host "  Content-Type: $healthzApiContentType"
Write-Host "  Body (first 120 chars): $healthzApiPreview"

Write-Host "`n/healthz:" -ForegroundColor Yellow
$healthzStatus = ([regex]::Match($healthzResp, '(?im)^HTTP/[^\s]+\s+(\d+)')).Groups[1].Value
$healthzContentType = ([regex]::Match($healthzResp, '(?im)^content-type:\s*([^\r\n;]+)')).Groups[1].Value.Trim()
$healthzBody = ($healthzResp -split "(\r?\n){2}", 2)[1]
$healthzPreview = $healthzBody.Substring(0, [Math]::Min(120, $healthzBody.Length))
Write-Host "  Status: $healthzStatus"
Write-Host "  Content-Type: $healthzContentType"
Write-Host "  Body (first 120 chars): $healthzPreview"

# Step 3: Deploy production
Write-Host "`n=== Deploying Production ===" -ForegroundColor Cyan
$prodOutput = & npx vercel deploy --prod --yes --force --token $env:VERCEL_TOKEN 2>&1 | Out-String
$prodUrlMatch = [regex]::Match($prodOutput, 'https://[a-zA-Z0-9\-]+\.vercel\.app')
if (-not $prodUrlMatch.Success) {
  Write-Host "FAIL: Could not parse production URL" -ForegroundColor Red
  Write-Host $prodOutput
  exit 1
}
$prodUrl = $prodUrlMatch.Value.Trim()
Write-Host "Production URL: $prodUrl" -ForegroundColor Green

# Wait for deployment
Start-Sleep -Seconds 10

# Step 4: Verify production endpoints with cache-busting
Write-Host "`n=== Verifying Production Endpoints ===" -ForegroundColor Cyan
$timestamp2 = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$pingProdResp = & curl.exe -s -i "$prodUrl/api/ping?t=$timestamp2" 2>&1 | Out-String
$healthzApiProdResp = & curl.exe -s -i "$prodUrl/api/healthz?t=$timestamp2" 2>&1 | Out-String
$healthzProdResp = & curl.exe -s -i "$prodUrl/healthz?t=$timestamp2" 2>&1 | Out-String

Write-Host "`n/api/ping:" -ForegroundColor Yellow
$pingProdStatus = ([regex]::Match($pingProdResp, '(?im)^HTTP/[^\s]+\s+(\d+)')).Groups[1].Value
$pingProdContentType = ([regex]::Match($pingProdResp, '(?im)^content-type:\s*([^\r\n;]+)')).Groups[1].Value.Trim()
$pingProdBody = ($pingProdResp -split "(\r?\n){2}", 2)[1]
$pingProdPreview = $pingProdBody.Substring(0, [Math]::Min(120, $pingProdBody.Length))
Write-Host "  Status: $pingProdStatus"
Write-Host "  Content-Type: $pingProdContentType"
Write-Host "  Body (first 120 chars): $pingProdPreview"

Write-Host "`n/api/healthz:" -ForegroundColor Yellow
$healthzApiProdStatus = ([regex]::Match($healthzApiProdResp, '(?im)^HTTP/[^\s]+\s+(\d+)')).Groups[1].Value
$healthzApiProdContentType = ([regex]::Match($healthzApiProdResp, '(?im)^content-type:\s*([^\r\n;]+)')).Groups[1].Value.Trim()
$healthzApiProdBody = ($healthzApiProdResp -split "(\r?\n){2}", 2)[1]
$healthzApiProdPreview = $healthzApiProdBody.Substring(0, [Math]::Min(120, $healthzApiProdBody.Length))
Write-Host "  Status: $healthzApiProdStatus"
Write-Host "  Content-Type: $healthzApiProdContentType"
Write-Host "  Body (first 120 chars): $healthzApiProdPreview"

Write-Host "`n/healthz:" -ForegroundColor Yellow
$healthzProdStatus = ([regex]::Match($healthzProdResp, '(?im)^HTTP/[^\s]+\s+(\d+)')).Groups[1].Value
$healthzProdContentType = ([regex]::Match($healthzProdResp, '(?im)^content-type:\s*([^\r\n;]+)')).Groups[1].Value.Trim()
$healthzProdBody = ($healthzProdResp -split "(\r?\n){2}", 2)[1]
$healthzProdPreview = $healthzProdBody.Substring(0, [Math]::Min(120, $healthzProdBody.Length))
Write-Host "  Status: $healthzProdStatus"
Write-Host "  Content-Type: $healthzProdContentType"
Write-Host "  Body (first 120 chars): $healthzProdPreview"

# Step 5: Run strict gate
Write-Host "`n=== Running Strict Gate ===" -ForegroundColor Cyan
$env:DOMAINS = "https://athlete-ledger.vercel.app"
$env:ALLOW_STRICT_WITHOUT_DEBUG = "true"
$launchStatusExit = 0
& npm run launch:status -- --strict 2>&1 | Out-String
$launchStatusExit = $LASTEXITCODE

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Commit: edf2e26770c26022b4a34abdb9aba388f9641e11"
Write-Host "Preview URL: $previewUrl"
Write-Host "Production URL: $prodUrl"
Write-Host "launch:status exit code: $launchStatusExit"

if ($launchStatusExit -ne 0) {
  Write-Host "`nFAIL: launch:status exited with code $launchStatusExit" -ForegroundColor Red
  exit 1
}

Write-Host "`nAll checks passed!" -ForegroundColor Green
