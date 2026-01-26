# Athlete Ledger - Endgame Definition

**Purpose:** Define "Finished" for Athlete Ledger launch readiness.  
**Last Updated:** 2025-01-27

---

## Launch Criteria (Must-Pass Checks)

| Check | Status | Command/Verification |
|-------|--------|---------------------|
| Build succeeds without errors | ⬜ | `npm run build` |
| TypeScript compiles cleanly | ⬜ | `npx tsc --noEmit` |
| All domains serve same buildId | ⬜ | `npm run verify:all-domains` |
| `/healthz` returns buildId | ⬜ | `curl https://your-domain.com/healthz` |
| Debug routes protected in production | ⬜ | Manual: visit `/debug/build` in prod → 404/403 |
| Auth endpoints return 401 when unauthenticated | ⬜ | `curl https://your-domain.com/api/auth/me` |
| No console errors on page load | ⬜ | Browser DevTools → Console |

---

## Non-Negotiable Quality Gates

### Build Consistency

| Gate | PASS | WARN | FAIL | Verification |
|------|------|------|------|--------------|
| `/healthz` returns `buildId` | buildId present | buildId='unknown' | no buildId | `curl $DOMAIN/healthz \| jq .buildId` |
| Client header matches `/healthz` buildId | matches | n/a | mismatch | `scripts/verify-all-domains.mjs` |
| All domains have same buildId | all match | 1 mismatch | 2+ mismatch | `npm run verify:all-domains` |
| BuildId format valid (7-char SHA or ISO) | valid | 'unknown' | missing | Manual inspection |

**Commands:**
```bash
# Local
npm run build && node scripts/verify-build.mjs http://localhost:5173

# CI
npm run build && DOMAINS="https://staging.example.com" npm run verify:all-domains

# Production
DOMAINS="https://app.example.com,https://www.example.com" npm run verify:all-domains
```

### Error UX

| Gate | PASS | WARN | FAIL | Verification |
|------|------|------|------|--------------|
| Network errors show user-friendly message | "Network error. Check your connection" | Generic error | No error shown | Simulate offline → search |
| Rate limit (429) shows clear message | "Server is rate limiting (429)" | Generic error | No error shown | Trigger 429 → verify message |
| Auth errors (401/403) redirect to login | Redirects | Shows error | No action | Unauthenticated API call |
| Validation errors include requestId | requestId in message | No requestId | No error shown | Trigger validation error |
| ErrorBoundary catches render errors | Shows error UI | Console only | Crashes | Trigger render error |
| Stale results indicator shown | "Stale data" badge | No indicator | No fallback | Rapid search → verify indicator |

**Commands:**
```bash
# Local (manual browser testing)
# 1. Open DevTools → Network → Throttle to "Offline"
# 2. Trigger search → verify error message
# 3. Restore network → verify retry works

# CI (automated)
# Use Playwright to simulate offline and verify error messages
```

### Rate Limit Handling

| Gate | PASS | WARN | FAIL | Verification |
|------|------|------|------|--------------|
| Google Places OVER_QUERY_LIMIT handled | Exponential backoff | No retry | Crashes | Trigger quota limit |
| 429 responses show user message | "Rate limiting" message | Generic error | No handling | Mock 429 response |
| Request cancellation prevents wasted calls | AbortController used | Flag only | No cancellation | Rapid interactions |
| Concurrent requests don't exhaust quota | Throttled/batched | Uncontrolled | Crashes | Run 20 concurrent searches |

**Commands:**
```bash
# Local (harness)
npm run dev
# Navigate to /debug/discover-recruiting
# Run "20 concurrent" → verify <5% failure rate

# Production (manual)
# Use debug harness (if accessible) or monitor API logs
```

### Auth Readiness

| Gate | PASS | WARN | FAIL | Verification |
|------|------|------|------|--------------|
| `/api/auth/me` returns 401 when unauthenticated | 401 status | 200 with null | 500 | `curl $DOMAIN/api/auth/me` |
| Protected routes redirect to login | Redirects | Shows error | Accessible | Visit `/app/profile` unauthenticated |
| Session persists across page reloads | User stays logged in | Re-login required | No session | Login → reload → verify |
| Supabase env vars configured | Both vars set | One missing | Neither set | Check Vercel dashboard |
| RLS policies enforce user isolation | User A can't see User B data | Partial isolation | No isolation | Manual test with 2 accounts |

**Commands:**
```bash
# Local
curl http://localhost:5173/api/auth/me
# Expected: 401 Unauthorized

# Production
curl https://your-domain.com/api/auth/me
# Expected: 401 Unauthorized
```

---

## Per-Feature Acceptance Tests

### 1. Discover (Business Search)

