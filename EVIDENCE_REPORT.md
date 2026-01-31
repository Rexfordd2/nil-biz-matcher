# Hard Evidence Report - Vercel Deployment Investigation
**Date**: 2026-01-30  
**Investigator**: AI Assistant  
**Commit**: 1e2941e (Use npm install instead of npm ci for Vercel builds)

---

## Executive Summary

⚠️ **CRITICAL BLOCKERS FOUND**:
1. **Vercel CLI requires authentication** - Cannot run `vercel ls`, `vercel inspect`, or `vercel dev` without credentials
2. **Local dev server blocked** - EPERM error preventing local Vite dev server from starting
3. **Network/TLS issues** - Cannot reach production endpoints from this environment

**Status**: Unable to collect runtime evidence due to environment restrictions. Analysis based on code inspection and documentation.

---

## Investigation Attempts & Results

### 1. Vercel CLI Commands (FAILED - Authentication Required)

#### Command: `npx vercel ls`
**Result**: ❌ Authentication required
```
Error: No existing credentials found. Please run `vercel login` or pass "--token"
Learn More: https://err.sh/vercel/no-credentials-found
```

#### Command: `npx vercel dev --port 3000`
**Result**: ❌ Authentication required
```
Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

**Resolution Required**: 
- Run `vercel login` interactively, OR
- Set `VERCEL_TOKEN` environment variable with an auth token

---

### 2. Local Development Server (FAILED - Permission Error)

#### Command: `npm run dev`
**Result**: ❌ EPERM error during esbuild spawn
```
failed to load config from C:\Users\13109\Desktop\Monster Collective\vite.config.js
error when starting dev server:
Error: spawn EPERM
    at ChildProcess.spawn (node:internal/child_process:420:11)
    ...
