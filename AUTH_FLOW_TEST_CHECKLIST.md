# Authentication Flow - Manual Test Checklist

## Overview
This checklist ensures that users are never trapped in the application and can always access authentication when needed.

## Pre-Test Setup

### Test Accounts Needed
- [ ] Valid test account (email + password)
- [ ] Fresh browser session (cleared cookies/localStorage)

### Test Environments
- [ ] Local development (`http://localhost:5173`)
- [ ] Staging/Preview deployment
- [ ] Production (if applicable)

### Browser Testing
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (desktop)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## Test Suite 1: Logged Out → Can Reach Login

### 1.1 From Home Page
- [ ] Navigate to `/`
- [ ] Verify "Log In" button visible in header (red glow)
- [ ] Click "Log In" button
- [ ] Verify redirected to `/auth/login`
- [ ] Verify no `returnTo` param (or defaults to `/app`)

### 1.2 From Demo Page
- [ ] Navigate to `/demo`
- [ ] Verify "Sign In" button visible in header (red glow)
- [ ] Click "Sign In" button
- [ ] Verify redirected to `/auth/login`
- [ ] Verify no `returnTo` param

### 1.3 From Waitlist Page
- [ ] Navigate to `/waitlist`
- [ ] Fill and submit waitlist form (if applicable)
- [ ] Verify "Log In" button appears in success state
- [ ] Click "Log In" button
- [ ] Verify redirected to `/auth/login?returnTo=/app`

### 1.4 From Protected Route (Direct Access)
- [ ] Navigate directly to `/app` while logged out
- [ ] Verify `AuthGate` component renders (not redirect loop)
- [ ] Verify "Log In" button visible
- [ ] Click "Log In" button
- [ ] Verify redirected to `/auth/login?returnTo=/app`

### 1.5 From Protected Subroute
- [ ] Navigate directly to `/app/discover` while logged out
- [ ] Verify `AuthGate` component renders
- [ ] Verify "Log In" button visible
- [ ] Click "Log In" button
- [ ] Verify redirected to `/auth/login?returnTo=/app/discover`

### 1.6 From App Header (Logged Out)
- [ ] Navigate to `/app` while logged out
- [ ] Verify "Sign In" button visible in app header
- [ ] Click "Sign In" button
- [ ] Verify redirected to `/auth/login`

### 1.7 From Login Page Itself
- [ ] Navigate to `/auth/login`
- [ ] Verify login form renders
- [ ] Verify "Need an account? Sign up" link visible
- [ ] Click signup link
- [ ] Verify redirected to `/auth/signup`
- [ ] Navigate back to `/auth/login`
- [ ] Verify "Back to access gate" and "Back home" links visible

---

## Test Suite 2: Login → Can Reach App

### 2.1 Basic Login Flow
- [ ] Start logged out
- [ ] Navigate to `/auth/login`
- [ ] Enter valid email and password
- [ ] Click "Log in" button
- [ ] Verify "Logging in…" text appears
- [ ] Wait for login to complete
- [ ] Verify redirected to `/app` (or `returnTo` destination)
- [ ] Verify user menu shows user name (not "Sign In")

### 2.2 Login with returnTo Parameter
- [ ] Start logged out
- [ ] Navigate to `/auth/login?returnTo=/app/discover`
- [ ] Enter credentials and log in
- [ ] Verify redirected to `/app/discover` (not just `/app`)

### 2.3 Login from AuthGate
- [ ] Start logged out
- [ ] Navigate to `/app/recruiting`
- [ ] Verify `AuthGate` renders
- [ ] Click "Log In" button
- [ ] Verify on `/auth/login?returnTo=/app/recruiting`
- [ ] Enter credentials and log in
- [ ] Verify redirected back to `/app/recruiting`
- [ ] Verify recruiting content loads (not AuthGate)

### 2.4 Login Error Handling
- [ ] Navigate to `/auth/login`
- [ ] Enter invalid credentials
- [ ] Click "Log in"
- [ ] Verify error message displays
- [ ] Verify still on login page (not trapped)
- [ ] Verify "Back home" link works

