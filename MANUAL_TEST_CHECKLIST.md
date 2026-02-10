# Manual Test Checklist - Auth Gate & Waitlist Flow

**Date**: 2026-02-02
**Scope**: Verify no dead ends, login always reachable, logout safe, waitlist success UX

---

## Test 1: User can always reach login from any page

### 1.1 From Home page (/)
- ✅ **PASS**: Header has "Log In" button (`data-testid="header-login-button"`) → `/auth/login`
- ✅ **PASS**: Hero section has "Log In" button (`data-testid="login-button"`) → `/auth/login`
- **Verified in**: `src/pages/Home.tsx` lines 108, 136

### 1.2 From Demo page (/demo)
- ✅ **PASS**: Header has "Save my progress" button that navigates to `/` then scrolls to waitlist (provides path to login)
- **Verified in**: `src/pages/Demo.tsx` lines 102-113

### 1.3 From /app while logged out
- ✅ **PASS**: Shows Auth Gate with "Log In" button (`data-testid="auth-gate-login"`) → `/auth/login?returnTo=/app`
- **Verified in**: `src/components/AuthGate.tsx` lines 24-29

### 1.4 From /auth/signup
- ✅ **PASS**: Has "Back to access gate" link (`data-testid="signup-back-to-gate"`) → `/app` (which shows Auth Gate with Login)
- ✅ **PASS**: Has "Back home" link (`data-testid="signup-back-home"`) → `/` (which has Login buttons)
- **Verified in**: `src/pages/auth/SignupRoute.tsx` lines 37-52

### 1.5 From /waitlist
- ✅ **PASS**: After joining, shows "Log In" button (`data-testid="waitlist-page-success-login"`) → `/auth/login?returnTo=/app`
- **Verified in**: `src/pages/Waitlist.tsx` lines 54-63

### 1.6 From Auth Gate (/app logged out)
- ✅ **PASS**: Primary "Log In" button with proper returnTo parameter
- **Verified in**: `src/components/AuthGate.tsx` lines 24-29

**Result: ✅ PASS** - Login is reachable from all tested pages

---

## Test 2: Logout never strands user

### 2.1 Logout from /app main view
- ✅ **PASS**: `handleLogout()` calls `navigate('/app', true)` after sign-out
- ✅ **PASS**: `/app` renders Auth Gate when not authenticated
- ✅ **PASS**: Auth Gate provides 4 clear navigation options (Login, Sign Up, Waitlist, Back Home)
- **Verified in**: 
  - `src/App.tsx` lines 251-259
  - `src/routes/RootRouter.tsx` lines 170-175

### 2.2 Logout from AppHome component
- ✅ **PASS**: `handleLogout()` calls `navigate('/app', true)` after sign-out
- ✅ **PASS**: Same Auth Gate appears with clear options
- **Verified in**: `src/components/AppHome.tsx` lines 87-92

### 2.3 Auth Gate provides multiple exits
- ✅ **PASS**: Login button available
- ✅ **PASS**: Sign Up button available
- ✅ **PASS**: Join Waitlist button available
- ✅ **PASS**: Back Home button available
- **Verified in**: `src/components/AuthGate.tsx` lines 24-58

**Result: ✅ PASS** - Logout always navigates to Auth Gate with clear options, no dead ends

---

## Test 3: /app always reachable after login

### 3.1 Login from Auth Gate
- ✅ **PASS**: Auth Gate Login button includes `returnTo=/app` parameter
- ✅ **PASS**: LoginSupabase component reads `returnTo` from query params (default `/app`)
- ✅ **PASS**: On success, navigates to `returnTo || '/app'`
- **Verified in**: 
  - `src/components/AuthGate.tsx` line 26
  - `src/pages/auth/LoginRoute.tsx` lines 16-21
  - `src/components/auth/LoginSupabase.tsx` lines 234-236

