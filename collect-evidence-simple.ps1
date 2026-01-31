# Hard Evidence Collection Script - Simplified Version
$ErrorActionPreference = "Continue"
$baseUrl = "https://athlete-ledger.vercel.app"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   EVIDENCE COLLECTION SCRIPT" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# SECTION 1: GIT INFORMATION
# =============================================================================
Write-Host "[1/5] Git Information" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

try {
    $currentCommit = git rev-parse HEAD
    $currentShort = $currentCommit.Substring(0, 7)
    Write-Host "Current Commit: $currentCommit ($currentShort)" -ForegroundColor Green
    
    $mainCommit = git rev-parse main
    $mainShort = $mainCommit.Substring(0, 7)
    Write-Host "Main Branch: $mainCommit ($mainShort)" -ForegroundColor Green
    
    $modifiedFiles = git status --porcelain
    if ($modifiedFiles) {
        Write-Host "WARNING: Working directory has uncommitted changes" -ForegroundColor Yellow
        Write-Host $modifiedFiles
    } else {
        Write-Host "Working directory is clean" -ForegroundColor Green
    }
} catch {
    Write-Host "ERROR: Failed to get git info: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# =============================================================================
# SECTION 2: VERCEL CLI STATUS
# =============================================================================
Write-Host "[2/5] Vercel CLI Status" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

try {
    $vercelVersion = npx vercel --version 2>&1 | Out-String
    Write-Host "Vercel CLI: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Vercel CLI not available" -ForegroundColor Red
}

Write-Host "Checking authentication..."
try {
    $vercelWho = npx vercel whoami 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Authenticated as: $vercelWho" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "Listing deployments..."
        npx vercel ls
    } else {
        Write-Host "NOT AUTHENTICATED. Run: npx vercel login" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: Authentication check failed" -ForegroundColor Red
}

Write-Host ""

# =============================================================================
# SECTION 3: PRODUCTION ENDPOINTS - Invoke-RestMethod
# =============================================================================
Write-Host "[3/5] Production Endpoint Testing" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

# Enable TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host ""
Write-Host "Testing /api/ping..." -ForegroundColor Cyan
try {
    $pingUrl = "${baseUrl}/api/ping?cb=$timestamp"
    $ping = Invoke-RestMethod -Uri $pingUrl -TimeoutSec 10
    Write-Host "SUCCESS: /api/ping responded" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $ping | ConvertTo-Json | Write-Host
} catch {
    Write-Host "FAILED: /api/ping - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Testing /healthz..." -ForegroundColor Cyan
try {
    $healthzUrl = "${baseUrl}/healthz?cb=$timestamp"
    $healthz = Invoke-RestMethod -Uri $healthzUrl -TimeoutSec 10
    Write-Host "SUCCESS: /healthz responded" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $healthz | ConvertTo-Json | Write-Host
} catch {
    Write-Host "FAILED: /healthz - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Testing /api/build-id..." -ForegroundColor Cyan
try {
    $buildIdUrl = "${baseUrl}/api/build-id?cb=$timestamp"
    $buildId = Invoke-RestMethod -Uri $buildIdUrl -TimeoutSec 10
    Write-Host "SUCCESS: /api/build-id responded" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $buildId | ConvertTo-Json | Write-Host
    
    if ($buildId.buildId) {
        Write-Host ""
        Write-Host "Build ID: $($buildId.buildId)" -ForegroundColor Cyan
        Write-Host "Expected (main): $mainShort" -ForegroundColor Cyan
        if ($buildId.buildId -eq $mainShort -or $buildId.buildId -eq $currentShort) {
            Write-Host "BUILD ID MATCHES!" -ForegroundColor Green
        } else {
            Write-Host "BUILD ID MISMATCH - Production may be outdated" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "FAILED: /api/build-id - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# =============================================================================
# SECTION 4: WAITLIST ENDPOINT TEST
# =============================================================================
Write-Host "[4/5] Waitlist Endpoint Test (POST)" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

$testTimestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$testEmail = "evidence-test-$testTimestamp@example.com"
$body = @{
    email = $testEmail
    source = "evidence_collection"
} | ConvertTo-Json

Write-Host "Test email: $testEmail" -ForegroundColor Gray

try {
    $waitlistUrl = "${baseUrl}/api/waitlist"
    $response = Invoke-RestMethod -Uri $waitlistUrl `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 10
    
    Write-Host "SUCCESS: /api/waitlist responded" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json | Write-Host
    
    if ($response.status) {
        Write-Host ""
        Write-Host "Status: $($response.status)" -ForegroundColor Cyan
        if ($response.status -eq "created") {
            Write-Host "  Email stored successfully (Supabase configured)" -ForegroundColor Green
        } elseif ($response.status -eq "accepted_no_storage") {
            Write-Host "  Accepted but NOT stored (Supabase not configured)" -ForegroundColor Yellow
        } elseif ($response.status -eq "already_registered") {
            Write-Host "  Email already exists (duplicate)" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "FAILED: /api/waitlist - $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        Write-Host "  HTTP Status: $statusCode" -ForegroundColor Red
    }
}

Write-Host ""

# =============================================================================
# SECTION 5: CONFIGURATION CHECK
# =============================================================================
Write-Host "[5/5] Configuration Check" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

# Check vercel.json
if (Test-Path "vercel.json") {
    Write-Host "Reading vercel.json..." -ForegroundColor Gray
    $vercelConfig = Get-Content "vercel.json" -Raw | ConvertFrom-Json
    
    Write-Host "Build command: $($vercelConfig.buildCommand)" -ForegroundColor Cyan
    Write-Host "Output directory: $($vercelConfig.outputDirectory)" -ForegroundColor Cyan
    
    if ($vercelConfig.routes) {
        Write-Host "Routing: Using 'routes' (GOOD)" -ForegroundColor Green
        $hasFilesystem = $false
        foreach ($route in $vercelConfig.routes) {
            if ($route.handle -eq "filesystem") {
                $hasFilesystem = $true
                break
            }
        }
        if ($hasFilesystem) {
            Write-Host "  Has 'handle: filesystem' (GOOD - allows API detection)" -ForegroundColor Green
        } else {
            Write-Host "  Missing 'handle: filesystem' (MAY CAUSE ISSUES)" -ForegroundColor Yellow
        }
    } elseif ($vercelConfig.rewrites) {
        Write-Host "Routing: Using 'rewrites' (PROBLEM - use 'routes' instead)" -ForegroundColor Yellow
    }
} else {
    Write-Host "ERROR: vercel.json not found!" -ForegroundColor Red
}

# Check critical files
Write-Host ""
Write-Host "Checking critical files..." -ForegroundColor Gray
$files = @("package.json", "vite.config.ts", "api/waitlist.ts", "api/healthz.ts")
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  $file - OK" -ForegroundColor Green
    } else {
        Write-Host "  $file - MISSING!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   COLLECTION COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "See EVIDENCE_REPORT.md for full analysis" -ForegroundColor Yellow
Write-Host ""
