# Athlete Ledger - Product Status Audit
**Date:** 2025-01-27  
**Audit Type:** Current-State Technical Assessment  
**Scope:** Deployment, Features, APIs, Environment, Observability, Risk

---

## Executive Summary

Athlete Ledger demonstrates solid engineering practices with request cancellation, version guards, response validation, and structured observability. The codebase shows evidence of production-ready patterns including AbortController usage, request versioning, error handling with fallbacks, and build ID tracking. However, **debug routes are accessible in production** without guards, and **Recruiting Explore Map** lacks the same race-safety patterns as other features. The product is **functional but has non-blocking risks** that could cause inconsistent behavior under load or during rapid user interactions.

**Overall Status: WARN** (functional with non-blocking issues)

---

## 1. Deployment & Build Integrity

### Current State Evidence

**Build ID System:**
- ✅ `/api/healthz` endpoint exists (`api/healthz.ts:15-26`)
- ✅ Build ID derived from `VERCEL_GIT_COMMIT_SHA` → shortened to 7 chars, fallback to 'unknown'
- ✅ Client build ID injected via Vite `__BUILD_ID__` define (`vite.config.ts:34-42`)
- ✅ Build ID visible in `/debug/build` page (`src/pages/DebugBuild.tsx:77-86`)

**Verification Scripts:**
- ✅ `scripts/verify-build.mjs` - Single domain verification
- ✅ `scripts/verify-all-domains.mjs` - Multi-domain consistency check
- ✅ Scripts check `/healthz` response and HTML header build ID match

**Production State:**
- ❓ **Cannot verify without running scripts against production domains**
- ❓ **No evidence of current production build ID in repo**

**Status:** **WARN** - Build system exists but current production state unknown

---

## 2. Core Feature Health

### 2.1 Discover (Business Search)

**Evidence:**
- File: `src/components/Discover.tsx`
- Hook: `src/hooks/usePlacesSearch.ts`

**Race Safety:**
- ✅ Request versioning via `requestIdRef.current` (`usePlacesSearch.ts:40,66,102,134`)
- ✅ Cancellation flag `cancelled` checked before state updates (`usePlacesSearch.ts:73,102,134,170`)
- ✅ Last known good results shown on error (`usePlacesSearch.ts:42,153,172-181`)

**Error Handling:**
- ✅ Errors logged to Observability (`usePlacesSearch.ts:186-194`)
- ✅ Empty results vs failure distinguished (`usePlacesSearch.ts:166-168`)
- ✅ Stale state indicator shown (`Discover.tsx:228-232`)
- ✅ Retry mechanism exists (`usePlacesSearch.ts:207-210`)

**Request Cancellation:**
- ✅ Uses cleanup function in useEffect (`usePlacesSearch.ts:202-204`)
- ⚠️ **No AbortController** - relies on `cancelled` flag only

**Status:** **PASS** - Reliable with minor gap (no AbortController)

---

### 2.2 Recruiting Finder

**Evidence:**
- File: `src/components/RecruitingFinder.tsx`
- Service: `src/recruiting/search.ts`

**Race Safety:**
- ✅ AbortController implemented (`RecruitingFinder.tsx:36,48-50`)
- ✅ Request versioning via `reqVersionRef` (`RecruitingFinder.tsx:37,51,69,77,103`)
- ✅ Version check before state updates (`RecruitingFinder.tsx:69,77,103`)
- ✅ Abort signal passed to fetch (`recruiting/search.ts:38`)

**Error Handling:**
- ✅ Abort ignored silently (`RecruitingFinder.tsx:76`)
- ✅ Last known good shown on error (`RecruitingFinder.tsx:79-81`)
- ✅ ValidationError surfaced with requestId (`RecruitingFinder.tsx:89-91`)
- ✅ HTTP status codes mapped to user messages (`RecruitingFinder.tsx:94-97`)
- ✅ Fallback to local static dataset (`recruiting/search.ts:104-119`)

**Request Cancellation:**
- ✅ AbortController cleanup on unmount (`RecruitingFinder.tsx:108-112`)
- ✅ Signal checked in retry logic (`recruiting/search.ts:52`)

**Status:** **PASS** - Robust implementation

---

### 2.3 Recruiting Explore Map

**Evidence:**
- File: `src/components/Recruiting.tsx` (ExplorePanel component)

**Race Safety:**
- ⚠️ **Token-based versioning only** (`Recruiting.tsx:124,197,241,249,254`)
- ⚠️ **No AbortController** - relies on token comparison
- ⚠️ **No request version guard** - different pattern than Finder

**Error Handling:**
- ✅ Errors set in state (`Recruiting.tsx:119,199,250`)
- ✅ Empty results handled (`Recruiting.tsx:422-424`)
- ⚠️ **No last-known-good fallback**
- ⚠️ **No Observability logging** for errors

**Request Cancellation:**
- ⚠️ **Token check only** - no signal-based cancellation

**Status:** **WARN** - Less robust than Finder, potential race conditions

---

## 3. API & Data Layer

### External APIs Used

