# Test deployment script
# Set your Vercel token first: $env:VERCEL_TOKEN="your-token-here"

if ($env:VERCEL_TOKEN -eq $null -or $env:VERCEL_TOKEN -eq "PASTE_YOUR_TOKEN") {
    Write-Host "ERROR: VERCEL_TOKEN not set!" -ForegroundColor Red
    Write-Host "Please set it with: `$env:VERCEL_TOKEN='your-actual-token'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nDeploying preview to Vercel..." -ForegroundColor Cyan

# Deploy preview (force new artifact)
$deployOutput = npx vercel deploy --yes --force --token $env:VERCEL_TOKEN 2>&1 | Out-String
$preview = ($deployOutput | Select-String -Pattern "https://[^\s]+\.vercel\.app" | Select-Object -First 1)

if ($preview) {
    $previewUrl = $preview.Matches[0].Value
    $env:DEPLOY_URL = $previewUrl
    Write-Host "Deployed to: $previewUrl" -ForegroundColor Green
} else {
    Write-Host "ERROR: Could not extract preview URL from deployment output" -ForegroundColor Red
    Write-Host "Deployment output:" -ForegroundColor Yellow
    Write-Host $deployOutput
    exit 1
}

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host "`nTesting endpoints..." -ForegroundColor Cyan
Write-Host "`n1. Testing /api/ping:" -ForegroundColor Yellow
curl.exe -i "$env:DEPLOY_URL/api/ping?cb=$ts" | Select-Object -First 30

Write-Host "`n2. Testing /api/healthz:" -ForegroundColor Yellow
curl.exe -i "$env:DEPLOY_URL/api/healthz?cb=$ts" | Select-Object -First 30

Write-Host "`n3. Testing /healthz:" -ForegroundColor Yellow
curl.exe -i "$env:DEPLOY_URL/healthz?cb=$ts" | Select-Object -First 30

Write-Host "`nTest complete!" -ForegroundColor Green
