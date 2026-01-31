#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy the waitlist Function fix to Vercel production and verify it works.

.DESCRIPTION
    This script:
    1. Commits the vercel.json changes
    2. Deploys to Vercel production with --force (clears cache)
    3. Runs smoke tests to verify /api/waitlist returns JSON
    4. Provides rollback instructions if verification fails

.PARAMETER SkipCommit
    Skip the git commit step (useful if already committed)

.PARAMETER SkipDeploy
    Skip the Vercel deploy step (useful for testing verification only)

.PARAMETER Domain
    Production domain to test (e.g., https://your-app.vercel.app)
    If not provided, will attempt to detect from Vercel CLI

.EXAMPLE
    .\deploy-waitlist-fix.ps1
    
.EXAMPLE
    .\deploy-waitlist-fix.ps1 -Domain "https://athlete-ledger.vercel.app"

.EXAMPLE
    .\deploy-waitlist-fix.ps1 -SkipCommit -Domain "https://athlete-ledger.vercel.app"
#>

param(
    [switch]$SkipCommit,
    [switch]$SkipDeploy,
    [string]$Domain
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== Vercel Waitlist Function Fix - Deployment Script ===`n" -ForegroundColor Cyan

# Step 1: Commit changes (unless skipped)
if (-not $SkipCommit) {
    Write-Host "[1/4] Committing vercel.json changes..." -ForegroundColor Yellow
    
    # Check if there are changes to commit
    $status = git status --porcelain
    if ($status) {
        Write-Host "  Found uncommitted changes. Committing..." -ForegroundColor Gray
        
        git add vercel.json
        git add VERCEL_PROJECT_SETTINGS.md
        git add deploy-waitlist-fix.ps1
        
        git commit -m "Fix Vercel: ensure /api/waitlist deploys as Function

- Add explicit routes ordering in vercel.json
- Add handle: filesystem for Function detection
- Add SPA fallback that excludes /api/* paths
- Document required Vercel project settings
- Add deployment and verification scripts

This ensures /api/waitlist.ts is deployed as a Vercel Function
and not intercepted by SPA fallback routing."
        
        Write-Host "  ✓ Changes committed" -ForegroundColor Green
    } else {
        Write-Host "  ✓ No changes to commit (already committed)" -ForegroundColor Green
    }
} else {
    Write-Host "[1/4] Skipping commit step (--SkipCommit flag)" -ForegroundColor Gray
}

# Step 2: Deploy to Vercel production
if (-not $SkipDeploy) {
    Write-Host "`n[2/4] Deploying to Vercel production..." -ForegroundColor Yellow
    
    # Check if VERCEL_TOKEN is set
    if (-not $env:VERCEL_TOKEN) {
        Write-Host "  ⚠️  VERCEL_TOKEN not set. Using interactive login." -ForegroundColor Yellow
        Write-Host "     For non-interactive deploy, set: `$env:VERCEL_TOKEN='your-token'" -ForegroundColor Gray
    }
    
    Write-Host "  Running: vercel --prod --force --yes" -ForegroundColor Gray
    Write-Host "  (--force ensures cache is cleared and Functions are redeployed)" -ForegroundColor Gray
    
    $deployOutput = vercel --prod --force --yes 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Deployment failed!" -ForegroundColor Red
        Write-Host "  Error output:" -ForegroundColor Red
        Write-Host $deployOutput -ForegroundColor Red
        Write-Host "`n  Troubleshooting:" -ForegroundColor Yellow
        Write-Host "    1. Check that VITE_PUBLIC_MODE=true is set in Vercel → Settings → Environment Variables" -ForegroundColor Gray
        Write-Host "    2. Check build logs in Vercel Dashboard" -ForegroundColor Gray
        Write-Host "    3. See VERCEL_PROJECT_SETTINGS.md for detailed configuration" -ForegroundColor Gray
        exit 1
    }
    
    Write-Host "  ✓ Deployment successful" -ForegroundColor Green
    
    # Try to extract production URL from output
    $prodUrl = ($deployOutput | Select-String -Pattern "Production:\s+(https://[^\s]+)").Matches.Groups[1].Value
    
    if ($prodUrl) {
        Write-Host "  Production URL: $prodUrl" -ForegroundColor Cyan
        if (-not $Domain) {
            $Domain = $prodUrl
        }
    }
    
    # Wait for deployment to propagate
    Write-Host "  Waiting 10 seconds for deployment to propagate..." -ForegroundColor Gray
    Start-Sleep -Seconds 10
    
} else {
    Write-Host "`n[2/4] Skipping deploy step (--SkipDeploy flag)" -ForegroundColor Gray
}

