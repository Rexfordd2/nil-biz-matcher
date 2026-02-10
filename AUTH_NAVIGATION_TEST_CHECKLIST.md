# Auth Navigation Manual Test Checklist

This document provides a comprehensive test plan for the centralized auth navigation system.

## Implementation Summary

**Files Created:**
- `src/lib/auth/navigation.ts` - Centralized auth navigation functions
- `src/components/AuthDebugPanel.tsx` - Debug panel visible with `?debug=1`

**Files Modified:**
- `src/context/AuthContext.tsx` - Uses `goToLogout()`
- `src/App.tsx` - Uses `goToLogin()` and `goToLogout()`, includes AuthDebugPanel
- `src/components/AppHome.tsx` - Uses `goToLogout()`
- `src/pages/Demo.tsx` - Uses `goToLogin()`, includes AuthDebugPanel
- `src/pages/Home.tsx` - Uses `goToLogin()`, includes AuthDebugPanel
- `src/pages/Waitlist.tsx` - Uses `goToLogin()`
- `src/components/AuthGate.tsx` - Uses `goToLogin()`
- `src/components/BetaWaitlistModal.tsx` - Uses `goToLogin()`
- `src/components/WaitlistForm.tsx` - Uses `goToLogin()`

## Auth Functions

### `goToLogin(returnTo?: string)`
- **Purpose**: Navigate to login page with optional return path
- **Default**: Uses current path if returnTo not specified
- **Behavior**: Always navigates to `/auth/login?returnTo=<path>`

### `goToLogout()`
- **Purpose**: Sign out and navigate to login page
- **Behavior**:
  1. Signs out from Supabase
  2. Clears localStorage (session tokens, profile drafts)
  3. Navigates to `/auth/login` (replace mode to prevent back button issues)

## Test Plan

### Part 1: Login CTAs - Test Each Entry Point

For each login button/link listed below:
1. Click the login CTA
2. Verify you land on `/auth/login?returnTo=<expected_path>`
3. Complete sign-in (use test credentials)
4. Verify you return to the expected path
5. Enable debug mode (`?debug=1`) and verify auth state is correct

#### Login CTAs to Test:

**Home Page (`/`)**
- [ ] Header "Log In" button (top-right)
  - Expected returnTo: `/app`
  - Test ID: `header-login-button`
- [ ] Hero "Log In" button (center CTA)
  - Expected returnTo: `/app`
  - Test ID: `login-button`
- [ ] Waitlist success "Log In" button
  - Expected returnTo: `/app`
  - Test ID: `home-waitlist-success-login`

**Demo Page (`/demo`)**
- [ ] Header "Sign In" button
  - Expected returnTo: `/app`
  - Test ID: `demo-header-login-button`

**App Shell (`/app`) - AuthGate**
- [ ] AuthGate "Log In" button (shown when not authenticated)
  - Expected returnTo: `/app` (current path)
  - Test ID: `auth-gate-login`

**App Header (when not logged in)**
- [ ] App header "Sign In" button
  - Expected returnTo: current path
  - Test ID: `app-header-login-button`

**Sidebar / Mobile Menu**
- [ ] Sidebar "Log In" item
  - Expected returnTo: current path
- [ ] Mobile menu "Log In" item
  - Expected returnTo: current path

**Beta Waitlist Modal**
- [ ] "Log In" button after joining waitlist
  - Expected returnTo: `/app`
  - Test ID: `beta-waitlist-success-login`

**Waitlist Page (`/waitlist`)**
- [ ] "Log In" button after joining
  - Expected returnTo: `/app`
  - Test ID: `waitlist-page-success-login`

**Waitlist Form Component**
- [ ] "Log In" button after joining
  - Expected returnTo: `/app`
  - Test ID: `waitlist-success-login`

### Part 2: Logout CTAs - Test Each Exit Point

For each logout button listed below:
1. Ensure you're logged in
2. Click the logout CTA
3. Verify you land on `/auth/login`
4. Verify browser back button does NOT return you to authenticated state
5. Verify localStorage is cleared (no session tokens, no profile drafts)
6. Attempt to sign in again - should work without issues

#### Logout CTAs to Test:

**App Header (when logged in)**
- [ ] User menu "Log out" button
  - Expected: Redirects to `/auth/login` (replace mode)

**App Settings Page**
- [ ] Settings "Log out" button
  - Expected: Redirects to `/auth/login` (replace mode)

