# Production Deploy Verification Script (Vite Build)
# Verifies that the latest deployment contains expected waitlist-related code

$timestamp = [int][double]::Parse((Get-Date -UFormat %s))
$url = "https://athlete-ledger.vercel.app/?cb=$timestamp"

Write-Host "Fetching HTML: $url"
$htmlResponse = Invoke-WebRequest -Uri $url -UseBasicParsing

# Extract BUILD_ID from data-testid="build-id"
$buildIdMatch = $htmlResponse.Content -match 'data-testid="build-id"[^>]*>([a-f0-9]+)<'
$HOMEPAGE_BUILD_ID = if ($buildIdMatch) { $matches[1] } else { "unknown" }

# Extract ASSET_PATH for Vite bundle
$assetMatch = $htmlResponse.Content -match '/assets/index-[^"'']+\.js'
$ASSET_PATH = if ($assetMatch) { $matches[0] } else { $null }
$ASSET_URL = if ($ASSET_PATH) { "https://athlete-ledger.vercel.app$ASSET_PATH" } else { "unknown" }

# Fetch the JS bundle
$GREP_PROOF = "none"
if ($ASSET_URL -ne "unknown") {
    Write-Host "Fetching JS bundle: $ASSET_URL"
    $bundleResponse = Invoke-WebRequest -Uri "$ASSET_URL`?cb=$timestamp" -UseBasicParsing
    
    # Search for waitlist-related strings in the bundle
    $searchPatterns = @('WaitlistGate', 'al_waitlist_joined', 'waitlist_gate')
    $lines = $bundleResponse.Content -split "`n"
    $matchedLines = @()
    
    foreach ($line in $lines) {
        if ($matchedLines.Count -ge 20) { break }
        foreach ($pattern in $searchPatterns) {
            if ($line -match $pattern) {
                $trimmedLine = $line.Trim()
                if ($trimmedLine.Length -gt 120) {
                    $trimmedLine = $trimmedLine.Substring(0, 120) + "..."
                }
                $matchedLines += $trimmedLine
                break
            }
        }
    }
    
    if ($matchedLines.Count -gt 0) {
        $GREP_PROOF = $matchedLines -join "`n"
    }
}

# Print results
Write-Host "`nHOMEPAGE_BUILD_ID: $HOMEPAGE_BUILD_ID"
Write-Host "ASSET_URL: $ASSET_URL"
Write-Host "GREP_PROOF:"
Write-Host $GREP_PROOF

# Exit with code 1 if conditions are met
if ($HOMEPAGE_BUILD_ID -eq "ac87f4b" -or $GREP_PROOF -eq "none") {
    Write-Host "`nVerification FAILED: Old build or missing waitlist code detected"
    exit 1
}

Write-Host "`nVerification PASSED"
exit 0
