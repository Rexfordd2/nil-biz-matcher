# Verify Deploy Commit Script
# Parses Vercel build logs and compares against expected origin/main commit

param(
    [string]$CLONE_LINE = "",
    [string]$SUBMODULE_LINE = "",
    [string]$BUILD_CMD_LINE = ""
)

# Parse CLONED_SHA from CLONE_LINE
$CLONED_SHA = "unknown"
if ($CLONE_LINE -match 'Commit:\s*([a-f0-9]{7,40})') {
    $CLONED_SHA = $matches[1]
}

# Get EXPECTED_SHA from origin/main
git fetch origin 2>&1 | Out-Null
$EXPECTED_SHA = (git rev-parse origin/main).Substring(0, 7)

# Check if they match
$MATCH = $CLONED_SHA.StartsWith($EXPECTED_SHA) -or $EXPECTED_SHA.StartsWith($CLONED_SHA)

# Check submodule presence
$SUBMODULE_PRESENT = $SUBMODULE_LINE -ne "" -and $SUBMODULE_LINE -match "submodule"

# Extract build command
$BUILD_CMD = "unknown"
if ($BUILD_CMD_LINE -match 'Running\s+"(.+?)"') {
    $BUILD_CMD = $matches[1]
}

# Print results
Write-Host "CLONED_SHA: $CLONED_SHA"
Write-Host "EXPECTED_SHA: $EXPECTED_SHA"
Write-Host "MATCH: $MATCH"
Write-Host "SUBMODULE_PRESENT: $SUBMODULE_PRESENT"
Write-Host "BUILD_CMD: $BUILD_CMD"

if (-not $MATCH) {
    Write-Host "`nWARNING: Cloned SHA does not match expected origin/main"
    exit 1
}

exit 0