**AppHome Component**
- [ ] "Logout" button
  - Expected: Redirects to `/auth/login` (replace mode)

**AuthContext (used throughout app)**
- [ ] Context logout function
  - Expected: Redirects to `/auth/login` (replace mode)

### Part 3: Debug Panel Tests

**Enable Debug Mode:**
Add `?debug=1` to any URL (e.g., `http://localhost:5173/?debug=1`)

**Debug Panel Tests:**
- [ ] Debug panel appears in bottom-right corner
  - Component: `AuthDebugPanel`
  - Test ID: `auth-debug-panel`

- [ ] Panel shows current state:
  - [ ] Current path (updates when navigating)
  - [ ] Session status (Yes/No)
  - [ ] User ID (when logged in)
  - [ ] Token presence (Present/Missing)

- [ ] Panel shows recent auth events:
  - [ ] SIGNED_IN event appears when logging in
  - [ ] SIGNED_OUT event appears when logging out
  - [ ] Events show timestamps
  - [ ] Events show user ID (when applicable)

- [ ] Panel actions work:
  - [ ] "Clear Events" button clears event list
  - [ ] "Reload Page" button refreshes the page
  - [ ] "Hide" button hides the panel

### Part 4: Edge Case Tests

**Test Scenarios:**

- [ ] **Login from unauthenticated state**
  1. Clear all cookies/localStorage
  2. Visit `/app`
  3. Verify AuthGate shows
  4. Click login → complete sign-in
  5. Verify return to `/app`

- [ ] **Login while already logged in**
  1. Already authenticated
  2. Click any login button
  3. Verify redirects to returnTo path (skips login page if session valid)

- [ ] **Logout and prevent back navigation**
  1. Log in and navigate to `/app`
  2. Log out
  3. Press browser back button
  4. Verify you stay on `/auth/login` (not `/app`)

- [ ] **Logout clears all state**
  1. Log in and save some data (athlete profile)
  2. Log out
  3. Log in as different user
  4. Verify previous user's data is NOT visible

- [ ] **Login returnTo preserves query params**
  1. Visit `/app?someParam=123`
  2. Not authenticated → redirects to login
  3. Complete login
  4. Verify returns to `/app?someParam=123` (preserves query)

- [ ] **Cross-page login flow**
  1. Start on Home page
  2. Click "Log In"
  3. Complete login
  4. Verify lands on `/app`
  5. Navigate to Demo
  6. Log out
  7. Click "Sign In" from Demo
  8. Verify returns to `/app` (not Demo)

### Part 5: Consistency Checks

**Verify ALL login CTAs:**
- [ ] Use same function: `goToLogin()`
- [ ] Have consistent styling: `className="red-glow"` or `variant="primary"`
- [ ] Are never disabled incorrectly
- [ ] Are never hidden behind overlays
- [ ] Always navigate (no preventDefault without continuation)

**Verify ALL logout CTAs:**
- [ ] Use same function: `goToLogout()`
- [ ] Clear all auth state
- [ ] Use replace navigation (not push)
- [ ] Clear localStorage tokens and drafts

## Debug Mode Quick Reference

**Enable Debug:**
```
?debug=1
```

**What Debug Panel Shows:**
- Current path
- Session status
- User ID (truncated)
- Token presence
- Recent auth events (last 5)

**Useful for:**
- Verifying auth state during testing
- Debugging login/logout issues
- Confirming localStorage is cleared

## Known Issues / Notes

1. **Browser Back Button**: After logout, the back button should NOT return to authenticated state. This is enforced by using `window.location.replace()` in `goToLogout()`.

2. **Session Token**: The debug panel checks for Supabase session tokens in localStorage (keys starting with `sb-` and containing `auth-token`).

3. **Return Path**: Login CTAs should specify the desired return path. If omitted, `goToLogin()` defaults to the current path.

4. **Mobile Menu**: The mobile menu login/logout buttons should behave identically to desktop counterparts.

## Success Criteria

All tests pass when:
- ✅ Every login CTA navigates to `/auth/login?returnTo=<path>`
- ✅ Every logout CTA clears state and redirects to `/auth/login`
- ✅ Back button after logout does NOT return to authenticated state
- ✅ Debug panel shows correct auth state when `?debug=1` is enabled
- ✅ No login CTA is disabled, hidden, or broken
- ✅ Auth state is immediately reflected in UI after login/logout
