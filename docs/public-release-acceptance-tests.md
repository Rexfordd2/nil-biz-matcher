# Public Release Acceptance Tests

## Overview

This document describes the acceptance tests for the public release of Athlete Ledger. These tests validate that the application works correctly in a public, no-authentication-required mode.

## Test Suite Location

**File**: `tests/public-release.spec.ts`

## Running the Tests

### Run all acceptance tests
```bash
npm run test:public-release
```

### Run with UI (interactive mode)
```bash
npm run test:public-release:ui
```

### Run specific test
```bash
npx playwright test tests/public-release.spec.ts -g "Public landing loads"
```

## Test Coverage

### 1. Public Landing Loads Without Login + Has CTA + Waitlist Form

**What it tests**: The root route (`/`) renders correctly without authentication and displays all required public-facing elements.

**Validates**:
- Route: `/`
- Files: `src/routes/RootRouter.tsx`, `src/pages/Home.tsx`

**Expected behavior**:
- Page loads without requiring login
- "Try Demo" CTA button is visible
- "Save my progress" CTA button is visible
- Waitlist form section (`#waitlist-form`) is visible
- Email input field exists
- "Join Waitlist" submit button exists

---

### 2. No Route Redirects to /login

**What it tests**: Public routes remain accessible without forced authentication redirects.

**Validates**:
- Routes: `/app`, `/demo`, `/status`, `/terms`, `/privacy`, `/onboarding`, `/login`
- Files: `src/routes/RootRouter.tsx`, `src/context/AuthContext.tsx`

**Expected behavior**:
- Visiting any public route does NOT redirect to `/login` or `/auth/login`
- Each route renders usable content
- No redirect loops occur

---

### 3. Auth Routes Exist But Are Not Required

**What it tests**: Authentication routes work when Supabase is configured but degrade gracefully when it's not.

**Validates**:
- Routes: `/auth/login`, `/auth/signup`
- Files: `src/pages/auth/LoginRoute.tsx`, `src/pages/auth/SignupRoute.tsx`, `src/lib/supabaseClient.ts`

**Expected behavior**:
- Routes render without crashing
- When Supabase configured: Shows login/signup UI
- When Supabase NOT configured: Shows graceful "Supabase not configured" message
- No redirect loops or blank pages

---

### 4. Waitlist Submit Works End-to-End

**What it tests**: Waitlist form submission succeeds and handles duplicates correctly.

**Validates**:
- Route: `/` (waitlist form)
- Files: `src/pages/Home.tsx`, `src/lib/waitlist.ts`, `api/waitlist.ts`

**Expected behavior**:
- Form accepts email input
- Submission completes successfully (shows "You're in!" message)
- Re-submitting same email shows success (duplicate handling)
- Works with Supabase configured (persists to `public.waitlist` table)
- Works WITHOUT Supabase (persists to `/api/waitlist` fallback)

---

### 5. Waitlist Form Has Protection Features

**What it tests**: Waitlist form includes anti-abuse protections.

**Validates**:
- Files: `src/pages/Home.tsx`, `src/lib/waitlistProtection.ts`

**Expected behavior**:
- Honeypot field exists (hidden `input[name="website"]`)
- Rate limiting prevents excessive submissions
- Form timer prevents instant submissions (< 2 seconds)

---

### 6. Debug Routes Are Protected

**What it tests**: Debug routes require explicit access and don't expose sensitive information in production.

**Validates**:
- Routes: `/debug/build`, `/debug/discover-recruiting`, `/debug/places-hooks`
- Files: `src/routes/RootRouter.tsx`, `src/lib/debugAccess.ts`, `src/config/publicMode.ts`

**Expected behavior**:
- Without debug access (no `VITE_DIAGNOSTICS` or `?debugKey=...`), routes render landing page instead of debug UI
- Debug content is not exposed to public users
- Routes fall back gracefully (no crashes)

---

### 7. All Public Pages Load Without Supabase

**What it tests**: Application works in fully anonymous mode with no external dependencies.

**Validates**:
- Routes: `/`, `/app`, `/demo`, `/status`, `/terms`, `/privacy`
- Files: `src/lib/supabaseClient.ts`, all page components

