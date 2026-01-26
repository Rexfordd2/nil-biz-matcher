# Launch Status Hardened Examples

This document shows example outputs for different scenarios when running `scripts/launch-status.mjs` with hardened status logic.

## Exit Codes

- **0**: PASS or WARN (non-blocking issues only)
- **1**: FAIL (blocking issues present)

## Example 1: PASS ✅

**Scenario:** All checks pass, harness metrics available and within thresholds.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Selected primary domain: https://app.example.com

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
- **Primary Domain:** https://app.example.com
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

#### Discover
- **Failure Rate:** 2.00%
- **Inconsistency Rate:** 1.00%

#### Recruiting
- **Failure Rate:** 1.50%
- **Inconsistency Rate:** 0.50%

## Recommended Next Action

All checks passed. Ready for launch.
```

---

## Example 2: WARN ⚠️ (Harness Unavailable)

**Scenario:** All critical checks pass, but harness metrics are unavailable (Playwright not installed or debug pages inaccessible).

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Selected primary domain: https://app.example.com

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
- **Primary Domain:** https://app.example.com
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

### Debug Harness

- **Status:** HARNESS_UNAVAILABLE (PLAYWRIGHT_NOT_AVAILABLE)
- **Note:** Debug harness requires VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to be accessible

## ⚠️ Non-Blocking Issues

- HARNESS_UNAVAILABLE: PLAYWRIGHT_NOT_AVAILABLE

## Recommended Next Action

Debug harness metrics unavailable. Review other issues and consider running with --strict mode for full validation.
```

---

## Example 3: WARN ⚠️ (Missing Config)

**Scenario:** All critical checks pass, harness available, but missing non-critical environment variable.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Selected primary domain: https://app.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Running domain/build consistency verification...
Extracting debug harness metrics...

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: WARN

⚠️  Non-Blocking Issues: 1
  - GOOGLE_MAPS_API_KEY not set (business search may use fallback)

Recommended: Review non-blocking issues and address critical ones before launch.

Exit code: 0
```

**LAUNCH_STATUS.md:**
```markdown
# Launch Status Report

**Generated:** 2025-01-27T12:00:00.000Z

## Overall Status: ⚠️ WARN

### Build Information
- **Primary Domain:** https://app.example.com
- **BuildId:** abc1234
- **Timestamp:** 2025-01-27T11:45:30.123Z
- **Header BuildId:** abc1234

### Environment Variables (Presence)
- **GOOGLE_MAPS_API_KEY:** ❌ Missing
- **VERCEL_GIT_COMMIT_SHA:** ✅ Present

### Domain Verification Results

| Domain | BuildId | Stable | Header Matches | Error |
|--------|---------|--------|----------------|-------|
| https://app.example.com | abc1234 | yes | yes | - |

### Debug Harness Metrics

#### Discover
- **Failure Rate:** 2.00%
- **Inconsistency Rate:** 1.00%

#### Recruiting
- **Failure Rate:** 1.50%
- **Inconsistency Rate:** 0.50%

## ⚠️ Non-Blocking Issues

- GOOGLE_MAPS_API_KEY not set (business search may use fallback)

## Recommended Next Action

Review non-blocking issues and address critical ones before launch.
```

---

## Example 4: FAIL ❌ (verify:prod Failed)

**Scenario:** verify:prod script failed to run or returned no parseable results.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Selected primary domain: https://app.example.com

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

**LAUNCH_STATUS.md:**
```markdown
# Launch Status Report

**Generated:** 2025-01-27T12:00:00.000Z

## Overall Status: ❌ FAIL

### Build Information
- **Primary Domain:** https://app.example.com
- **BuildId:** abc1234
- **Timestamp:** 2025-01-27T11:45:30.123Z

## ❌ Blocking Issues

- verify:prod failed to return a results table

## Recommended Next Action

Address all blocking issues before proceeding with launch.
```

---

## Example 5: FAIL ❌ (Domain Failure)

**Scenario:** One or more domains failed verification (buildId mismatch, unstable, or header mismatch).

**Command:**
```bash
DOMAINS="https://app.example.com,https://www.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 2 domain(s): https://app.example.com, https://www.example.com

Selected primary domain: https://app.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Running domain/build consistency verification...

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: FAIL

❌ Blocking Issues: 2
  - 1 domain(s) failed verification
  - https://www.example.com: buildId=xyz5678, stable=no, headerMatches=yes

Recommended: Investigate and fix domain verification failures before proceeding with launch.

Exit code: 1
```

**LAUNCH_STATUS.md:**
```markdown
# Launch Status Report

**Generated:** 2025-01-27T12:00:00.000Z

## Overall Status: ❌ FAIL

### Build Information
- **Primary Domain:** https://app.example.com
- **BuildId:** abc1234
- **Timestamp:** 2025-01-27T11:45:30.123Z
- **Header BuildId:** abc1234

### Domain Verification Results

