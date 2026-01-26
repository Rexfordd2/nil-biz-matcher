$ErrorActionPreference = "Stop"

function Fail($msg) {
  Write-Host "FAIL: $msg"
  exit 1
}

function Pass($msg) {
  Write-Host "PASS: $msg"
}

if ([string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
  Fail "VERCEL_TOKEN is not set. Set it in this PowerShell session: `$env:VERCEL_TOKEN='...'`"
}

# Deploy preview
Write-Host "Deploying preview to Vercel..."
$deployOutput = & npx vercel deploy --yes --token $env:VERCEL_TOKEN 2>&1
$deployText = ($deployOutput | Out-String)

# Extract first URL that looks like a Vercel deployment URL
$deployUrlMatch = [regex]::Match($deployText, 'https://[a-zA-Z0-9\-]+\.vercel\.app')
if (-not $deployUrlMatch.Success) {
  Fail "Could not parse deploy URL from Vercel output. Output was:`n$deployText"
}
$deployUrl = $deployUrlMatch.Value.Trim()
Pass "Preview deployed: $deployUrl"

function CurlGet($url) {
  $resp = & curl.exe -i $url 2>&1
  return ($resp | Out-String)
}

function GetContentType($raw) {
  $m = [regex]::Match($raw, "(?im)^content-type:\s*([^\r\n;]+)")
  if ($m.Success) { return $m.Groups[1].Value.Trim().ToLower() }
  return ""
}

function GetBody($raw) {
  # Split headers/body by first blank line
  $parts = $raw -split "(\r?\n){2}", 2
  if ($parts.Length -ge 2) { return $parts[1] }
  return ""
}

function AssertJson($name, $raw) {
  $ct = GetContentType $raw
  if ($ct -notlike "application/json*") { Fail "$name expected application/json but got '$ct'." }

  $body = (GetBody $raw).Trim()
  if (-not ($body.StartsWith("{") -or $body.StartsWith("["))) {
    Fail "$name expected JSON body but got: $($body.Substring(0, [Math]::Min(200, $body.Length)))"
  }
  Pass "$name returned JSON"
}

function AssertHtml($name, $raw) {
  $ct = GetContentType $raw
  if ($ct -notlike "text/html*") { Fail "$name expected text/html but got '$ct'." }

  $body = (GetBody $raw).Trim()
  if (-not $body.ToLower().Contains("<html")) {
    Fail "$name expected HTML body but got: $($body.Substring(0, [Math]::Min(200, $body.Length)))"
  }
  Pass "$name returned HTML"
}

# Proof checks
$ping = CurlGet "$deployUrl/api/ping"
$healthApi = CurlGet "$deployUrl/api/healthz"
$health = CurlGet "$deployUrl/healthz"
$spa = CurlGet "$deployUrl/some/spa/route"

AssertJson "/api/ping" $ping
AssertJson "/api/healthz" $healthApi
AssertJson "/healthz" $health
AssertHtml "/some/spa/route" $spa

Write-Host ""
Write-Host "All checks passed for preview deployment."
exit 0
