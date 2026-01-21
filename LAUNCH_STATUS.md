# Launch Status Report

**Generated:** 2026-01-20T08:39:30.310Z

## Overall Status: ❌ FAIL

### Build Information
- **Primary Domain:** https://athlete-ledger.vercel.app
- **BuildId:** unknown
- **Timestamp:** 2026-01-20T08:39:54.014Z

## ❌ Blocking Issues

- verify:prod failed: Command failed: C:\nvm4w\nodejs\node.exe C:\Users\13109\Desktop\Monster Collective\scripts\verify-all-domains.mjs
❌ 1 domain(s) failed verification

- /healthz endpoint not accessible: Unexpected token '<', "<!doctype "... is not valid JSON

## ⚠️ Non-Blocking Issues

- DEBUG_GATED: Debug routes are gated in production. Set VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to enable access.

### Domain Verification Results

**Error:** Command failed: C:\nvm4w\nodejs\node.exe C:\Users\13109\Desktop\Monster Collective\scripts\verify-all-domains.mjs
❌ 1 domain(s) failed verification


### Debug Harness

- **Status:** DEBUG_GATED
- **Note:** Debug routes are intentionally gated in production. Set VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to enable access. In --strict mode, this causes FAIL unless ALLOW_STRICT_WITHOUT_DEBUG=true is set.

## Recommended Next Action

Investigate and fix domain verification failures before proceeding with launch.

## PROOF

### Exact Command Run

```bash
VERCEL_TOKEN="***REDACTED***" C:\nvm4w\nodejs\node.exe C:\Users\13109\Desktop\Monster Collective\scripts\launch-status.mjs
```

### Timestamp of Report Generation

2026-01-20T08:39:30.310Z

### Raw /healthz JSON Payload

**Error:** Unexpected token '<', "<!doctype "... is not valid JSON

### Raw verify:prod Table Output

**Error:** Command failed: C:\nvm4w\nodejs\node.exe C:\Users\13109\Desktop\Monster Collective\scripts\verify-all-domains.mjs
❌ 1 domain(s) failed verification


### Harness Raw Metrics

**Status:** DEBUG_GATED

