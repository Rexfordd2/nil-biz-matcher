# Hard Evidence Collection Script
# Attempts multiple methods to collect deployment evidence

$ErrorActionPreference = "Continue"
$baseUrl = "https://athlete-ledger.vercel.app"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   EVIDENCE COLLECTION SCRIPT" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# SECTION 1: GIT INFORMATION
# =============================================================================
Write-Host "[1/6] Git Information" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

try {
    $currentCommit = git rev-parse HEAD
    $currentShort = $currentCommit.Substring(0, 7)
    Write-Host "✓ Current Commit: $currentCommit" -ForegroundColor Green
    Write-Host "  Short SHA: $currentShort" -ForegroundColor Green
    
    $mainCommit = git rev-parse main
    $mainShort = $mainCommit.Substring(0, 7)
    Write-Host "✓ Main Branch: $mainCommit" -ForegroundColor Green
    Write-Host "  Short SHA: $mainShort" -ForegroundColor Green
    
    $isDirty = git status --porcelain
    if ($isDirty) {
        Write-Host "⚠ Working directory has uncommitted changes" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Working directory clean" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Failed to get git info: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# =============================================================================
# SECTION 2: VERCEL CLI STATUS
# =============================================================================
Write-Host "[2/6] Vercel CLI Status" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

try {
    $vercelVersion = npx vercel --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Vercel CLI: $vercelVersion" -ForegroundColor Green
    } else {
        Write-Host "⚠ Vercel CLI available but may need setup" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Vercel CLI not available" -ForegroundColor Red
}

# Check authentication
Write-Host ""
Write-Host "Checking Vercel authentication..." -ForegroundColor Gray
$vercelAuth = npx vercel whoami 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Authenticated as: $vercelAuth" -ForegroundColor Green
    
    # Try to list deployments
    Write-Host ""
    Write-Host "Fetching deployments..." -ForegroundColor Gray
    $deployments = npx vercel ls 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Recent deployments:" -ForegroundColor Green
        Write-Host $deployments
    } else {
        Write-Host "✗ Failed to list deployments" -ForegroundColor Red
    }
} else {
    Write-Host "✗ Not authenticated. Run: npx vercel login" -ForegroundColor Red
    Write-Host "  Or set VERCEL_TOKEN environment variable" -ForegroundColor Yellow
}

Write-Host ""

# =============================================================================
# SECTION 3: PRODUCTION ENDPOINT TESTING
# =============================================================================
Write-Host "[3/6] Production Endpoint Testing" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

# Test with different methods
$methods = @(
    @{ Name = "Invoke-RestMethod"; Command = { param($url) Invoke-RestMethod -Uri $url -TimeoutSec 10 } },
    @{ Name = "Invoke-WebRequest"; Command = { param($url) Invoke-WebRequest -Uri $url -TimeoutSec 10 } },
    @{ Name = "System.Net.WebClient"; Command = { param($url) (New-Object System.Net.WebClient).DownloadString($url) } }
)

$endpoints = @(
    @{ Path = "/"; ExpectedType = "text/html"; Description = "Root (SPA)" },
    @{ Path = "/api/ping"; ExpectedType = "application/json"; Description = "Ping API" },
    @{ Path = "/healthz"; ExpectedType = "application/json"; Description = "Health Check" },
    @{ Path = "/api/build-id"; ExpectedType = "application/json"; Description = "Build ID API" }
)