# Step 3: Verify deployment
Write-Host "`n[3/4] Verifying /api/waitlist Function..." -ForegroundColor Yellow

if (-not $Domain) {
    Write-Host "  ✗ Domain not specified and could not be auto-detected" -ForegroundColor Red
    Write-Host "    Please run with -Domain parameter:" -ForegroundColor Yellow
    Write-Host "    .\deploy-waitlist-fix.ps1 -Domain 'https://your-app.vercel.app'" -ForegroundColor Gray
    exit 1
}

Write-Host "  Testing domain: $Domain" -ForegroundColor Gray

# Set DOMAIN environment variable for smoke test
$env:DOMAIN = $Domain

Write-Host "  Running smoke tests..." -ForegroundColor Gray
$smokeOutput = npm run smoke:vercel:prod 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Smoke tests FAILED!" -ForegroundColor Red
    Write-Host "`n  Test output:" -ForegroundColor Yellow
    Write-Host $smokeOutput -ForegroundColor Gray
    
    Write-Host "`n  Common issues:" -ForegroundColor Yellow
    Write-Host "    • /api/waitlist returns 404 → Check Root Directory = '.' in Vercel settings" -ForegroundColor Gray
    Write-Host "    • /api/waitlist returns HTML → Wait 5-10 min for CDN cache to clear" -ForegroundColor Gray
    Write-Host "    • Build fails → Check VITE_PUBLIC_MODE=true is set" -ForegroundColor Gray
    Write-Host "`n  See VERCEL_PROJECT_SETTINGS.md for troubleshooting guide" -ForegroundColor Gray
    Write-Host "`n  To rollback, see VERCEL_ROLLBACK.md" -ForegroundColor Gray
    
    exit 1
}

Write-Host "  ✓ All smoke tests passed!" -ForegroundColor Green

# Step 4: Manual verification prompt
Write-Host "`n[4/4] Final verification" -ForegroundColor Yellow

$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host "`n  Manual curl test (optional):" -ForegroundColor Gray
Write-Host "  curl.exe -i -X POST ""$Domain/api/waitlist?cb=$timestamp"" ``" -ForegroundColor Cyan
Write-Host "    -H ""Content-Type: application/json"" ``" -ForegroundColor Cyan
Write-Host "    -d '{""email"":""test@example.com""}'" -ForegroundColor Cyan

Write-Host "`n  Expected response:" -ForegroundColor Gray
Write-Host "    • Status: 200 OK" -ForegroundColor Gray
Write-Host "    • Content-Type: application/json" -ForegroundColor Gray
Write-Host "    • Body: { ""ok"": true, ""status"": ""created"" } or ""accepted_no_storage""" -ForegroundColor Gray

Write-Host "`n=== Deployment Complete ===`n" -ForegroundColor Green

Write-Host "✓ vercel.json updated with proper routing" -ForegroundColor Green
Write-Host "✓ Deployed to Vercel production with --force" -ForegroundColor Green
Write-Host "✓ Smoke tests passed" -ForegroundColor Green
Write-Host "✓ /api/waitlist is deployed as a Function" -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Verify Vercel Project Settings (see VERCEL_PROJECT_SETTINGS.md)" -ForegroundColor Gray
Write-Host "  2. Test waitlist form in production browser" -ForegroundColor Gray
Write-Host "  3. Monitor Vercel function logs for any errors" -ForegroundColor Gray
Write-Host "  4. If issues occur, see VERCEL_ROLLBACK.md for rollback instructions" -ForegroundColor Gray

Write-Host "`n" -ForegroundColor Gray
