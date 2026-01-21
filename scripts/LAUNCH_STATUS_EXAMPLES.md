# Launch Status Examples

This document shows example outputs for different scenarios when running `scripts/launch-status.mjs`.

## Exit Codes

- **0**: PASS or WARN (non-blocking issues only)
- **1**: FAIL (blocking issues present)

## Example 1: PASS

**Scenario:** All checks pass, harness metrics available, no issues.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Running domain/build consistency verification...
Extracting debug harness metrics...

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: PASS

Recommended: All checks passed. Ready for launch.

Exit code: 0
```

**LAUNCH_STATUS.md:**
```markdown
# Launch Status Report

**Generated:** 2025-01-27T12:00:00.000Z

## Overall Status: ✅ PASS

### Build Information
- **BuildId:** abc1234
- **Timestamp:** 2025-01-27T11:45:30.123Z
- **Header BuildId:** abc1234

### Environment Variables (Presence)
- **GOOGLE_MAPS_API_KEY:** ✅ Present
- **VERCEL_GIT_COMMIT_SHA:** ✅ Present

### Domain Verification Results

| Domain | BuildId | Stable | Header Matches | Error |
|--------|---------|--------|----------------|-------|
| https://app.example.com | abc1234 | yes | yes | - |

### Debug Harness Metrics

- **Total Requests:** 50
- **Successes:** 50
- **Failures:** 0
- **Failure Rate:** 0.00%
- **Inconsistency Rate:** 0.00%

## Recommended Next Action

All checks passed. Ready for launch.
```

---

## Example 2: WARN (Harness Unavailable)

**Scenario:** All critical checks pass, but harness metrics are unavailable (Playwright not installed or harness page inaccessible).

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Running domain/build consistency verification...
Extracting debug harness metrics...
Debug harness not accessible: PLAYWRIGHT_NOT_AVAILABLE

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: WARN

⚠️  Non-Blocking Issues: 1
  - HARNESS_UNAVAILABLE: PLAYWRIGHT_NOT_AVAILABLE

Recommended: Debug harness metrics unavailable. Review other issues and consider running with --strict mode for full validation.

Exit code: 0
```

**LAUNCH_STATUS.md:**
```markdown
# Launch Status Report

**Generated:** 2025-01-27T12:00:00.000Z

## Overall Status: ⚠️ WARN

### Build Information
- **BuildId:** abc1234
- **Timestamp:** 2025-01-27T11:45:30.123Z
- **Header BuildId:** abc1234

### Environment Variables (Presence)
- **GOOGLE_MAPS_API_KEY:** ✅ Present
- **VERCEL_GIT_COMMIT_SHA:** ✅ Present

## ⚠️ Non-Blocking Issues

- HARNESS_UNAVAILABLE: PLAYWRIGHT_NOT_AVAILABLE

### Domain Verification Results

| Domain | BuildId | Stable | Header Matches | Error |
|--------|---------|--------|----------------|-------|
| https://app.example.com | abc1234 | yes | yes | - |

### Debug Harness

- **Status:** HARNESS_UNAVAILABLE (PLAYWRIGHT_NOT_AVAILABLE)
- **Note:** Debug harness requires VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to be accessible

## Recommended Next Action

Debug harness metrics unavailable. Review other issues and consider running with --strict mode for full validation.
```

---

## Example 3: FAIL (Domain Verification Failure)

**Scenario:** verify:prod shows domain mismatch or failure.

**Command:**
```bash
DOMAINS="https://app.example.com,https://www.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 2 domain(s): https://app.example.com, https://www.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Running domain/build consistency verification...
ERROR: verify:prod failed: (no specific error, but results show failures)

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: FAIL

❌ Blocking Issues: 2
  - BuildId mismatch across domains: abc1234, xyz7890
  - 1 domain(s) failed verification
    - https://www.example.com: UNSTABLE: buildId varied

Recommended: Fix buildId consistency across domains by ensuring all deployments use the same build.

Exit code: 1
```

**LAUNCH_STATUS.md:**
```markdown
# Launch Status Report

**Generated:** 2025-01-27T12:00:00.000Z

## Overall Status: ❌ FAIL

### Build Information
- **BuildId:** abc1234
- **Timestamp:** 2025-01-27T11:45:30.123Z
- **Header BuildId:** abc1234

## ❌ Blocking Issues

- BuildId mismatch across domains: abc1234, xyz7890
- 1 domain(s) failed verification
  - https://www.example.com: UNSTABLE: buildId varied

### Domain Verification Results

| Domain | BuildId | Stable | Header Matches | Error |
|--------|---------|--------|----------------|-------|
| https://app.example.com | abc1234 | yes | yes | - |
| https://www.example.com | xyz7890 | no | yes | UNSTABLE: buildId varied |

### Debug Harness

- **Status:** HARNESS_UNAVAILABLE (PLAYWRIGHT_NOT_AVAILABLE)
- **Note:** Debug harness requires VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to be accessible

## Recommended Next Action

Fix buildId consistency across domains by ensuring all deployments use the same build.
```

---

## Example 4: FAIL (/healthz Unreachable)

**Scenario:** /healthz endpoint is unreachable on primary domain.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Fetching /healthz endpoint...
ERROR: /healthz check failed: TIMEOUT
Extracting buildId from homepage header...
Running domain/build consistency verification...
Extracting debug harness metrics...

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: FAIL

