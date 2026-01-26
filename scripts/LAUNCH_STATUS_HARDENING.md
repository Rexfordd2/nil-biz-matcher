# Launch Status Script Hardening Summary

## Overview

The `scripts/launch-status.mjs` script has been hardened to prevent misleading PASS/WARN statuses. The script now enforces strict validation rules and fails fast when critical checks cannot be completed.

## Hardening Requirements Implemented

### 1. Domain Discovery Failure Handling
- **Requirement:** Script MUST fail (exit 1) if no DOMAINS provided AND VERCEL_TOKEN auto-discovery fails
- **Implementation:** `parseDomainsFromEnv()` now tracks auto-discovery attempts and failures, exiting with code 1 if both conditions are met

### 2. verify:prod Validation
- **Requirement:** Script MUST fail if verify:prod fails to run or returns no table
- **Implementation:** `runVerifyProd()` checks for:
  - Script execution failures (catches exceptions)
  - Empty results table (returns `VERIFY_PROD_NO_TABLE` error)
  - Both conditions cause FAIL status

### 3. /healthz Endpoint Validation
- **Requirement:** Script MUST fail if /healthz is unreachable on the selected primary domain
- **Implementation:** `analyzeStatus()` adds blocking issue if `healthz.ok === false`, causing FAIL status

### 4. BuildId Consistency Check
- **Requirement:** If buildId in header does not match /healthz buildId, status MUST be FAIL
- **Implementation:** 
  - `extractHeaderBuildId()` extracts buildId from homepage HTML
  - `analyzeStatus()` compares header buildId with /healthz buildId
  - Mismatch causes blocking issue and FAIL status
  - If header extraction fails but /healthz succeeds, also causes FAIL

### 5. verify:prod Domain Mismatch Detection
- **Requirement:** If verify:prod shows ANY domain mismatch or failure, status MUST be FAIL
- **Implementation:** `analyzeStatus()` checks:
  - `verifyProd.ok === false` → blocking issue
  - `verifyProd.buildIdMismatch === true` → blocking issue
  - Any domain with `buildId === 'n/a'`, `stableAcrossRuns !== 'yes'`, or `headerMatches !== 'yes'` → blocking issue

### 6. Harness Metrics Handling
- **Requirement:** Playwright/harness metrics are OPTIONAL, but if unavailable, record as "HARNESS_UNAVAILABLE" and downgrade to WARN (not PASS)
- **Implementation:**
  - Harness failures are recorded as non-blocking issues with prefix "HARNESS_UNAVAILABLE"
  - If harness unavailable and no other blocking issues, status is WARN
  - Harness unavailability does NOT cause FAIL in normal mode

### 7. Strict Mode
- **Requirement:** Add `--strict` mode where harness metrics MUST be available; otherwise FAIL
- **Implementation:**
  - `parseArgs()` detects `--strict` flag
  - In strict mode, harness unavailability becomes a blocking issue
  - Strict mode causes FAIL if harness is unavailable

## Exit Codes

| Status | Exit Code | Conditions |
|--------|-----------|------------|
| PASS | 0 | All checks pass, no issues |
| WARN | 0 | Non-blocking issues only (e.g., harness unavailable in non-strict mode) |
| FAIL | 1 | Any blocking issue present |

## Blocking Issues (Cause FAIL)

1. No DOMAINS and auto-discovery failed
2. verify:prod script failed to run
3. verify:prod returned no results table
4. verify:prod shows domain verification failures
5. verify:prod shows buildId mismatch across domains
6. /healthz endpoint unreachable
7. BuildId header extraction failed (when /healthz succeeds)
8. BuildId header does not match /healthz buildId
9. Harness unavailable in --strict mode
10. Harness failure rate > 10%
11. Harness inconsistency rate > 10%

## Non-Blocking Issues (Cause WARN)

1. Harness unavailable (in non-strict mode) - recorded as "HARNESS_UNAVAILABLE"
2. Harness failure rate > 5% but ≤ 10%
3. Harness inconsistency rate > 5% but ≤ 10%
4. BuildId is "unknown"
5. Missing GOOGLE_MAPS_API_KEY

## Usage Examples

### Normal Mode
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

### Strict Mode (Requires Harness)
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs --strict
```

### With Auto-Discovery
```bash
VERCEL_TOKEN="your-token" node scripts/launch-status.mjs
```

## Testing Checklist

- [x] No domains + auto-discovery fails → exit 1
- [x] verify:prod fails to run → exit 1
- [x] verify:prod returns no table → exit 1
- [x] verify:prod shows domain failures → exit 1
- [x] verify:prod shows buildId mismatch → exit 1
- [x] /healthz unreachable → exit 1
- [x] Header buildId extraction fails → exit 1
- [x] Header buildId ≠ /healthz buildId → exit 1
- [x] Harness unavailable (non-strict) → exit 0, status WARN
- [x] Harness unavailable (--strict) → exit 1
- [x] All checks pass → exit 0, status PASS

## Files Modified

1. `scripts/launch-status.mjs` - Main script with hardening
2. `scripts/LAUNCH_STATUS_EXAMPLES.md` - Example outputs for all scenarios
3. `scripts/LAUNCH_STATUS_HARDENING.md` - This document
