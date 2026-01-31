# How to Unblock Evidence Collection

This guide helps you resolve the environment issues preventing evidence collection.

---

## Issue 1: Vercel CLI Authentication Required

### Symptoms:
```
Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

### Solution A: Interactive Login (Recommended)
```powershell
npx vercel login
```
- Opens browser for authentication
- Saves credentials locally
- No token management needed

### Solution B: Use Token
```powershell
# Set environment variable (session only)
$env:VERCEL_TOKEN = "your-token-here"

# Or permanently (current user)
[System.Environment]::SetEnvironmentVariable('VERCEL_TOKEN', 'your-token-here', 'User')
```

**Where to get token**:
1. Go to https://vercel.com/account/tokens
2. Create new token
3. Copy and use above

### Verification:
```powershell
npx vercel ls
# Should list your deployments
```

---

## Issue 2: Local Dev Server EPERM Error

### Symptoms:
```
Error: spawn EPERM
    at ChildProcess.spawn (node:internal/child_process:420:11)
```

### Solution A: Run as Administrator
```powershell
# Close current PowerShell
# Right-click PowerShell → "Run as Administrator"
cd "C:\Users\13109\Desktop\Monster Collective"
npm run dev
```

### Solution B: Disable Antivirus Temporarily
1. Open Windows Security
2. Virus & threat protection → Manage settings
3. Turn off Real-time protection (temporary)
4. Try `npm run dev` again
5. Re-enable protection after testing

### Solution C: Whitelist Directories
Add these to Windows Defender exclusions:
- `C:\Users\13109\Desktop\Monster Collective\node_modules`
- `C:\Users\13109\AppData\Local\npm-cache`

**Steps**:
1. Windows Security → Virus & threat protection
2. Manage settings → Exclusions → Add or remove exclusions
3. Add folder → Select paths above

### Solution D: Clear Cache and Reinstall
```powershell
# Remove node_modules and cache
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# Reinstall
npm install

# Try dev server
npm run dev
```

---

## Issue 3: Network/TLS Issues with curl

### Symptoms:
```
curl: (35) schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS
```

### Solution A: Use PowerShell Web Cmdlets
```powershell
# Instead of curl, use Invoke-WebRequest
$response = Invoke-WebRequest -Uri "https://athlete-ledger.vercel.app/api/ping"
$response.StatusCode
$response.Content
```

### Solution B: Update curl (if using system curl)
```powershell
# Install latest curl via winget
winget install curl.curl
```

### Solution C: Use Git Bash or WSL
```bash
# In Git Bash or WSL
curl -i https://athlete-ledger.vercel.app/api/ping
```

---

## Quick Testing Commands (After Unblocking)

### 1. List Vercel Deployments
```powershell
npx vercel ls
```

### 2. Inspect Latest Deployment
```powershell
# Get latest deployment URL
$deploymentUrl = (npx vercel ls --json | ConvertFrom-Json)[0].url

# Inspect it
npx vercel inspect $deploymentUrl
```

### 3. Get Build Logs
```powershell
npx vercel logs <deployment-url>
```

### 4. Start Local Dev Server
```powershell
# Option A: Vercel dev (includes serverless functions)
npx vercel dev --port 3000

# Option B: Regular Vite dev (frontend only)
npm run dev
```

### 5. Test Local Endpoints
```powershell
# Root endpoint
Invoke-WebRequest -Uri "http://localhost:3000/" | Select-Object StatusCode, ContentType

# Health check
Invoke-WebRequest -Uri "http://localhost:3000/api/healthz" | Select-Object StatusCode, Content

# Waitlist submission
$body = @{
    email = "test+local@example.com"
    source = "local_test"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/waitlist" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | Select-Object StatusCode, Content
```

### 6. Test Production Endpoints
```powershell
$baseUrl = "https://athlete-ledger.vercel.app"

# Root
Invoke-WebRequest -Uri "$baseUrl/" | Select-Object StatusCode

# Health check
Invoke-WebRequest -Uri "$baseUrl/api/healthz" | Select-Object StatusCode, Content

# Build ID
Invoke-WebRequest -Uri "$baseUrl/api/build-id" | Select-Object StatusCode, Content

# Waitlist
$body = @{
    email = "test+prod@example.com"
    source = "prod_test"
} | ConvertTo-Json

Invoke-WebRequest -Uri "$baseUrl/api/waitlist" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | Select-Object StatusCode, Content
```

---

## Expected Outcomes

### After Unblocking:

✅ **Vercel CLI works**:
```
npx vercel ls
# Shows list of deployments with URLs and status
```

✅ **Local dev server starts**:
```
npm run dev
# VITE v5.x.x  ready in XXX ms
# ➜  Local:   http://localhost:5173/
```

✅ **Endpoints respond**:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/ping"
# Returns JSON: {"ok":true,"timestamp":"..."}
```

---

## Troubleshooting Matrix

| Symptom | Likely Cause | Try This |
|---------|-------------|----------|
| `No existing credentials found` | Not logged into Vercel | `npx vercel login` |
| `spawn EPERM` | Antivirus blocking esbuild | Run as admin OR whitelist |
| `SEC_E_NO_CREDENTIALS` | TLS/cert issue | Use `Invoke-WebRequest` instead |
| `Connection closed` | Network restriction | Check firewall/proxy |
| `404 on /api/*` | Routing issue | Deploy vercel.json changes |
| `HTML returned for API` | Routing issue | Deploy vercel.json changes |
| `Build fails: SECURITY` | Missing env var | Set `VITE_PUBLIC_MODE=true` |

---

## After Unblocking: Run Full Evidence Collection

```powershell
# 1. List deployments
npx vercel ls

# 2. Get latest deployment
$latest = (npx vercel ls --json | ConvertFrom-Json)[0]
Write-Host "Latest: $($latest.url) - $($latest.state)"

# 3. Inspect it
npx vercel inspect $latest.url

# 4. Get logs
npx vercel logs $latest.url

# 5. Start local dev
npx vercel dev --port 3000
# (In separate terminal, run the local tests above)

# 6. Run verification script
.\verify-production-fix.ps1
```

---

## Need Help?

If still blocked after trying these solutions:

1. **Check**: `EVIDENCE_REPORT.md` for detailed analysis
2. **Review**: `PRODUCTION_FIX_SUMMARY.md` for deployment issues
3. **Follow**: `DEPLOYMENT_CHECKLIST.md` for step-by-step deployment

**Common Quick Fixes**:
- Restart PowerShell as Admin
- Clear `node_modules` and reinstall
- Temporarily disable antivirus
- Use `Invoke-WebRequest` instead of `curl`
- Run `npx vercel login`
