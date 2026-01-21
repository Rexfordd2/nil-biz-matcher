$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
  Write-Host "VERCEL_TOKEN is not set. Set it: `$env:VERCEL_TOKEN='...'"
  exit 1
}

Write-Host "Deploying preview to Vercel with --force..."
$deployOutput = & npx vercel deploy --force --yes --token $env:VERCEL_TOKEN 2>&1
$deployText = ($deployOutput | Out-String)
Write-Host $deployText
Write-Host "`n=== DEPLOY OUTPUT END ===`n"

$deployUrlMatch = [regex]::Match($deployText, 'https://[a-zA-Z0-9\-]+\.vercel\.app')
if (-not $deployUrlMatch.Success) {
  Write-Host "ERROR: Could not parse deploy URL from output."
  exit 1
}
$deployUrl = $deployUrlMatch.Value.Trim()
Write-Host "Preview deployed: $deployUrl`n"

function CurlProof($url, $name) {
  $cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $fullUrl = "$url`?t=$cacheBuster"
  Write-Host "Testing $name ($fullUrl)..."
  $resp = & curl.exe -i $fullUrl 2>&1
  $respText = ($resp | Out-String)
  
  $headers = ($respText -split "(\r?\n){2}", 2)[0]
  $body = if (($respText -split "(\r?\n){2}", 2).Length -ge 2) { ($respText -split "(\r?\n){2}", 2)[1] } else { "" }
  
  Write-Host "Headers:"
  Write-Host $headers
  Write-Host "`nBody (first 120 chars):"
  $bodyTrim = $body.Trim()
  if ($bodyTrim.Length -gt 120) {
    Write-Host $bodyTrim.Substring(0, 120) + "..."
  } else {
    Write-Host $bodyTrim
  }
  Write-Host "`n---`n"
}

CurlProof "$deployUrl/api/ping" "/api/ping"
CurlProof "$deployUrl/api/healthz" "/api/healthz"
CurlProof "$deployUrl/healthz" "/healthz"
