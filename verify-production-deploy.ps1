# Production Deploy Verification Script
# Verifies that the latest deployment contains expected waitlist-related code

$timestamp = [int][double]::Parse((Get-Date -UFormat %s))
$url = "https://athlete-ledger.vercel.app/?cb=$timestamp"

Write-Host "Fetching: $url"
$response = Invoke-WebRequest -Uri $url -UseBasicParsing

# Extract BUILD_ID from response
$buildIdMatch = $response.Content -match 'BUILD_ID["\s:=]+([a-zA-Z0-9_-]+)'
$HOMEPAGE_BUILD_ID = if ($buildIdMatch) { $matches[1] } else { "unknown" }

# Extract ASSET_URL (look for _buildManifest.js or similar)
$assetMatch = $response.Content -match '/_next/static/([a-zA-Z0-9_-]+)/_buildManifest\.js'
$ASSET_URL = if ($assetMatch) { "/_next/static/$($matches[1])/_buildManifest.js" } else { "unknown" }

# Search for waitlist-related strings
$searchPatterns = @('WaitlistGate', 'al_waitlist_joined', 'waitlist_gate')
$matches = @()

foreach ($pattern in $searchPatterns) {
    $content = $response.Content
    $index = 0
    while ($index -ge 0 -and $matches.Count -lt 20) {
        $index = $content.IndexOf($pattern, $index, [System.StringComparison]::OrdinalIgnoreCase)
        if ($index -ge 0) {
            $start = [Math]::Max(0, $index - 30)
            $length = [Math]::Min(80, $content.Length - $start)
            $snippet = $content.Substring($start, $length).Replace("`n", " ").Replace("`r", "")
            $matches += "$pattern found: $snippet"
            $index += $pattern.Length
        }
    }
}

$GREP_PROOF = if ($matches.Count -gt 0) { $matches[0..19] -join "`n" } else { "none" }

# Print results
Write-Host "`nHOMEPAGE_BUILD_ID"
Write-Host $HOMEPAGE_BUILD_ID

Write-Host "`nASSET_URL"
Write-Host $ASSET_URL

Write-Host "`nGREP_PROOF"
Write-Host $GREP_PROOF

# Exit with code 1 if conditions are met
if ($HOMEPAGE_BUILD_ID -eq "ac87f4b" -or $GREP_PROOF -eq "none") {
    Write-Host "`nVerification FAILED: Old build or missing waitlist code detected"
    exit 1
}

Write-Host "`nVerification PASSED"
exit 0
