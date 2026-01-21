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

# Deploy to production
$deployOutput = & npx vercel deploy --prod --yes --token $env:VERCEL_TOKEN 2>&1
$deployText = ($deployOutput | Out-String)

# Parse production deploy URL from vercel output
$urlMatch = [regex]::Match($deployText, "(https://[^\s]+\.vercel\.app)")
if (-not $urlMatch.Success) {
  Fail "Could not parse production deploy URL from vercel output"
}
$prodUrl = $urlMatch.Groups[1].Value
Write-Host $prodUrl

Write-Host ""
Write-Host "Verifying production deployment: $prodUrl"

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
$ping = CurlGet "https://athlete-ledger.vercel.app/api/ping"
$healthApi = CurlGet "https://athlete-ledger.vercel.app/api/healthz"
$health = CurlGet "https://athlete-ledger.vercel.app/healthz"

AssertJson "/api/ping" $ping
AssertJson "/api/healthz" $healthApi
AssertJson "/healthz" $health

Write-Host ""
Write-Host "PASS"
exit 0