```

**Root Cause**: Windows permission issue preventing esbuild from running
**Possible Causes**:
- Antivirus/Windows Defender blocking esbuild executable
- File system permissions
- Corporate security policy

**Resolution Required**:
1. Check antivirus logs and whitelist `node_modules/vite/node_modules/esbuild`
2. Run PowerShell as Administrator
3. Check Windows Defender/security policies

---

### 3. Production Endpoint Testing (FAILED - Network/TLS Issues)

#### Attempts Made:

**curl.exe**: ❌ TLS credentials error
```
curl: (35) schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS (0x8009030E)
- No credentials are available in the security package
```

**Invoke-WebRequest (default)**: ❌ Connection closed
```
Invoke-WebRequest : The underlying connection was closed: An unexpected error 
occurred on a receive.
```

**Invoke-WebRequest with TLS 1.2**: ⏳ Timed out (still running after 2+ minutes)

**Root Cause**: Network/TLS configuration issues in Windows environment
**Resolution Required**: Network diagnostics or alternative testing environment

---

## Code Analysis - API Endpoints

### API Endpoint: `/api/waitlist` (POST)

**File**: `api/waitlist.ts`  
**Function**: Accepts email submissions for waitlist

#### Expected Behavior:

**Success Cases**:
- `200 OK` with `{ ok: true, status: "created" }` - New email added to Supabase
- `200 OK` with `{ ok: true, status: "already_registered" }` - Duplicate email (unique constraint)
- `200 OK` with `{ ok: true, status: "accepted_no_storage" }` - No Supabase configured (graceful no-op)
- `200 OK` with `{ ok: true, status: "honeypot_rejected" }` - Bot detected (silent rejection)

**Error Cases**:
- `400 Bad Request` with `{ ok: false, error: "Invalid email address" }` - Validation failed
- `405 Method Not Allowed` with `{ ok: false, error: "Method Not Allowed" }` - Non-POST request
- `500 Internal Server Error` with `{ ok: false, error: "..." }` - Database/server error

#### Storage Strategy:
1. **Preferred**: Supabase when configured
   - Requires: `SUPABASE_URL` + (`SUPABASE_SERVICE_ROLE_KEY` OR `SUPABASE_ANON_KEY`)
   - Service role key preferred (bypasses RLS)
   
2. **Fallback**: Graceful no-op (default)
   - Returns success without storage
   - Set `WAITLIST_FALLBACK_STORAGE=true` to enable JSON file storage

#### Honeypot Protection:
- Field: `website` (should be empty)
- If filled: Returns success but doesn't store (silent rejection)
- Prevents revealing the honeypot to bots

#### Code Quality: ✅ Robust
- Email normalization (trim, lowercase)
- Regex validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Duplicate detection (case-insensitive)
- Error handling with appropriate HTTP status codes
- UTM parameter support
- Anonymous ID tracking

---

### API Endpoint: `/api/healthz` (GET)

**File**: `api/healthz.ts`  
**Function**: Health check with build info

#### Expected Response:
```json
{
  "buildId": "1e2941e",
  "timestamp": "2026-01-30T01:37:00.000Z",
  "configPresence": {
    "hasViteSupabaseUrl": true/false,
    "hasViteSupabaseAnonKey": true/false,
    "hasViteGoogleMapsApiKey": true/false,
    "hasCseKey": true/false,
    "hasCseCx": true/false,
    "hasGoogleMapsServerKey": true/false,
    "hasVercelGitCommitSha": true/false
  }
}
```

#### Build ID Derivation:
1. `VERCEL_GIT_COMMIT_SHA` (preferred on Vercel)
2. `VITE_BUILD_ID` (set during build)
3. `GIT_COMMIT_SHA` (fallback)
4. `COMMIT_REF` (fallback)
5. `"unknown"` (if none found)

Git SHAs are shortened to 7 characters.

#### Headers:
- `Cache-Control: no-store`
- `Pragma: no-cache`
- `Expires: 0`
- `CDN-Cache-Control: no-store`

---

## Deployment Configuration Analysis

### Current vercel.json (Modified, Uncommitted)

**Status**: ⚠️ Changes staged but not committed

**Key Change**: `rewrites` → `routes` with explicit ordering

```json
{
  "version": 2,
  "installCommand": "npm install",
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "dist",
  "routes": [
    {
      "src": "/healthz",
      "dest": "/api/healthz"
    },
    {
      "src": "/demo",
      "dest": "/demo.html"
    },
    {
      "handle": "filesystem"
    },
    {
      "src": "/((?!api/).*)",
      "dest": "/index.html"
    }
  ]
}
```

#### Why This Matters:
1. **Route ordering is explicit** (top to bottom)
2. **`handle: filesystem`** lets Vercel detect functions in root `api/` directory
3. **SPA fallback excludes `/api/*`** with regex `/((?!api/).*)`
4. **Fixes prior bug** where `/api/ping` returned HTML instead of JSON

**Prior Issue** (documented in `API_ROUTING_FIX.md`):
- Using `rewrites` caused API routes to return cached HTML
- Production was serving `Content-Type: text/html` for API endpoints

---

## Critical Environment Variables

### Required for Build Success:

**VITE_PUBLIC_MODE=true**
- **Purpose**: Bypass security gate in `vite.config.ts`
- **Without it**: Build fails with security error
- **With it**: Enables public release mode (auth optional, debug routes denied by default)
- **Status**: ⚠️ May not be set in Vercel production environment

### Required for Waitlist Persistence:

**SUPABASE_URL** + **SUPABASE_SERVICE_ROLE_KEY** (or SUPABASE_ANON_KEY)
- **Purpose**: Enable Supabase waitlist storage
- **Without it**: Waitlist endpoint returns `accepted_no_storage` (graceful no-op)
- **Status**: ❓ Unknown if configured in Vercel

### Optional Enhancement:

**WAITLIST_FALLBACK_STORAGE=true**
- **Purpose**: Enable JSON file storage when Supabase not configured
- **File path**: `/tmp/waitlist.json` on Vercel, `./waitlist.json` locally
- **Status**: Likely not needed if Supabase is configured

---

## Deployment Model

### Correct Architecture (Verified):

**API Functions**: Root `api/` directory (auto-detected by Vercel)
- `api/waitlist.ts` → `/api/waitlist`
- `api/ping.ts` → `/api/ping`
- `api/healthz.ts` → `/api/healthz`
- `api/build-id.ts` → `/api/build-id`

**Static Assets**: `dist/` directory (built by Vite)

**Build Command**: `npm run vercel-build`
```bash
tsc -b && cross-env VITE_BUILD_ID=$VERCEL_GIT_COMMIT_SHA vite build && node scripts/copy-demo-html.mjs
```

### ❌ NOT Used in Current Build:
- `scripts/build-api.mjs` (compiles `serverless_src/` to `dist/api/`)
- `scripts/copy-api-to-dist.mjs` (copies `api/` to `dist/api/`)
- `scripts/verify-dist-api.mjs` (verifies `dist/api/` exists)
- `dist/api/` output directory (not produced, not expected)

These were part of an earlier experimental model and can be ignored/removed.

---

## Known Issues & Required Actions

### Issue 1: Build Failure Due to Security Gate
**Status**: ⚠️ High Priority  
**Symptom**: Build fails with error:
```
[SECURITY] Debug routes must be protected in production builds.
To enable debug access in production, set one of:
  - VITE_DIAGNOSTICS=true (enables all debug routes)
  - VITE_DEBUG_KEY=<secret> (enables access via ?debugKey=<secret> query param)
  - VITE_PUBLIC_MODE=true (public release; debug routes deny-by-default)
```

**Resolution**:
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add: `VITE_PUBLIC_MODE=true` for **Production** environment
3. Redeploy the latest commit

### Issue 2: API Routes Potentially Returning HTML (Routing Misconfiguration)
**Status**: ⚠️ High Priority  
**Symptom**: `/api/*` endpoints return `Content-Type: text/html` with SPA index.html

**Resolution**:
1. Commit and deploy the modified `vercel.json` (currently staged)
2. Verify with: `curl -i https://athlete-ledger.vercel.app/api/ping`
3. Should return `Content-Type: application/json`, not `text/html`

### Issue 3: Waitlist Persistence Unknown
**Status**: ⚠️ Medium Priority  
**Symptom**: Unclear if Supabase is configured; waitlist may not be persisting

**Verification**:
1. Check Vercel environment variables for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. If not set, waitlist submissions will succeed but won't be stored
3. Users will see success, but data is lost

**Resolution**:
- If persistence desired: Configure Supabase env vars (see `SUPABASE_SETUP_QUICK.md`)
- If not: Accept graceful no-op behavior (`accepted_no_storage` status)

---

## Recommended Testing Plan

### Once Environment Issues Are Resolved:

#### 1. Local Testing (Requires fixing EPERM issue):
```powershell
# Start local dev server
npm run dev

# In separate terminal:
# Test root endpoint
curl -i http://localhost:5173/

# Test API endpoint (Note: May require Vercel dev for serverless functions)
npx vercel dev --port 3000

# Test waitlist submission
curl -i -X POST http://localhost:3000/api/waitlist `
  -H "Content-Type: application/json" `
  -d '{"email":"test+local@example.com","source":"test"}'
```

#### 2. Production Testing (After deployment):
```powershell
# Test root
curl -i https://athlete-ledger.vercel.app/

# Test health check
curl -i https://athlete-ledger.vercel.app/healthz

# Test build ID
curl -i https://athlete-ledger.vercel.app/api/build-id

# Test waitlist
curl -X POST https://athlete-ledger.vercel.app/api/waitlist `
  -H "Content-Type: application/json" `
  -d '{"email":"test+prod@example.com","source":"verification"}'
```

#### 3. Expected Success Criteria:
- ✅ All endpoints return `200 OK`
- ✅ `/api/*` endpoints return `Content-Type: application/json` (not `text/html`)
- ✅ Build ID matches latest commit SHA (1e2941e or newer)
- ✅ Waitlist returns `status: "created"` or `"accepted_no_storage"`
- ✅ No 404s, no HTML responses for API routes
- ✅ SPA fallback works for non-API routes (returns index.html)

---

## Evidence Artifacts

### Verification Scripts Available:
- `verify-production-api.ps1` - Tests `/api/healthz` and `/api/build-id`
- `verify-production-fix.ps1` - Comprehensive endpoint testing
- `verify-production.ps1` - Production readiness checks
- `verify-deploy-commit.ps1` - Deployment verification

### Documentation Available:
- `PRODUCTION_FIX_SUMMARY.md` - Detailed problem analysis and solutions
- `VERCEL_ENV_FIX.md` - Environment variable setup instructions
- `DEPLOYMENT_MODEL.md` - Architecture documentation
- `SUPABASE_SETUP_QUICK.md` - Optional persistence setup
- `DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment guide
- `API_ROUTING_FIX.md` - Prior routing bug documentation

### Code Files Inspected:
- ✅ `api/waitlist.ts` - Waitlist endpoint (robust implementation)
- ✅ `api/healthz.ts` - Health check endpoint
- ✅ `vercel.json` - Deployment configuration (modified)
- ✅ `package.json` - Build scripts and dependencies
- ✅ `.env.example` - Environment variable documentation

---

## Conclusion

### What We Know:
1. ✅ **Code is production-ready**: API endpoints are well-implemented with proper error handling
2. ✅ **Routing fix is staged**: `vercel.json` changes will fix API response issues
3. ⚠️ **Environment variable may be missing**: `VITE_PUBLIC_MODE=true` required for build success
4. ❓ **Supabase configuration unknown**: May or may not be configured
5. ❌ **Cannot verify runtime behavior**: Environment restrictions prevent live testing

### What We Cannot Verify (Due to Environment Restrictions):
1. ❌ Current deployment status (no Vercel CLI auth)
2. ❌ Live endpoint responses (network/TLS issues)
3. ❌ Build logs from Vercel (no API access)
4. ❌ Actual runtime behavior (no local dev server)

### Immediate Next Steps:
1. **Authenticate Vercel CLI**: Run `vercel login` or set `VERCEL_TOKEN`
2. **Fix local dev environment**: Resolve EPERM error (antivirus, permissions)
3. **Set VITE_PUBLIC_MODE**: Add to Vercel production environment
4. **Deploy changes**: Commit and push `vercel.json` modifications
5. **Run verification scripts**: Once environment issues resolved

---

**Report Status**: ⚠️ Incomplete due to environment constraints  
**Confidence Level**: High on code analysis, Low on runtime verification  
**Recommendation**: Resolve authentication and network issues, then re-run with full testing suite
