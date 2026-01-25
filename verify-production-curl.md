# Production Verification - curl Commands

Run these commands to verify production endpoints:

## 1. Check Home Page OG Tags
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$homeHtml = curl.exe -s "https://athlete-ledger.vercel.app/?cb=$ts"
$homeHtml | Select-String -Pattern 'property="og:title"[^>]*content="([^"]+)"'
# Expected: property="og:title" content="Athlete Ledger - Connect with College Coaches"
```

## 2. Check Demo Page OG Tags
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$demoHtml = curl.exe -s "https://athlete-ledger.vercel.app/demo?cb=$ts"
$demoHtml | Select-String -Pattern 'property="og:title"[^>]*content="([^"]+)"'
# Expected: property="og:title" content="Athlete Ledger - Demo"
```

## 3. Check /api/ping JSON and Content-Type
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
# Check Content-Type header
curl.exe -s -I "https://athlete-ledger.vercel.app/api/ping?cb=$ts" | Select-String "Content-Type"
# Expected: Content-Type: application/json; charset=utf-8

# Check JSON body
curl.exe -s "https://athlete-ledger.vercel.app/api/ping?cb=$ts"
# Expected: {"ok":true}
```

## 4. Check /healthz for buildId and configPresence
```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
curl.exe -s "https://athlete-ledger.vercel.app/healthz?cb=$ts" | ConvertFrom-Json | Format-List
# Expected: JSON with buildId and configPresence fields
```