### 2.5 Signup Flow
- [ ] Start logged out
- [ ] Navigate to `/auth/signup`
- [ ] Fill signup form with new email
- [ ] Accept terms checkbox
- [ ] Click "Create my Athlete Ledger account"
- [ ] Wait for signup to complete
- [ ] Verify redirected to `/app` (or `returnTo` destination)
- [ ] Verify logged in (user menu shows name)

### 2.6 App Access After Login
- [ ] After logging in, verify access to:
  - [ ] `/app` - Main app shell
  - [ ] `/app/discover` - Discover page
  - [ ] `/app/recruiting` - Recruiting page
  - [ ] Profile tab
  - [ ] Settings tab
- [ ] Verify no AuthGate appears on any `/app/*` routes

---

## Test Suite 3: Logout → Redirected to Login

### 3.1 Basic Logout Flow
- [ ] Start logged in
- [ ] Navigate to `/app`
- [ ] Click user menu (shows user name)
- [ ] Click "Log out" option
- [ ] Verify toast message "Logged out successfully"
- [ ] Verify hard redirect to `/auth/login`
- [ ] Verify URL is `/auth/login` (not `/app`)
- [ ] Verify user menu gone (shows "Sign In" in public pages)

### 3.2 Logout from Subroute
- [ ] Start logged in on `/app/discover`
- [ ] Click user menu → "Log out"
- [ ] Verify redirected to `/auth/login` (not back to `/app/discover`)

### 3.3 Post-Logout State
- [ ] After logging out:
  - [ ] Navigate to `/` - Verify "Log In" button visible
  - [ ] Navigate to `/demo` - Verify "Sign In" button visible
  - [ ] Navigate to `/app` - Verify `AuthGate` renders (not stuck)
  - [ ] Verify can log back in immediately

### 3.4 Logout Clears Session
- [ ] Log in
- [ ] Open browser dev tools → Application → Local Storage
- [ ] Note Supabase session token present
- [ ] Log out
- [ ] Verify session token cleared from localStorage
- [ ] Navigate to `/app` - Verify AuthGate shows (not logged in)

---

## Test Suite 4: Refresh While Logged Out on /app

### 4.1 Refresh on /app
- [ ] Start logged out
- [ ] Navigate to `/app`
- [ ] Verify `AuthGate` renders
- [ ] Press F5 (hard refresh)
- [ ] Verify `AuthGate` still renders (not redirect loop)
- [ ] Verify "Log In" button still visible and functional

### 4.2 Refresh on /app Subroute
- [ ] Start logged out
- [ ] Navigate to `/app/discover`
- [ ] Verify `AuthGate` renders
- [ ] Press F5 (hard refresh)
- [ ] Verify `AuthGate` still renders at `/app/discover`
- [ ] Click "Log In"
- [ ] Verify `returnTo=/app/discover` in URL

### 4.3 Browser Back/Forward
- [ ] Start logged out
- [ ] Navigate `/` → `/app` → `/auth/login`
- [ ] Press browser back button
- [ ] Verify `AuthGate` renders (no broken state)
- [ ] Press browser forward button
- [ ] Verify login page renders

---

## Test Suite 5: Beta Gate Page → Can Sign In

### 5.1 Waitlist Page Login Access
- [ ] Navigate to `/waitlist`
- [ ] Verify page renders without auth requirement
- [ ] Verify "Sign In" or "Log In" link/button visible
- [ ] Click login link
- [ ] Verify redirected to `/auth/login`

### 5.2 Waitlist Success State
- [ ] Navigate to `/waitlist`
- [ ] Submit email to waitlist (or click "I already joined")
- [ ] Verify success message "You're on the list"
- [ ] Verify "Log In" button visible (red glow)
- [ ] Click "Log In"
- [ ] Verify redirected to `/auth/login?returnTo=/app`

### 5.3 Beta Modal (if BETA mode)
- [ ] If `VITE_APP_MODE=BETA`:
  - [ ] Navigate to `/app` while logged in
  - [ ] Click "Join Waitlist" in header or modal
  - [ ] Submit to waitlist
  - [ ] Verify still logged in (not forced to log out)
  - [ ] Close modal
  - [ ] Verify can continue using app

---

## Test Suite 6: Auth State Sync