| Domain | BuildId | Stable | Header Matches | Error |
|--------|---------|--------|----------------|-------|
| https://app.example.com | abc1234 | yes | yes | - |
| https://www.example.com | xyz5678 | no | yes | - |

## ❌ Blocking Issues

- 1 domain(s) failed verification
  - https://www.example.com: buildId=xyz5678, stable=no, headerMatches=yes

## Recommended Next Action

Investigate and fix domain verification failures before proceeding with launch.
```

---

## Example 6: FAIL ❌ (BuildId Mismatch)

**Scenario:** Header buildId does not match /healthz buildId.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Selected primary domain: https://app.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Running domain/build consistency verification...
Extracting debug harness metrics...

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: FAIL

❌ Blocking Issues: 1
  - BuildId mismatch: /healthz reports "abc1234" but header shows "xyz5678"

Recommended: Fix buildId consistency across domains by ensuring all deployments use the same build.

Exit code: 1
```

**LAUNCH_STATUS.md:**
```markdown
# Launch Status Report

**Generated:** 2025-01-27T12:00:00.000Z

## Overall Status: ❌ FAIL

### Build Information
- **Primary Domain:** https://app.example.com
- **BuildId:** abc1234
- **Timestamp:** 2025-01-27T11:45:30.123Z
- **Header BuildId:** xyz5678
- **⚠️ BuildId Mismatch:** Header (xyz5678) ≠ /healthz (abc1234)

## ❌ Blocking Issues

- BuildId mismatch: /healthz reports "abc1234" but header shows "xyz5678"

## Recommended Next Action

Fix buildId consistency across domains by ensuring all deployments use the same build.
```

---

## Example 7: FAIL ❌ (/healthz Missing buildId)

**Scenario:** /healthz endpoint accessible but returned missing or invalid buildId.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Selected primary domain: https://app.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Running domain/build consistency verification...

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: FAIL

❌ Blocking Issues: 1
  - /healthz returned missing or invalid buildId

Recommended: Address all blocking issues before proceeding with launch.

Exit code: 1
```

---

## Example 8: FAIL ❌ (--strict mode, Harness Unavailable)

**Scenario:** Running with --strict flag, but harness metrics are unavailable.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs --strict
```

**Output:**
```
Generating launch status report...

Running in --strict mode (harness metrics required)

Checking 1 domain(s): https://app.example.com

Selected primary domain: https://app.example.com

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
- **Primary Domain:** https://app.example.com
- **BuildId:** abc1234
- **Timestamp:** 2025-01-27T11:45:30.123Z
- **Header BuildId:** abc1234

### Domain Verification Results

| Domain | BuildId | Stable | Header Matches | Error |
|--------|---------|--------|----------------|-------|
| https://app.example.com | abc1234 | yes | yes | - |

### Debug Harness

- **Status:** HARNESS_UNAVAILABLE (PLAYWRIGHT_NOT_AVAILABLE)
- **Note:** Debug harness requires VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to be accessible

## ❌ Blocking Issues

- Debug harness unavailable (required in --strict mode): PLAYWRIGHT_NOT_AVAILABLE

## Recommended Next Action

Debug harness is required in --strict mode. Ensure Playwright is installed and harness is accessible.
```

---

## Example 9: FAIL ❌ (High Failure Rate)

**Scenario:** Harness metrics show failure rates exceeding thresholds.

**Command:**
```bash
DOMAINS="https://app.example.com" node scripts/launch-status.mjs
```

**Output:**
```
Generating launch status report...

Checking 1 domain(s): https://app.example.com

Selected primary domain: https://app.example.com

Fetching /healthz endpoint...
Extracting buildId from homepage header...
Running domain/build consistency verification...
Extracting debug harness metrics...

✅ Launch status report generated: LAUNCH_STATUS.md

Overall Status: FAIL

❌ Blocking Issues: 1
  - Discover failure rate too high: 15.00% (threshold: 10%)

Recommended: Investigate and fix high failure rates in debug harness before launch.

Exit code: 1
```

---

## Summary of Hardened Rules

### FAIL (exit 1) Conditions:
1. ✅ verify:prod did not run successfully OR produced no parseable results
2. ✅ /healthz fetch failed OR returned missing buildId
3. ✅ any domain failed OR buildId mismatch across domains
4. ✅ header buildId does not match /healthz buildId
5. ✅ harness unavailable in --strict mode
6. ✅ harness metrics exceed thresholds (failure rate > 10%, inconsistency rate > 10%)

### WARN (exit 0) Conditions:
1. ✅ harness metrics unavailable (unless --strict mode)
2. ✅ env presence booleans show missing non-critical config
3. ✅ harness metrics elevated but within thresholds (failure rate 5-10%, inconsistency rate 5-10%)

### PASS (exit 0) Conditions:
1. ✅ all domains pass and match buildId
2. ✅ header matches /healthz buildId
3. ✅ harness metrics available and within thresholds (unless strict mode disabled)
4. ✅ no blocking issues
5. ✅ no non-blocking issues (or only non-critical config warnings)