| Test | PASS | WARN | FAIL | Command/Steps |
|------|------|------|------|---------------|
| Search with "What" + "Where" returns results | Results shown | Empty results | Error/crash | Enter "pizza" + "New York, NY" → Search |
| Places Autocomplete works on "Where" input | Suggestions appear | No suggestions | Crashes | Type "New Y" → verify suggestions |
| Map renders with markers | Markers visible | Map loads, no markers | No map | Search → verify map + markers |
| Clicking result highlights marker | Marker highlighted | No highlight | Crashes | Click result card → verify marker |
| Clicking marker selects result | Card selected | No selection | Crashes | Click marker → verify card |
| Details panel shows place info | Name, address, rating shown | Partial info | No details | Select result → verify panel |
| Rapid searches don't show stale results | Latest results shown | 1 stale result | Multiple stale | Search A → Search B → verify B |
| Empty results show empty state | "No results" message | Loading forever | Error | Search invalid query |
| Loading state shows during search | Spinner/skeleton | No loading | Crashes | Search → verify loading |
| Saved businesses persist | Saved → reload → still saved | Partial persistence | No persistence | Save business → reload → verify |
| Error messages are user-friendly | Clear message | Generic error | No error | Trigger error → verify message |
| Retry button works | Retry succeeds | Partial retry | No retry | Error → click retry → verify |

**Commands:**
```bash
# Local (manual)
npm run dev
# Navigate to Discover tab
# Follow test steps above

# CI (Playwright)
npx playwright test tests/discover.spec.ts
```

### 2. Recruiting Finder

| Test | PASS | WARN | FAIL | Command/Steps |
|------|------|------|------|---------------|
| Search with sport/level/region returns programs | Results shown | Empty results | Error/crash | Select sport → Search |
| Map renders with program markers | Markers visible | Map loads, no markers | No map | Search → verify map |
| Swipe deck shows program cards | Cards visible | Partial cards | No cards | Search → verify deck |
| Fit analysis calculates score | Score shown | No score | Crashes | Search → select program → verify score |
| Rapid searches cancel previous | Only latest shown | 1 stale result | Multiple stale | Search A → Search B → verify B |
| AbortController cancels in-flight requests | Request cancelled | Partial cancellation | No cancellation | Search → immediately search again |
| Last known good shown on error | Previous results shown | No fallback | Error shown | Trigger error → verify fallback |
| Validation errors include requestId | requestId in message | No requestId | No error | Trigger validation error |
| Offline detection works | "You're offline" message | Generic error | No detection | Simulate offline → search |
| Rate limit (429) handled | "Rate limiting" message | Generic error | No handling | Trigger 429 → verify |
| Static fallback works when API fails | Fallback data shown | Partial fallback | No fallback | Disable API → search |

**Commands:**
```bash
# Local (manual)
npm run dev
# Navigate to Recruiting → Recruiting Finder
# Follow test steps above

# CI (Playwright)
npx playwright test tests/recruiting-finder.spec.ts
```

### 3. Recruiting Explore Map

| Test | PASS | WARN | FAIL | Command/Steps |
|------|------|------|------|---------------|
| Map loads with default view | Map visible | Slow load | No map | Navigate to Explore tab |
| Panning map triggers search | Results update | Delayed update | No update | Pan map → verify search |
| Zooming map adjusts search radius | Radius changes | Fixed radius | No search | Zoom in/out → verify results |
| Filters (sport/level/orgType) work | Results filtered | Partial filter | No filter | Set filter → verify results |
| "Search this area" button works | Results refresh | Partial refresh | No refresh | Click button → verify |
| Place details panel shows info | Details shown | Partial details | No details | Click marker → verify panel |
| Rapid panning doesn't show stale results | Latest results | 1 stale | Multiple stale | Rapid pan → verify |
| Empty results show empty state | "No results" message | Loading forever | Error | Search invalid area |
| Loading state shows during search | Spinner shown | No loading | Crashes | Trigger search → verify loading |
| Error messages are user-friendly | Clear message | Generic error | No error | Trigger error → verify |
| Saved targets persist | Saved → reload → still saved | Partial persistence | No persistence | Save target → reload → verify |
| "My Targets" shows saved orgs | Targets listed | Partial list | No list | Save → navigate to My Targets |

**Commands:**
```bash
# Local (manual)
npm run dev
# Navigate to Recruiting → Explore (Map)
# Follow test steps above

# CI (Playwright)
npx playwright test tests/recruiting-explore.spec.ts
```

---

## Production Verification Requirements

### Build ID Verification

| Requirement | PASS | WARN | FAIL | Command |
|-------------|------|------|------|----------|
| `/healthz` returns `buildId` | buildId present | buildId='unknown' | no buildId | `curl $DOMAIN/healthz \| jq .buildId` |
| buildId matches client header | matches | n/a | mismatch | `scripts/verify-all-domains.mjs` |
| buildId consistent across domains | all match | 1 mismatch | 2+ mismatch | `npm run verify:all-domains` |
| buildId format valid | 7-char SHA or ISO | 'unknown' | missing/invalid | Manual inspection |