### 6.1 Multiple Tabs - Login
- [ ] Open Tab 1: Navigate to `/`
- [ ] Open Tab 2: Navigate to `/app` (shows AuthGate)
- [ ] In Tab 1: Log in via `/auth/login`
- [ ] In Tab 2: Navigate to any page or refresh
- [ ] Verify Tab 2 now shows logged in state

### 6.2 Multiple Tabs - Logout
- [ ] Open Tab 1: Logged in on `/app`
- [ ] Open Tab 2: Logged in on `/app/discover`
- [ ] In Tab 1: Log out
- [ ] In Tab 2: Navigate to any `/app/*` route or refresh
- [ ] Verify Tab 2 shows `AuthGate` (logged out)

### 6.3 Auth State After Refresh (Logged In)
- [ ] Log in
- [ ] Navigate to `/app/recruiting`
- [ ] Press F5 (hard refresh)
- [ ] Verify still logged in
- [ ] Verify recruiting content loads (not AuthGate)

### 6.4 Session Expiry
- [ ] Log in
- [ ] Open browser dev tools → Application → Local Storage
- [ ] Delete Supabase session token (key like `sb-*-auth-token`)
- [ ] Navigate to `/app`
- [ ] Verify `AuthGate` renders (session expired handled)

---

## Test Suite 7: Edge Cases

### 7.1 Direct URL Navigation
- [ ] While logged out, type `/app` in address bar and press Enter
- [ ] Verify `AuthGate` renders (not white screen or error)
- [ ] Type `/app/discover` and press Enter
- [ ] Verify `AuthGate` renders with correct `returnTo`

### 7.2 Malformed returnTo Parameter
- [ ] Navigate to `/auth/login?returnTo=javascript:alert(1)`
- [ ] Log in
- [ ] Verify redirected to `/app` (malicious redirect prevented)

### 7.3 Very Long returnTo Path
- [ ] Navigate to `/auth/login?returnTo=/app/discover?search=test&filter=active&page=2`
- [ ] Log in
- [ ] Verify redirected to full path with query params intact

### 7.4 Signup → Login Switch
- [ ] Navigate to `/auth/signup`
- [ ] Verify "Need an account?" link on login page
- [ ] Navigate to `/auth/login`
- [ ] Verify "Need an account? Sign up" link
- [ ] Click signup link → verify on `/auth/signup`
- [ ] Click "Back to access gate" → verify on `/app` with AuthGate

### 7.5 App Mode Switching
- [ ] In DEMO mode:
  - [ ] Navigate to `/app` logged out
  - [ ] Verify `AuthGate` shows with "Join Waitlist" option
  - [ ] Verify "Save my progress" CTA visible in demo pages
- [ ] In BETA mode (if testable):
  - [ ] Navigate to `/app` logged out
  - [ ] Verify redirected to `/auth/login`

### 7.6 Network Failures
- [ ] Open dev tools → Network tab → Enable "Offline"
- [ ] Try to log in
- [ ] Verify error message (not infinite loading)
- [ ] Verify "Back home" link still functional
- [ ] Re-enable network
- [ ] Verify can retry login

### 7.7 Slow Auth Response
- [ ] Open dev tools → Network tab → Throttle to "Slow 3G"
- [ ] Try to log in
- [ ] Verify "Logging in…" text shows
- [ ] Wait for response
- [ ] Verify either success or error (not stuck in loading state)

---

## Test Suite 8: Mobile Specific

### 8.1 Mobile Header Access
- [ ] On mobile viewport (≤768px)
- [ ] Navigate to `/` logged out
- [ ] Verify "Log In" button visible in header (may be smaller)
- [ ] Click it → verify redirected to `/auth/login`

### 8.2 Mobile Navigation Menu
- [ ] On mobile, navigate to `/app` logged out
- [ ] Tap "More" button in bottom nav (if visible)
- [ ] Verify "Log In" and "Sign Up" options visible
- [ ] Tap "Log In" → verify redirected to `/auth/login`