**Google Maps/Places API:**
- ✅ Client-side: `VITE_GOOGLE_MAPS_API_KEY` (`src/lib/googleMapsLoader.ts:24`)
- ✅ Server-side: `GOOGLE_MAPS_API_KEY` (`api/business/search.ts:39`)
- ✅ Rate limit handling: Exponential backoff for `OVER_QUERY_LIMIT` (`usePlacesSearch.ts:121-126`)
- ✅ Auth failure: Handled via error messages (`usePlacesSearch.ts:177`)

**Google Custom Search Engine (CSE):**
- ⚠️ Optional: `VITE_GOOGLE_CSE_API_KEY` + `VITE_GOOGLE_CSE_CX` (`src/services/googleCse.ts:15-16`)
- ✅ Graceful degradation when not configured (`Recruiting.tsx:587,923-927`)

**Supabase:**
- ✅ Required: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (`src/lib/supabaseClient.ts:3-4`)
- ✅ RLS errors detected and mapped (`Recruiting.tsx:628-629`, `Discover.tsx:108-109`)
- ✅ Schema validation: Type-safe client usage

**Recruiting Programs API:**
- ✅ Static dataset fallback (`api/recruiting/search.ts:49-54`, `src/recruiting/search.ts:104-119`)
- ✅ No external dependency - always available

### Request Safety

**AbortController Usage:**
- ✅ `RecruitingFinder`: Full implementation (`RecruitingFinder.tsx:36,48-50`)
- ✅ `searchBusinesses`: Signal passed (`src/services/search.ts:34`)
- ✅ `searchPrograms`: Signal passed (`src/recruiting/search.ts:38`)
- ⚠️ `usePlacesSearch`: No AbortController (cancellation flag only)
- ⚠️ `Recruiting Explore`: No AbortController (token only)

**Request Version Guards:**
- ✅ `RecruitingFinder`: `reqVersionRef` (`RecruitingFinder.tsx:37,51,69,77,103`)
- ✅ `usePlacesSearch`: `requestIdRef` (`usePlacesSearch.ts:40,66,102,134`)
- ⚠️ `Recruiting Explore`: Token-based only (`Recruiting.tsx:124,197,241,249`)

**Response Validation:**
- ✅ `validateBusinessResponse` (`src/validation/validators.ts:27-53`)
- ✅ `validateProgramsResponse` (`src/validation/validators.ts:56-70`)
- ✅ ValidationError thrown with requestId (`src/validation/validators.ts:1-10`)
- ✅ Validation errors logged to Observability (`src/services/search.ts:69-70`)

**Status:** **PASS** - Well-implemented with minor gaps

---

## 4. Environment Configuration

### Required Environment Variables

**Client-Side (VITE_*):**
- ✅ `VITE_GOOGLE_MAPS_API_KEY` - Checked at runtime (`src/components/Discover.tsx:15-18`)
- ✅ `VITE_SUPABASE_URL` - Validated (`src/lib/supabaseClient.ts:23-31`)
- ✅ `VITE_SUPABASE_ANON_KEY` - Validated (`src/lib/supabaseClient.ts:34`)
- ⚠️ `VITE_GOOGLE_CSE_API_KEY` - Optional, checked (`src/services/googleCse.ts:15`)
- ⚠️ `VITE_GOOGLE_CSE_CX` - Optional, checked (`src/services/googleCse.ts:16`)

**Server-Side:**
- ⚠️ `GOOGLE_MAPS_API_KEY` - Optional, falls back to mock in non-prod (`api/business/search.ts:48-68`)
- ✅ `VERCEL_GIT_COMMIT_SHA` - Auto-provided by Vercel (`api/healthz.ts:5`)

**Environment Checks:**
- ✅ `supabaseEnvConfigured` boolean exported (`src/lib/supabaseClient.ts:7-12`)
- ✅ UI shows warnings when env missing (`src/components/Discover.tsx:176-179`)
- ✅ Dev banner when Supabase not configured (`src/routes/RootRouter.tsx:122-125`)

**Production State:**
- ❓ **Cannot verify production env vars without access to Vercel dashboard**

**Status:** **WARN** - Configuration system exists, production state unknown

---

## 5. Debug & Observability

### Debug Routes

**Routes:**
- ✅ `/debug/build` - Accessible (`src/routes/RootRouter.tsx:40,90-91`)
- ✅ `/debug/discover-recruiting` - Accessible (`src/routes/RootRouter.tsx:39,87-89`)

**Production Access:**
- ❌ **NO PRODUCTION GUARDS** - Routes accessible in production
- ❌ **No authentication check** - Publicly accessible
- ⚠️ Debug harness can generate load (`src/pages/DebugDiscoverRecruiting.tsx:110-172`)

**Evidence:**
- Routes defined without guards (`src/routes/RootRouter.tsx:39-40,87-91`)
- No `import.meta.env.PROD` check before rendering debug components

**Status:** **FAIL** - Debug routes exposed in production

---

### Observability System

**Implementation:**
- ✅ Structured logging via `src/lib/obs.ts`
- ✅ RequestId generation (`src/lib/obs.ts:48-55`)
- ✅ In-memory ring buffer (200 entries max) (`src/lib/obs.ts:33-34`)
- ✅ Logs include: feature, route, status, requestId, duration, errors (`src/lib/obs.ts:18-31`)

