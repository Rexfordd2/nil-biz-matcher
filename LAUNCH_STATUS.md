# Launch Status Report

**Generated:** 2026-01-21T20:01:05.924Z

## Overall Status: ⚠️ WARN

### Build Information
- **Primary Domain:** https://athlete-ledger.vercel.app
- **BuildId:** 3c63267
- **Timestamp:** 2026-01-21T20:01:06.149Z
- **Header BuildId:** 3c63267

### Environment Variables (Presence)
#### Feature Flags
- **REQUIRE_CSE:** ❌ false (CSE keys are non-blocking)
- **REQUIRE_GOOGLE_MAPS_SERVER_KEY:** ❌ false (Server key is non-blocking)

#### Variable Presence
- **hasViteSupabaseUrl:** ✅ Present
- **hasViteSupabaseAnonKey:** ✅ Present
- **hasViteGoogleMapsApiKey:** ✅ Present
- **hasCseKey:** ⚠️ Missing (non-blocking)
- **hasCseCx:** ⚠️ Missing (non-blocking)
- **hasGoogleMapsServerKey:** ⚠️ Missing (non-blocking)
- **hasVercelGitCommitSha:** ✅ Present

## ⚠️ Non-Blocking Issues

- DEBUG_GATED: Debug routes are gated in production. Set VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to enable access.
- CSE_KEY or CSE_CX not set (CSE search disabled; set REQUIRE_CSE=true to require)
- GOOGLE_MAPS_SERVER_KEY not set (server-side maps disabled; set REQUIRE_GOOGLE_MAPS_SERVER_KEY=true to require)

### Domain Verification Results

| Domain | BuildId | Stable | Header Matches | Error |
|--------|---------|--------|----------------|-------|
| https://athlete-ledger.vercel.app | 3c63267 | yes | yes | - |

### Debug Harness

- **Status:** DEBUG_GATED
- **Note:** Debug routes are intentionally gated in production. Set VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to enable access. In --strict mode, this causes FAIL unless ALLOW_STRICT_WITHOUT_DEBUG=true is set.

## Recommended Next Action

Review non-blocking issues and address critical ones before launch.

## PROOF

### Exact Command Run

```bash
DOMAINS="https://athlete-ledger.vercel.app" VERCEL_TOKEN="***REDACTED***" C:\nvm4w\nodejs\node.exe C:\Users\13109\Desktop\Monster Collective\scripts\launch-status.mjs
```

### Timestamp of Report Generation

2026-01-21T20:01:05.924Z

### Raw /healthz JSON Payload (Booleans + buildId/timestamp)

```json
{
  "buildId": "3c63267",
  "timestamp": "2026-01-21T20:01:06.149Z",
  "configPresence": {
    "hasViteSupabaseUrl": true,
    "hasViteSupabaseAnonKey": true,
    "hasViteGoogleMapsApiKey": true,
    "hasCseKey": false,
    "hasCseCx": false,
    "hasGoogleMapsServerKey": false,
    "hasVercelGitCommitSha": true
  }
}
```

### Raw verify:prod Table Output

```

Verifying 1 domain(s)...

Domain Build Consistency Verification

Domain                             buildId  stableAcrossRuns  headerMatches  error
---------------------------------  -------  ----------------  -------------  -----
https://athlete-ledger.vercel.app  3c63267  yes               yes            -    

✅ All domains passed verification and buildIds match

```

### Harness Raw Metrics

**Status:** DEBUG_GATED