**Commands:**
```bash
# Single domain
DEPLOY_URL="https://your-domain.com" node scripts/verify-build.mjs

# All domains (auto-discover from Vercel)
VERCEL_TOKEN="your-token" npm run verify:all-domains

# Manual domains
DOMAINS="https://app.example.com,https://www.example.com" npm run verify:all-domains
```

### Debug Routes Protection

| Requirement | PASS | WARN | FAIL | Command |
|-------------|------|------|------|----------|
| `/debug/build` returns 404/403 in production | 404/403 | Accessible | 200 | `curl $DOMAIN/debug/build` |
| `/debug/discover-recruiting` returns 404/403 | 404/403 | Accessible | 200 | `curl $DOMAIN/debug/discover-recruiting` |
| Debug routes not in production build | Not included | Included | Accessible | Check `dist/` after build |

**Commands:**
```bash
# Production
curl https://your-domain.com/debug/build
# Expected: 404 Not Found

curl https://your-domain.com/debug/discover-recruiting
# Expected: 404 Not Found

# Verify build doesn't include debug routes
npm run build && grep -r "debug" dist/ | grep -v ".map"
# Expected: No matches (or only in source maps)
```

### Harness Failure Rate Thresholds

| Requirement | PASS | WARN | FAIL | Command |
|-------------|------|------|------|----------|
| Discover: <5% failure rate (50 sequential) | <5% | 5-10% | >10% | Debug harness → 50 sequential |
| Recruiting: <5% failure rate (50 sequential) | <5% | 5-10% | >10% | Debug harness → 50 sequential |
| Discover: <10% failure rate (20 concurrent) | <10% | 10-20% | >20% | Debug harness → 20 concurrent |
| Recruiting: <10% failure rate (20 concurrent) | <10% | 10-20% | >20% | Debug harness → 20 concurrent |
| Median latency <2000ms | <2000ms | 2000-3000ms | >3000ms | Debug harness → check median |
| P95 latency <5000ms | <5000ms | 5000-7000ms | >7000ms | Debug harness → check P95 |

**Commands:**
```bash
# Local (requires debug harness accessible)
npm run dev
# Navigate to /debug/discover-recruiting
# Run "50 sequential" → verify failure rate <5%
# Run "20 concurrent" → verify failure rate <10%

# Production (if debug routes accessible)
# Same as above, but against production domain
```

---

## Verification Commands Summary

### Local Development

```bash
# Build verification
npm run build
npx tsc --noEmit

# Single domain verification
node scripts/verify-build.mjs http://localhost:5173

# Manual feature testing
npm run dev
# Navigate to Discover, Recruiting Finder, Recruiting Explore Map
# Follow acceptance test steps

# Debug harness (if accessible)
# Navigate to /debug/discover-recruiting
# Run sequential/concurrent tests → verify failure rates
```

### CI Pipeline

```bash
# Build
npm ci
npm run build
npx tsc --noEmit

# Build ID verification (staging)
DEPLOY_URL="https://staging.example.com" node scripts/verify-build.mjs

# Multi-domain consistency (staging)
DOMAINS="https://staging.example.com,https://staging-alt.example.com" npm run verify:all-domains

# E2E tests (Playwright)
npx playwright test

# Debug routes protection (verify 404)
curl -f https://staging.example.com/debug/build || echo "PASS: 404 as expected"
curl -f https://staging.example.com/debug/discover-recruiting || echo "PASS: 404 as expected"
```

### Production Verification

```bash
# Build ID consistency across all domains
VERCEL_TOKEN="your-token" npm run verify:all-domains

# Or manual domains
DOMAINS="https://app.example.com,https://www.example.com,https://api.example.com" npm run verify:all-domains

# Health check
curl https://app.example.com/healthz | jq .
# Expected: { "buildId": "abc1234", "timestamp": "..." }

# Debug routes protection
curl https://app.example.com/debug/build
# Expected: 404 Not Found

curl https://app.example.com/debug/discover-recruiting
# Expected: 404 Not Found

# Auth readiness
curl https://app.example.com/api/auth/me
# Expected: 401 Unauthorized

# Feature smoke tests (manual)
# 1. Discover: Search "pizza" + "New York" → verify results
# 2. Recruiting Finder: Search sport → verify programs
# 3. Recruiting Explore Map: Pan map → verify results update
```

---

## Checklist Summary

**Launch Criteria:** All must be PASS  
**Quality Gates:** All must be PASS (WARN acceptable for non-critical)  
**Feature Acceptance:** All core flows must PASS  
**Production Verification:** All must PASS

**Status Legend:**
- ⬜ = Not checked
- ✅ = PASS
- ⚠️ = WARN (acceptable for non-critical)
- ❌ = FAIL (blocks launch)

---

## Notes

- **Debug routes:** Must be protected in production (404/403) or excluded from build
- **Build ID:** Must be consistent across all domains (CDN, API, app)
- **Failure rates:** Thresholds are guidelines; investigate if exceeded
- **Error UX:** All errors must be user-friendly with actionable messages
- **Auth:** All protected routes must redirect unauthenticated users