**Diagnostics Panel:**
- ✅ `DiagnosticsPanel` component exists (`src/components/DiagnosticsPanel.tsx`)
- ✅ Enabled when `VITE_DIAGNOSTICS=true` OR `import.meta.env.DEV` (`src/lib/obs.ts:37-45`)
- ✅ Shows last requestIds per feature (`src/components/DiagnosticsPanel.tsx:24-25`)
- ✅ Displays logs with error details (`src/components/DiagnosticsPanel.tsx:56-68`)

**RequestId Visibility:**
- ✅ RequestIds logged to console (`src/lib/obs.ts:72-74`)
- ✅ RequestIds visible in DiagnosticsPanel (`src/components/DiagnosticsPanel.tsx:40-41,62`)
- ✅ RequestIds included in ValidationError (`src/validation/validators.ts:2-8`)
- ✅ RequestIds passed in API headers (`src/services/search.ts:31`, `src/recruiting/search.ts:35`)

**Status:** **PASS** - Well-implemented observability

---

## 6. Risk Assessment

### Top 3 Technical Risks

#### Risk 1: Debug Routes Accessible in Production
**Likelihood:** MEDIUM  
**Blast Radius:** MEDIUM  
**Evidence:**
- `/debug/build` and `/debug/discover-recruiting` routes accessible without guards (`src/routes/RootRouter.tsx:39-40,87-91`)
- Debug harness can generate 50 sequential or 20 concurrent requests (`src/pages/DebugDiscoverRecruiting.tsx:110-172`)
- Could cause:
  - Unauthorized load generation
  - API quota exhaustion
  - Performance degradation

**Mitigation:** Add `import.meta.env.PROD` check or authentication guard

---

#### Risk 2: Recruiting Explore Map Race Conditions
**Likelihood:** MEDIUM  
**Blast Radius:** LOW  
**Evidence:**
- Token-based cancellation only (`Recruiting.tsx:124,197,241,249`)
- No AbortController implementation
- No request version guard (unlike RecruitingFinder)
- Rapid map panning could cause:
  - Stale results displayed
  - Inconsistent UI state
  - Wasted API calls

**Mitigation:** Implement AbortController + request versioning pattern from RecruitingFinder

---

#### Risk 3: Discover Feature Missing AbortController
**Likelihood:** LOW  
**Blast Radius:** LOW  
**Evidence:**
- `usePlacesSearch` uses cancellation flag only (`usePlacesSearch.ts:53,203`)
- No AbortController for fetch cancellation
- Less critical than Explore Map (user-initiated search vs auto-search)

**Mitigation:** Add AbortController to match RecruitingFinder pattern

---

## Deliverables Summary

### Overall Status: **WARN**

### Blocking Issues
- None

### Non-Blocking Issues
1. **Debug routes accessible in production** (`src/routes/RootRouter.tsx:39-40,87-91`)
   - Risk: Unauthorized load generation, API quota exhaustion
   - Fix: Add production guard or authentication

2. **Recruiting Explore Map lacks race-safety patterns** (`src/components/Recruiting.tsx:196-258`)
   - Risk: Stale results, inconsistent UI during rapid interactions
   - Fix: Implement AbortController + request versioning

3. **Discover feature uses cancellation flag instead of AbortController** (`src/hooks/usePlacesSearch.ts:53,203`)
   - Risk: Less efficient cancellation, potential wasted requests
   - Fix: Add AbortController support

### Evidence References

**Deployment:**
- Build ID: `api/healthz.ts:3-13`, `vite.config.ts:34-42`
- Verification: `scripts/verify-build.mjs`, `scripts/verify-all-domains.mjs`

**Features:**
- Discover: `src/components/Discover.tsx`, `src/hooks/usePlacesSearch.ts`
- Recruiting Finder: `src/components/RecruitingFinder.tsx`, `src/recruiting/search.ts`
- Recruiting Explore: `src/components/Recruiting.tsx:109-563`

**APIs:**
- Google Maps: `src/lib/googleMapsLoader.ts`, `api/business/search.ts`
- Supabase: `src/lib/supabaseClient.ts`
- Validation: `src/validation/validators.ts`

**Observability:**
- Logging: `src/lib/obs.ts`
- Diagnostics: `src/components/DiagnosticsPanel.tsx`
- Debug routes: `src/routes/RootRouter.tsx:39-40,87-91`

---

## Executive Summary (Founder/Investor)

Athlete Ledger demonstrates production-ready engineering with request cancellation, error handling, response validation, and structured observability. The codebase shows evidence of careful attention to race conditions, API failures, and user experience during errors. However, **debug routes are accessible in production** without guards, which could allow unauthorized load generation. Additionally, the **Recruiting Explore Map** feature lacks the same race-safety patterns as other features, potentially causing inconsistent behavior during rapid user interactions. The product is **functional and ready for users**, but these non-blocking issues should be addressed to prevent potential performance degradation or quota exhaustion under load. Overall assessment: **WARN** - solid foundation with minor risks that can be mitigated quickly.