### 8.3 Mobile Keyboard Handling
- [ ] On mobile, navigate to `/auth/login`
- [ ] Tap email input → verify keyboard appears
- [ ] Fill form
- [ ] Tap "Log in" button
- [ ] Verify login works (keyboard doesn't block button)

---

## Test Suite 9: Accessibility

### 9.1 Keyboard Navigation
- [ ] Navigate to `/auth/login` using only keyboard (Tab key)
- [ ] Verify can focus email input
- [ ] Verify can focus password input
- [ ] Verify can focus "Log in" button
- [ ] Verify can activate button with Enter/Space

### 9.2 Screen Reader
- [ ] Enable screen reader (NVDA/JAWS/VoiceOver)
- [ ] Navigate to `/app` logged out
- [ ] Verify `AuthGate` content announced
- [ ] Verify "Log In" button announced as button
- [ ] Navigate to `/auth/login`
- [ ] Verify form labels announced

### 9.3 Focus Management
- [ ] Navigate to `/auth/login`
- [ ] Log in successfully
- [ ] Verify focus moved to main app content (not lost)

---

## Test Suite 10: Performance

### 10.1 Auth Initialization Speed
- [ ] Clear localStorage
- [ ] Navigate to `/` (fresh session, logged out)
- [ ] Measure time until "Log In" button visible
- [ ] Target: < 500ms

### 10.2 Login Redirect Speed
- [ ] Navigate to `/auth/login`
- [ ] Enter credentials and submit
- [ ] Measure time from submit click to `/app` content visible
- [ ] Target: < 2s on normal connection

### 10.3 Logout Redirect Speed
- [ ] While logged in, click "Log out"
- [ ] Measure time until `/auth/login` page visible
- [ ] Target: < 1s (hard navigation)

---

## Test Results Template

### Test Run Information
- **Date:** _________________
- **Tester:** _________________
- **Environment:** Local / Staging / Production
- **Browser:** _________________
- **OS:** _________________

### Results Summary
- **Total Tests:** _________________
- **Passed:** _________________
- **Failed:** _________________
- **Blocked:** _________________

### Failed Tests
List any failed tests with details:

1. **Test ID:** _________________  
   **Expected:** _________________  
   **Actual:** _________________  
   **Notes:** _________________

---

## Critical Path (Smoke Test)

For quick validation, run these critical tests:

- [ ] **C1:** Logged out → Navigate to `/app` → AuthGate renders with "Log In" button
- [ ] **C2:** Click "Log In" → Redirected to `/auth/login?returnTo=/app`
- [ ] **C3:** Enter valid credentials → Log in → Redirected to `/app` logged in
- [ ] **C4:** Click user menu → "Log out" → Redirected to `/auth/login`
- [ ] **C5:** Navigate to `/app` → AuthGate renders (logged out state confirmed)

**If all 5 critical tests pass, core auth flow is functional.**

---

## Automated Test Scenarios

These scenarios can be converted to Playwright tests:

```typescript
// Example: Test logged out user can reach login from /app
test('logged out user sees AuthGate with login button on /app', async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('auth-gate-login')).toBeVisible()
  await page.click('[data-testid="auth-gate-login"]')
  await expect(page).toHaveURL(/\/auth\/login\?returnTo=%2Fapp/)
})

// Example: Test logout redirects to login
test('logout redirects to login page', async ({ page }) => {
  // Assume user is logged in
  await page.goto('/app')
  await page.click('[data-testid="user-menu-button"]')
  await page.click('text=Log out')
  await expect(page).toHaveURL('/auth/login')
})
```

---

## Notes & Tips

### Common Issues
- **Infinite redirect loop:** Check that public routes don't have auth guards
- **Session not persisting:** Verify Supabase localStorage keys present
- **AuthGate not rendering:** Check `initializing` flag in AuthContext
- **returnTo not working:** Verify URL encoding for query params

### Debugging Tools
- **React DevTools:** Check AuthContext state
- **Browser DevTools → Application:** Check localStorage for Supabase session
- **Network Tab:** Monitor auth API calls
- **Console:** Look for `[auth]` debug logs (in dev mode)

### Test Data Cleanup
After testing, clean up:
- [ ] Delete test accounts from Supabase Auth
- [ ] Clear test data from `athlete_profiles` table
- [ ] Clear test data from `waitlist` table (if applicable)
