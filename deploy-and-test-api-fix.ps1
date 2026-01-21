# Deploy and test API routing fix
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
    Write-Host "ERROR: VERCEL_TOKEN is not set. Set it first:" -ForegroundColor Red
    Write-Host '  $env:VERCEL_TOKEN="PASTE_YOUR_TOKEN"' -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== Deploying Preview (force new artifact) ===" -ForegroundColor Cyan
$previewOutput = npx vercel deploy --yes --force --token $env:VERCEL_TOKEN 2>&1 | Out-String
$preview = ($previewOutput | Select-String -Pattern "https://.*\.vercel\.app" | Select-Object -First 1).ToString().Trim()
$env:DEPLOY_URL = $preview
Write-Host "Preview URL: $preview" -ForegroundColor Green

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host "`n=== Testing Preview Endpoints ===" -ForegroundColor Cyan
Write-Host "`n/api/ping:" -ForegroundColor Yellow
curl.exe -i "$env:DEPLOY_URL/api/ping?cb=$ts" | Select-Object -First 30

Write-Host "`n/api/healthz:" -ForegroundColor Yellow
curl.exe -i "$env:DEPLOY_URL/api/healthz?cb=$ts" | Select-Object -First 30

Write-Host "`n/healthz:" -ForegroundColor Yellow
curl.exe -i "$env:DEPLOY_URL/healthz?cb=$ts" | Select-Object -First 30

Write-Host "`n=== Deploying Production (force new artifact) ===" -ForegroundColor Cyan
npx vercel deploy --prod --yes --force --token $env:VERCEL_TOKEN

$baseUrl = "https://athlete-ledger.vercel.app"
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host "`n=== Testing Production Endpoints ===" -ForegroundColor Cyan
Write-Host "`n/api/ping:" -ForegroundColor Yellow
curl.exe -i "$baseUrl/api/ping?cb=$ts" | Select-Object -First 30

Write-Host "`n/api/healthz:" -ForegroundColor Yellow
curl.exe -i "$baseUrl/api/healthz?cb=$ts" | Select-Object -First 30

Write-Host "`n/healthz:" -ForegroundColor Yellow
curl.exe -i "$baseUrl/healthz?cb=$ts" | Select-Object -First 30

Write-Host "`n=== Running launch:status (strict) ===" -ForegroundColor Cyan
$env:DOMAINS = $baseUrl
$env:ALLOW_STRICT_WITHOUT_DEBUG = "true"
npm run launch:status -- --strict
$exitCode = $LASTEXITCODE
Write-Host "`nExit code: $exitCode" -ForegroundColor $(if ($exitCode -eq 0) { "Green" } else { "Red" })
exit $exitCode