❌ Blocking Issues: 1
  - /healthz endpoint not accessible: TIMEOUT

Recommended: Address all blocking issues before proceeding with launch.

Exit code: 1
```

**LAUNCH_STATUS.md:**
```markdown
# Launch Status Report

**Generated:** 2025-01-27T12:00:00.000Z

## Overall Status: ❌ FAIL

### Build Information
- **BuildId:** unknown
- **Timestamp:** 2025-01-27T12:00:00.000Z

## ❌ Blocking Issues

- /healthz endpoint not accessible: TIMEOUT

### Domain Verification Results

| Domain | BuildId | Stable | Header Matches | Error |
|--------|---------|--------|----------------|-------|
| https://app.example.com | abc1234 | yes | yes | - |

## Recommended Next Action

Address all blocking issues before proceeding with launch.
```

---

## Example 5: FAIL (BuildId Header Mismatch)

**Scenario:** BuildId in header does not match /healthz buildId.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Warning: Failed to extract buildId from header: BUILD_ID_NOT_FOUND
Running domain/build consistency verification...
Extracting debug harness metrics...

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: FAIL

❌ Blocking Issues: 2
  - Failed to extract buildId from homepage header: BUILD_ID_NOT_FOUND
  - BuildId mismatch: /healthz reports "abc1234" but header shows "xyz7890"

Recommended: Address all blocking issues before proceeding with launch.

Exit code: 1
```

**LAUNCH_STATUS.md:**
```markdown
# Launch Status Report

**Generated:** 2025-01-27T12:00:00.000Z

## Overall Status: ❌ FAIL

### Build Information
- **BuildId:** abc1234
- **Timestamp:** 2025-01-27T11:45:30.123Z
- **Header BuildId:** xyz7890
- **⚠️ BuildId Mismatch:** Header (xyz7890) ≠ /healthz (abc1234)

## ❌ Blocking Issues

- BuildId mismatch: /healthz reports "abc1234" but header shows "xyz7890"

### Domain Verification Results

| Domain | BuildId | Stable | Header Matches | Error |
|--------|---------|--------|----------------|-------|
| https://app.example.com | abc1234 | yes | yes | - |

## Recommended Next Action

Address all blocking issues before proceeding with launch.
```

---

## Example 6: FAIL (verify:prod No Table)

**Scenario:** verify:prod script runs but returns no results table.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Running domain/build consistency verification...
ERROR: verify:prod failed: VERIFY_PROD_NO_TABLE
No results table returned from verify:prod

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: FAIL

❌ Blocking Issues: 1
  - verify:prod failed to return a results table

Recommended: Address all blocking issues before proceeding with launch.

Exit code: 1
```

---

## Example 7: FAIL (No Domains + Auto-Discovery Failed)

**Scenario:** No DOMAINS env var and VERCEL_TOKEN auto-discovery fails.

**Command:**
```bash
VERCEL_TOKEN="invalid-token" node scripts/launch-status.mjs
```

**Output:**
```
Auto-discovery failed: HTTP_401 Unauthorized
ERROR: No DOMAINS provided AND VERCEL_TOKEN auto-discovery failed.
Either set DOMAINS env var or ensure VERCEL_TOKEN is valid.
Example: DOMAINS="https://your-domain.com" npm run launch:status
```

**Exit code: 1**

---

## Example 8: FAIL (--strict Mode, Harness Unavailable)

**Scenario:** Running in --strict mode but harness metrics are unavailable.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs --strict
```

**Output:**
```
Generating launch status report...

Running in --strict mode (harness metrics required)

Checking 1 domain(s): https://app.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Running domain/build consistency verification...
Extracting debug harness metrics...
Debug harness not accessible: PLAYWRIGHT_NOT_AVAILABLE
ERROR: Harness unavailable but --strict mode requires it

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: FAIL

❌ Blocking Issues: 1
  - Debug harness unavailable (required in --strict mode): PLAYWRIGHT_NOT_AVAILABLE

Recommended: Debug harness is required in --strict mode. Ensure Playwright is installed and harness is accessible.

Exit code: 1
```

**LAUNCH_STATUS.md:**
```markdown
# Launch Status Report

**Generated:** 2025-01-27T12:00:00.000Z

## Overall Status: ❌ FAIL

### Build Information
- **BuildId:** abc1234
- **Timestamp:** 2025-01-27T11:45:30.123Z
- **Header BuildId:** abc1234

## ❌ Blocking Issues

- Debug harness unavailable (required in --strict mode): PLAYWRIGHT_NOT_AVAILABLE

### Domain Verification Results

| Domain | BuildId | Stable | Header Matches | Error |
|--------|---------|--------|----------------|-------|
| https://app.example.com | abc1234 | yes | yes | - |

## Recommended Next Action

Debug harness is required in --strict mode. Ensure Playwright is installed and harness is accessible.
```

---

## Summary of Exit Codes

| Scenario | Exit Code | Status |
|----------|-----------|--------|
| All checks pass | 0 | PASS |
| Harness unavailable (non-strict) | 0 | WARN |
| Domain verification failure | 1 | FAIL |
| /healthz unreachable | 1 | FAIL |
| BuildId header mismatch | 1 | FAIL |
| verify:prod no table | 1 | FAIL |
| No domains + auto-discovery failed | 1 | FAIL |
| --strict mode + harness unavailable | 1 | FAIL |