**Expected behavior**:
- All routes return 200 status
- Pages render content (not blank/error)
- No crashes due to missing Supabase configuration
- Graceful degradation for features requiring authentication

---

### 8. Anonymous User Can Use /app

**What it tests**: Main application (`/app`) is accessible without authentication.

**Validates**:
- Route: `/app`
- Files: `src/routes/RootRouter.tsx`, `src/App.tsx`

**Expected behavior**:
- `/app` loads without redirect to login
- Shows anonymous mode indicators ("No login required", etc.)
- Application UI is functional
- Features work with anonymous ID fallback

---

### Build Safety Tests

**What they test**: Build configuration and API endpoints support public mode.

**Validates**:
- Files: `vite.config.ts`, `package.json`, `scripts/prepare-build-env.mjs`, `api/waitlist.ts`

**Expected behavior**:
- Build succeeds with `VITE_PUBLIC_MODE=true`
- `/api/waitlist` endpoint responds to POST requests
- No build-time errors when debug protection is disabled for public mode

---

## Environment Configurations for Testing

### Minimal Public Release (No Secrets)
```bash
VITE_PUBLIC_MODE=true
```
All tests should pass with only this variable set.

### With Supabase (Full Features)
```bash
VITE_PUBLIC_MODE=true
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
Enables full waitlist persistence to Supabase database.

### With Debug Access (Development)
```bash
VITE_PUBLIC_MODE=true
VITE_DIAGNOSTICS=true
# OR
VITE_DEBUG_KEY=your-secret-key
```
Enables debug routes for testing purposes.

---

## Manual Verification Steps

Some acceptance criteria require manual verification:

### Waitlist Persistence Verification

**With Supabase**:
1. Submit waitlist form with a test email
2. Log into Supabase dashboard
3. Navigate to Table Editor → `waitlist` table
4. Verify row exists with submitted email
5. Check that `anon_id` column is populated

**Without Supabase (Local)**:
1. Unset `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Submit waitlist form
3. Check for `waitlist.json` file in project root
4. Verify file contains submitted email

**Without Supabase (Vercel)**:
1. Deploy without Supabase env vars
2. Submit waitlist form
3. Check Vercel function logs for success
4. Re-submit same email and verify duplicate handling works

### Build Verification

**Production build with public mode**:
```bash
NODE_ENV=production VITE_PUBLIC_MODE=true npm run build
```
Expected: Build completes successfully, `dist/` directory created.

**Production build without public mode (should fail)**:
```bash
NODE_ENV=production npm run build
```
Expected: Build fails with debug routes protection error.

---

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Run Public Release Acceptance Tests
  run: npm run test:public-release
  env:
    VITE_PUBLIC_MODE: 'true'
```

For full testing with Supabase:

```yaml
- name: Run Public Release Acceptance Tests (Full)
  run: npm run test:public-release
  env:
    VITE_PUBLIC_MODE: 'true'
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

---

## Troubleshooting

### Test fails: "Waitlist form not found"
- Ensure dev server is running (`npm run dev`) or preview server (`npm run preview`)
- Check that `src/pages/Home.tsx` has `<section id="waitlist-form">`

### Test fails: "Debug routes show debug content"
- You may have `VITE_DIAGNOSTICS=true` or a `?debugKey=...` param set
- For production testing, ensure these are not set

### Test fails: "Page redirects to login"
- Check `src/routes/RootRouter.tsx` - should have no auth guards
- Check `src/context/AuthContext.tsx` - should not trigger navigation on null user

### Waitlist submission fails
- Check browser console for errors
- Verify `/api/waitlist` endpoint exists
- Ensure Supabase credentials are correct (if using Supabase)
- Check that `supabase/waitlist.sql` migration has been run

---

## Success Criteria

All tests pass = Application is ready for public release with:
- ✅ No authentication required for public access
- ✅ Waitlist capture functional
- ✅ Graceful degradation without secrets
- ✅ Debug routes protected
- ✅ Anonymous usage supported

---

## Related Documentation

- [Production Readiness Changes](../PRODUCTION_READINESS_CHANGES.md)
- [Production Proof](../PRODUCTION_PROOF.md)
- [Launch Status](../LAUNCH_STATUS.md)
- [Vercel Access Handoff](./VERCEL_ACCESS_HANDOFF.md)
