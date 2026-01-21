# Production Domain Verifier - Examples

## Example Output

### Success Case (All Domains Pass)

```
Verifying 3 domain(s)...

Domain Build Consistency Verification

Domain                                    buildId   stableAcrossRuns  headerMatches  error
----------------------------------------  --------  ----------------  -------------  -----
https://app.example.com                   abc1234   yes               yes            -
https://www.example.com                   abc1234   yes               yes            -
https://api.example.com                   abc1234   yes               yes            -

✅ All domains passed verification and buildIds match
```

### Failure Case (Unstable Domain)

```
Verifying 2 domain(s)...

Domain Build Consistency Verification

Domain                                    buildId   stableAcrossRuns  headerMatches  error
----------------------------------------  --------  ----------------  -------------  -----
https://app.example.com                   abc1234   yes               yes            -
https://staging.example.com               xyz7890   no                yes            UNSTABLE: buildId varied

❌ 1 domain(s) failed verification
```

### Failure Case (Build ID Mismatch)

```
Verifying 2 domain(s)...

Domain Build Consistency Verification

Domain                                    buildId   stableAcrossRuns  headerMatches  error
----------------------------------------  --------  ----------------  -------------  -----
https://app.example.com                   abc1234   yes               yes            -
https://www.example.com                   def5678   yes               yes            -

❌ BuildId mismatch detected among successful domains: abc1234, def5678
❌ 0 domain(s) failed verification
```

### Failure Case (Header Mismatch)

```
Verifying 1 domain(s)...

Domain Build Consistency Verification

Domain                                    buildId   stableAcrossRuns  headerMatches  error
----------------------------------------  --------  ----------------  -------------  -----
https://app.example.com                   abc1234   yes               no              BUILD_ID_NOT_FOUND

❌ 1 domain(s) failed verification
```

## PowerShell Commands

### Using DOMAINS Environment Variable

```powershell
# Set domains
$env:DOMAINS = "https://app.example.com,https://www.example.com,https://api.example.com"

# Run verification
npm run verify:prod

# Or with timeout override
$env:DOMAINS = "https://app.example.com,https://www.example.com"
npm run verify:prod -- --timeoutMs=15000
```

### Using Vercel Auto-Discovery

```powershell
# Set Vercel token (get from Vercel Settings > Tokens)
$env:VERCEL_TOKEN = "your-vercel-token-here"

# Run verification (will auto-discover domains)
npm run verify:prod

# With timeout override
npm run verify:prod -- --timeoutMs=20000
```

### One-Liner Examples

```powershell
# Single domain
$env:DOMAINS = "https://app.example.com"; npm run verify:prod

# Multiple domains
$env:DOMAINS = "https://app.example.com,https://www.example.com"; npm run verify:prod

# With Vercel token
$env:VERCEL_TOKEN = "token"; npm run verify:prod

# Check exit code
$env:DOMAINS = "https://app.example.com"; npm run verify:prod; if ($LASTEXITCODE -ne 0) { Write-Host "Verification failed!" }
```

### CI/CD Integration

```powershell
# In CI pipeline (GitHub Actions, Azure DevOps, etc.)
$env:VERCEL_TOKEN = ${{ secrets.VERCEL_TOKEN }}
npm run verify:prod
if ($LASTEXITCODE -ne 0) {
    Write-Error "Domain verification failed!"
    exit 1
}
```

## Exit Codes

- **0**: All domains passed verification and all buildIds match
- **1**: One or more domains failed OR buildIds mismatch
- **2**: Invalid configuration (missing DOMAINS, invalid URLs, etc.)

## Error Messages

| Error | Meaning |
|-------|---------|
| `TIMEOUT` | Request timed out |
| `DNS` | DNS resolution failed |
| `HTTP_404` | /healthz endpoint not found |
| `HTTP_500` | Server error |
| `BAD_JSON` | Invalid JSON response from /healthz |
| `NO_BUILD_ID` | /healthz response missing buildId |
| `UNSTABLE` | BuildId varied across 5 healthz calls |
| `BUILD_ID_NOT_FOUND` | BuildId not found in homepage HTML |
| `HEADER_MISMATCH` | BuildId in HTML doesn't match /healthz |

## Notes

- The script calls `/healthz` 5 times per domain to detect instability
- It checks for `data-testid="build-id"` in homepage HTML, with fallback to pattern matching
- All domains must have the same buildId for verification to pass
- Auto-discovery requires `VERCEL_TOKEN` environment variable
