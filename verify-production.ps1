# Production Verification Script
# Verifies OG tags, API endpoints, and health checks

$baseUrl = "https://athlete-ledger.vercel.app"
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$allPassed = $true

Write-Host "`n=== Production Verification ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Gray
Write-Host "Timestamp: $ts`n" -ForegroundColor Gray

# 1. Verify Home Page OG Tags
Write-Host "[1] Checking Home Page OG Tags..." -ForegroundColor Yellow
try {
    $homeResponse = Invoke-WebRequest -Uri "$baseUrl/?cb=$ts" -UseBasicParsing -ErrorAction Stop
    $homeHtml = $homeResponse.Content
    
    if ($homeHtml -match 'property="og:title"[^>]*content="([^"]+)"') {
        $homeOgTitle = $matches[1]
    } elseif ($homeHtml -match '<meta\s+property="og:title"\s+content="([^"]+)"') {
        $homeOgTitle = $matches[1]
    } else {
        $homeOgTitle = ""
    }
    
    $expectedTitle = "NIL Roster — Recruiting, Relationships, and Opportunity Beyond the Game"
    
    if ($homeOgTitle -eq $expectedTitle) {
        Write-Host "  PASS: Home OG title matches expected value" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: Expected '$expectedTitle', got '$homeOgTitle'" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  FAIL: Error checking home OG tags: $_" -ForegroundColor Red
    $allPassed = $false
}

# 2. Verify Demo Page OG Tags
Write-Host "`n[2] Checking Demo Page OG Tags..." -ForegroundColor Yellow
try {
    $demoResponse = Invoke-WebRequest -Uri "$baseUrl/demo?cb=$ts" -UseBasicParsing -ErrorAction Stop
    $demoHtml = $demoResponse.Content
    
    if ($demoHtml -match 'property="og:title"[^>]*content="([^"]+)"') {
        $demoOgTitle = $matches[1]
    } elseif ($demoHtml -match '<meta\s+property="og:title"\s+content="([^"]+)"') {
        $demoOgTitle = $matches[1]
    } else {
        $demoOgTitle = ""
    }
    
    $expectedDemoTitle = "NIL Roster — Demo"
    
    if ($demoOgTitle -eq $expectedDemoTitle) {
        Write-Host "  PASS: Demo OG title matches expected value" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: Expected '$expectedDemoTitle', got '$demoOgTitle'" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  FAIL: Error checking demo OG tags: $_" -ForegroundColor Red
    $allPassed = $false
}

# 3. Verify /api/ping returns JSON and correct Content-Type
Write-Host "`n[3] Checking /api/ping endpoint..." -ForegroundColor Yellow
try {
    $pingHeaders = curl.exe -s -I "$baseUrl/api/ping?cb=$ts"
    $pingBody = curl.exe -s "$baseUrl/api/ping?cb=$ts"
    $contentType = $pingHeaders | Select-String -Pattern "Content-Type:\s*([^\r\n]+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() }
    
    # Check Content-Type
    if ($contentType -match "application/json") {
        Write-Host "  PASS: Content-Type includes 'application/json' ($contentType)" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: Content-Type does not include 'application/json' (got: $contentType)" -ForegroundColor Red
        $allPassed = $false
    }
    
    # Check JSON response body
    try {
        $pingJson = $pingBody | ConvertFrom-Json
        if ($pingJson.ok -eq $true) {
            Write-Host "  PASS: Response is valid JSON with ok=true" -ForegroundColor Green
        } else {
            Write-Host "  FAIL: Response JSON does not have ok=true" -ForegroundColor Red
            $allPassed = $false
        }
    } catch {
        Write-Host "  FAIL: Response is not valid JSON: $_" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  FAIL: Error checking /api/ping: $_" -ForegroundColor Red
    $allPassed = $false
}

# 4. Verify /healthz returns buildId and configPresence
Write-Host "`n[4] Checking /healthz endpoint..." -ForegroundColor Yellow
try {
    $healthzBody = curl.exe -s "$baseUrl/healthz?cb=$ts"
    
    try {
        $healthzJson = $healthzBody | ConvertFrom-Json
        
        $hasBuildId = $healthzJson.PSObject.Properties.Name -contains "buildId"
        $hasConfigPresence = $healthzJson.PSObject.Properties.Name -contains "configPresence"
        
        if ($hasBuildId -and $hasConfigPresence) {
            Write-Host "  PASS: Response contains buildId and configPresence" -ForegroundColor Green
            Write-Host "    buildId: $($healthzJson.buildId)" -ForegroundColor Gray
            Write-Host "    configPresence: $($healthzJson.configPresence)" -ForegroundColor Gray
        } else {
            Write-Host "  FAIL: Missing required fields" -ForegroundColor Red
            Write-Host "    Has buildId: $hasBuildId" -ForegroundColor Red
            Write-Host "    Has configPresence: $hasConfigPresence" -ForegroundColor Red
            $allPassed = $false
        }
    } catch {
        Write-Host "  FAIL: Response is not valid JSON: $_" -ForegroundColor Red
        Write-Host "    Response body: $healthzBody" -ForegroundColor Gray
        $allPassed = $false
    }
} catch {
    Write-Host "  FAIL: Error checking /healthz: $_" -ForegroundColor Red
    $allPassed = $false
}

# Summary
Write-Host "`n=== Verification Summary ===" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "SOME CHECKS FAILED" -ForegroundColor Red
    exit 1
}