foreach ($endpoint in $endpoints) {
    Write-Host ""
    Write-Host "Testing: $($endpoint.Description)" -ForegroundColor Cyan
    $url = "${baseUrl}$($endpoint.Path)?cb=$(Get-Date -UFormat %s)"
    Write-Host "  URL: $url" -ForegroundColor Gray
    
    $success = $false
    foreach ($method in $methods) {
        if ($success) { break }
        
        Write-Host "  Trying: $($method.Name)..." -ForegroundColor Gray
        try {
            $result = & $method.Command $url
            
            if ($method.Name -eq "Invoke-WebRequest") {
                $statusCode = $result.StatusCode
                $contentType = $result.Headers["Content-Type"]
                $content = $result.Content
            } elseif ($method.Name -eq "Invoke-RestMethod") {
                $statusCode = 200
                $contentType = "unknown"
                $content = $result | ConvertTo-Json -Depth 3
            } else {
                $statusCode = 200
                $contentType = "unknown"
                $content = $result
            }
            
            Write-Host "  ✓ Status: $statusCode" -ForegroundColor Green
            Write-Host "  ✓ Content-Type: $contentType" -ForegroundColor Green
            
            # Check if content type matches expected
            if ($contentType -like "*$($endpoint.ExpectedType)*") {
                Write-Host "  ✓ Content-Type is correct" -ForegroundColor Green
            } else {
                Write-Host "  ⚠ Expected $($endpoint.ExpectedType), got $contentType" -ForegroundColor Yellow
            }
            
            # Show content preview
            $preview = $content.Substring(0, [Math]::Min(200, $content.Length))
            Write-Host "  Content preview: $preview..." -ForegroundColor Gray
            
            # Try to parse as JSON if applicable
            if ($endpoint.ExpectedType -eq "application/json") {
                try {
                    $json = $content | ConvertFrom-Json
                    Write-Host "  ✓ Valid JSON response" -ForegroundColor Green
                    if ($json.buildId) {
                        Write-Host "  ✓ Build ID: $($json.buildId)" -ForegroundColor Green
                    }
                } catch {
                    Write-Host "  ✗ Failed to parse JSON" -ForegroundColor Red
                }
            }
            
            $success = $true
        } catch {
            Write-Host "  ✗ $($method.Name) failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    if (-not $success) {
        Write-Host "  ✗ All methods failed for this endpoint" -ForegroundColor Red
    }
}

Write-Host ""

# =============================================================================
# SECTION 4: WAITLIST ENDPOINT TEST
# =============================================================================
Write-Host "[4/6] Waitlist Endpoint Test (POST)" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

$testEmail = "evidence-test+$(Get-Date -UFormat %s)@example.com"
$body = @{
    email = $testEmail
    source = "evidence_collection_script"
    anon_id = "test-$(Get-Random)"
} | ConvertTo-Json

Write-Host "Test email: $testEmail" -ForegroundColor Gray
Write-Host "Request body: $body" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "${baseUrl}/api/waitlist" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 10
    
    Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "✓ Response: $($response.Content)" -ForegroundColor Green
    
    # Parse response
    try {
        $json = $response.Content | ConvertFrom-Json
        Write-Host ""
        Write-Host "Parsed response:" -ForegroundColor Cyan
        Write-Host "  ok: $($json.ok)" -ForegroundColor $(if ($json.ok) { "Green" } else { "Red" })
        Write-Host "  status: $($json.status)" -ForegroundColor Cyan
        
        # Interpret status
        switch ($json.status) {
            "created" { Write-Host "  ✓ Email stored successfully (Supabase configured)" -ForegroundColor Green }
            "already_registered" { Write-Host "  ℹ Email already exists (duplicate)" -ForegroundColor Cyan }
            "accepted_no_storage" { Write-Host "  ⚠ Accepted but not stored (Supabase not configured)" -ForegroundColor Yellow }
            "honeypot_rejected" { Write-Host "  ⚠ Honeypot triggered (should not happen in this test)" -ForegroundColor Yellow }
            default { Write-Host "  ? Unknown status: $($json.status)" -ForegroundColor Magenta }
        }
    } catch {
        Write-Host "✗ Failed to parse response JSON" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ POST request failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        Write-Host "  HTTP Status: $statusCode" -ForegroundColor Red
    }
}

Write-Host ""

# =============================================================================
# SECTION 5: LOCAL ENVIRONMENT CHECK
# =============================================================================
Write-Host "[5/6] Local Environment Check" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

# Check if local dev server can start
Write-Host "Checking if local dev server can start..." -ForegroundColor Gray

# Check for .env file
if (Test-Path ".env") {
    Write-Host "✓ .env file exists" -ForegroundColor Green
} else {
    Write-Host "⚠ No .env file found (may use defaults)" -ForegroundColor Yellow
}

# Check node_modules
if (Test-Path "node_modules") {
    Write-Host "✓ node_modules directory exists" -ForegroundColor Green
} else {
    Write-Host "✗ node_modules not found. Run: npm install" -ForegroundColor Red
}

# Check critical files
$criticalFiles = @(
    "package.json",
    "vercel.json",
    "vite.config.ts",
    "api/waitlist.ts",
    "api/healthz.ts"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ Missing: $file" -ForegroundColor Red
    }
}

Write-Host ""

# =============================================================================
# SECTION 6: CONFIGURATION ANALYSIS
# =============================================================================
Write-Host "[6/6] Configuration Analysis" -ForegroundColor Yellow
Write-Host "---------------------------------------------"

# Read vercel.json
if (Test-Path "vercel.json") {
    $vercelJson = Get-Content "vercel.json" | ConvertFrom-Json
    Write-Host "vercel.json configuration:" -ForegroundColor Cyan
    Write-Host "  Build command: $($vercelJson.buildCommand)" -ForegroundColor Gray
    Write-Host "  Output directory: $($vercelJson.outputDirectory)" -ForegroundColor Gray
    Write-Host "  Install command: $($vercelJson.installCommand)" -ForegroundColor Gray
    
    # Check routing configuration
    if ($vercelJson.routes) {
        Write-Host "  ✓ Using 'routes' (recommended)" -ForegroundColor Green
        $hasFilesystem = $vercelJson.routes | Where-Object { $_.handle -eq "filesystem" }
        if ($hasFilesystem) {
            Write-Host "  ✓ Has 'handle: filesystem' (allows API detection)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Missing 'handle: filesystem' (may cause API issues)" -ForegroundColor Yellow
        }
    } elseif ($vercelJson.rewrites) {
        Write-Host "  ⚠ Using 'rewrites' (may cause issues, prefer 'routes')" -ForegroundColor Yellow
    }
}

Write-Host ""

# =============================================================================
# SUMMARY
# =============================================================================
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   EVIDENCE COLLECTION COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "See EVIDENCE_REPORT.md for detailed analysis" -ForegroundColor Yellow
Write-Host "See UNBLOCK_INSTRUCTIONS.md if issues found" -ForegroundColor Yellow
Write-Host ""