### 3.2 Login from Home page
- ✅ **PASS**: Home login buttons navigate to `/auth/login` (no returnTo = defaults to `/app`)
- **Verified in**: `src/pages/Home.tsx` lines 108, 136

### 3.3 Signup flow
- ✅ **PASS**: SignupRoute reads `returnTo` parameter (default `/app`)
- ✅ **PASS**: On successful signup, navigates to `returnTo || '/app'`
- **Verified in**: `src/pages/auth/SignupRoute.tsx` lines 16-21

### 3.4 Direct /app access when authenticated
- ✅ **PASS**: Router checks `if (!user && !initializing)` before showing Auth Gate
- ✅ **PASS**: If user exists, renders `<App />` component
- **Verified in**: `src/routes/RootRouter.tsx` lines 170-175

**Result: ✅ PASS** - /app is always reachable after successful login

---

## Test 4: Waitlist success always offers login

### 4.1 WaitlistForm success state
- ✅ **PASS**: Shows "You're on the list" message
- ✅ **PASS**: Login button present (`data-testid="waitlist-success-login"`) → `/auth/login?returnTo=/app`
- ✅ **PASS**: Back button present (context-aware: Demo or Home)
- **Verified in**: `src/components/WaitlistForm.tsx` lines 97-118

### 4.2 BetaWaitlistModal success state
- ✅ **PASS**: Shows "You're on the list" message
- ✅ **PASS**: Login button present (`data-testid="beta-waitlist-success-login"`) → `/auth/login?returnTo=/app`
- ✅ **PASS**: Back Home button present
- **Verified in**: `src/components/BetaWaitlistModal.tsx` lines 92-115

### 4.3 Home page waitlist success
- ✅ **PASS**: Shows "You're on the list" message
- ✅ **PASS**: Login button present (`data-testid="home-waitlist-success-login"`) → `/auth/login?returnTo=/app`
- ✅ **PASS**: Back to Demo button present
- **Verified in**: `src/pages/Home.tsx` lines 161-176

### 4.4 Waitlist page success state
- ✅ **PASS**: Shows "You're on the list" message
- ✅ **PASS**: Login button present (`data-testid="waitlist-page-success-login"`) → `/auth/login?returnTo=/app`
- ✅ **PASS**: Back button present (context-aware: Demo or Home)
- **Verified in**: `src/pages/Waitlist.tsx` lines 48-69

### 4.5 Persistence check
- ✅ **PASS**: All success states call `markWaitlistJoined()` to persist state
- ✅ **PASS**: Uses backwards-compatible localStorage keys
- **Verified in**: `src/lib/waitlistState.ts` lines 12-19

**Result: ✅ PASS** - All waitlist success states offer Login button with proper navigation

---

## Summary

| Requirement | Status | Notes |
|------------|--------|-------|
| User can always reach login from any page | ✅ PASS | Login accessible from all key pages via direct buttons or Auth Gate |
| Logout never strands user | ✅ PASS | Always navigates to Auth Gate with 4 clear options |
| /app always reachable after login | ✅ PASS | returnTo parameter properly handled, defaults to /app |
| Waitlist success always offers login | ✅ PASS | All 4 waitlist success states include Login button |

**Overall Result: ✅ ALL TESTS PASS**

---

## Additional Observations

### Strengths
1. **Consistent UX**: All waitlist success states use same message "You're on the list"
2. **No dead ends**: Every state provides multiple navigation options
3. **Context-aware**: Back buttons adapt to demo vs. full app mode
4. **Backwards compatible**: Legacy localStorage keys still supported
5. **Proper returnTo handling**: Login/signup preserve intended destination

### Code Quality
- All new components have proper data-testid attributes for testing
- Clean separation of concerns (waitlist state helper)
- Minimal diffs as requested
- No linter errors

### Test Coverage
- New dedicated test suite: `tests/auth-gate.spec.ts`
- Updated existing tests: `public-release.spec.ts`, `smoke.spec.ts`, `honeypot.spec.ts`
- All critical paths covered
