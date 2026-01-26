param(
    [string]$DeployUrl = $env:DEPLOY_URL
)

if (-not $DeployUrl) {
    Write-Host "Error: DEPLOY_URL not set" -ForegroundColor Red
    exit 1
}

$endpoints = @(
    "/api/ping",
    "/api/healthz",
    "/healthz"
)

$allPassed = $true

foreach ($endpoint in $endpoints) {
    $url = "$DeployUrl$endpoint"
    
    $response = curl.exe -s -i "$url" 2>&1
    $output = $response -join "`n"
    
    # Extract status line
    if ($output -match "(HTTP/\d\.\d\s+\d+\s+[^\r\n]+)") {
        $statusLine = $matches[1]
        Write-Host "Status: $statusLine"
        
        # Extract status code
        if ($statusLine -match "HTTP/\d\.\d\s+(\d+)") {
            $statusCode = [int]$matches[1]
            if ($statusCode -ne 200) {
                Write-Host "FAIL: Status code is $statusCode, expected 200" -ForegroundColor Red
                $allPassed = $false
            }
        }
    } else {
        Write-Host "FAIL: Could not parse status line" -ForegroundColor Red
        $allPassed = $false
    }
    
    # Extract Content-Type
    $contentType = ""
    if ($output -match "Content-Type:\s*([^\r\n]+)") {
        $contentType = $matches[1].Trim()
        Write-Host "Content-Type: $contentType"
        
        if ($contentType -notmatch "application/json") {
            Write-Host "FAIL: Content-Type is '$contentType', expected 'application/json'" -ForegroundColor Red
            $allPassed = $false
        }
    } else {
        Write-Host "FAIL: Content-Type header not found" -ForegroundColor Red
        $allPassed = $false
    }
    
    # Extract body (everything after first blank line)
    $parts = $output -split "`r?`n`r?`n", 2
    if ($parts.Length -eq 2) {
        $body = $parts[1].Trim()
        $bodyPreview = if ($body.Length -gt 120) { $body.Substring(0, 120) + "..." } else { $body }
        Write-Host "Body (first 120 chars): $bodyPreview"
        
        # Validate JSON
        try {
            $null = $body | ConvertFrom-Json
        } catch {
            Write-Host "FAIL: Invalid JSON: $_" -ForegroundColor Red
            $allPassed = $false
        }
    } else {
        Write-Host "FAIL: No body found" -ForegroundColor Red
        $allPassed = $false
    }
    
    Write-Host ""
}

if ($allPassed) {
    exit 0
} else {
    exit 1
}
