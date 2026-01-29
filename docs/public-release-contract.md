# Public Release Contract

**Version:** 1.0  
**Purpose:** Enforceable requirements for deploying Athlete Ledger as a public, no-login-required release.

---

## Hosting Target

**Primary:** Vercel with serverless functions enabled

- API routes: `/api/waitlist`, `/api/healthz`, `/api/ping`, `/api/build-id`
- Serverless functions in `api/` directory
- Static assets served from `dist/`

**Static Fallback:** Compatible with static-only hosting (Netlify, GitHub Pages, etc.)

- Waitlist becomes graceful no-op without Supabase
- All client-side routes work via SPA fallback
- API routes return 404 (expected; app degrades gracefully)

---

## Required Environment Variables

### Minimal Viable Deployment

```bash
VITE_PUBLIC_MODE=true
```

This single variable enables:
- Build success without debug route protection errors
- Anonymous access to all public routes
- Graceful degradation when Supabase is not configured

### Recommended for Full Features

```bash
# Public mode (required)
VITE_PUBLIC_MODE=true

# Supabase (enables waitlist persistence, optional auth)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Server-side Supabase (for /api/waitlist, preferred over anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Optional Enhancements

```bash
# Google Maps (enables Discover Businesses feature)
VITE_GOOGLE_MAPS_API_KEY=AIza...

# Debug access (development/staging only)
VITE_DEBUG_KEY=your-secret-key
# OR
VITE_DIAGNOSTICS=true
```

---

## Routes That Must Work

All routes must load without crashes, redirects to login, or blank pages.

### Public Pages (6 routes)
- `/` - Landing page with waitlist form
- `/demo` - Marketing demo
- `/status` - System status page
- `/terms` - Terms of service
- `/privacy` - Privacy policy
- `/onboarding` - Onboarding flow (accessible without auth)

### App Routes (1 route pattern)
- `/app/*` - Main application (anonymous access supported)

### Auth Routes (3 routes, optional but must not crash)
- `/auth/login` - Login page (shows Supabase UI if configured; otherwise shows "Cloud login unavailable" with CTA to continue anonymously)
- `/auth/signup` - Signup page (shows Supabase UI if configured; otherwise shows "Cloud sign up unavailable" with CTA to continue anonymously)
- `/auth/reset` - Password reset page (allows password reset if Supabase configured and valid session; otherwise shows friendly unavailable message with CTA to app)

**Public mode behavior:** When `VITE_PUBLIC_MODE=true`, all auth routes include a "Continue without login" CTA, emphasizing that authentication is optional.

### Debug Routes (3 routes, deny-by-default)
- `/debug/build` - Build info (requires `VITE_DEBUG_KEY` or `VITE_DIAGNOSTICS`)
- `/debug/discover-recruiting` - Recruiting debug tools (protected)
- `/debug/places-hooks` - Places API debug tools (protected)

### API Routes (4 routes)
- `/api/waitlist` - Waitlist submission endpoint (POST)
- `/api/healthz` - Health check
- `/api/ping` - Ping endpoint
- `/api/build-id` - Build identifier

---

## Waitlist Strategy

**Implementation:** Self-hosted `/api/waitlist` serverless route (no external embed required)

**Storage Hierarchy:**
1. **Supabase** (preferred) - Persists to `public.waitlist` table when configured
2. **Graceful no-op** (default) - Accepts submissions, returns success, does not persist
3. **JSON file fallback** (dev only) - Set `WAITLIST_FALLBACK_STORAGE=true` for local testing

**Anti-Abuse Protections:**
- Honeypot field (hidden `input[name="website"]`)
- Client-side rate limiting
- Form submission timer (minimum 2 seconds)
- Duplicate email handling (returns success, no error)

**Response Format:**
```json
{ "ok": true, "status": "created" }           // New email added
{ "ok": true, "status": "already_registered" } // Duplicate (treated as success)
{ "ok": true, "status": "accepted_no_storage" } // Accepted but not persisted
{ "ok": false, "error": "Invalid email address" } // Validation error
```

---

## Acceptance Tests

**Test Suite:** `tests/public-release.spec.ts`

**Run Command:** `npm run test:public-release`

**8 Required Tests:**

1. **Public landing loads without login + has CTA + waitlist form**
   - Route `/` renders without auth
   - "Try Demo" and "Save my progress" CTAs visible
   - Waitlist form with email input and submit button present

2. **No route redirects to /login**
   - Public routes do not force authentication redirects
   - Each route renders usable content

3. **Auth routes exist but are not required**
   - `/auth/login` and `/auth/signup` render without crashing
   - Graceful "Supabase not configured" message when unavailable

4. **Waitlist submit works end-to-end**
   - Form accepts email input
   - Submission completes successfully
   - Duplicate submissions return success
   - Works with or without Supabase

5. **Waitlist form has protection features**
   - Honeypot field exists (hidden `input[name="website"]`)
   - Rate limiting prevents abuse
   - Form timer prevents instant submissions

6. **Debug routes are protected**
   - Without debug access, routes render landing page (not debug UI)
   - Debug content not exposed to public users

7. **All public pages load without Supabase**
   - Routes return 200 status
   - Pages render content (not blank/error)
   - Graceful degradation for auth-dependent features

8. **Anonymous user can use /app**
   - `/app` loads without redirect to login
   - Shows anonymous mode indicators
   - Features work with anonymous ID fallback

**Success Criteria:** All 8 tests pass = Ready for public release

---

## Build Requirements

### Production Build Command

**Recommended:**
```bash
npm run build:public
```

This automatically sets `VITE_PUBLIC_MODE=true` without manual flag.

**Manual (if needed):**
```bash
VITE_PUBLIC_MODE=true npm run build
```

### Build Must Succeed

Production builds require one of:
- `VITE_PUBLIC_MODE=true` (public release; debug routes deny-by-default)
- `VITE_DIAGNOSTICS=true` (enables all debug routes)
- `VITE_DEBUG_KEY=<secret>` (enables access via `?debugKey=<secret>` query param)

**Build will fail** if none of the above are set (to prevent accidental exposure of debug routes).

### Vercel Build

Vercel automatically uses `npm run vercel-build`, which runs:
1. `scripts/prepare-build-env.mjs` - Prepares environment
2. `tsc -b` - TypeScript compilation
3. `vite build` - Vite production build
4. `scripts/copy-demo-html.mjs` - Copies demo assets

**Note:** API functions in the root `api/` directory are automatically detected and deployed by Vercel as serverless functions

**Ensure** `VITE_PUBLIC_MODE=true` is set in Vercel environment variables or use `npm run build:public`.

---

## Validation Checklist

Before deploying to production:

- [ ] `npm run build:public` succeeds locally
- [ ] `npm run test:public-release` passes all 8 tests
- [ ] Landing page loads at `/` with waitlist form
- [ ] `/app` accessible without login redirect
- [ ] Waitlist submission works (check Supabase or logs)
- [ ] Debug routes protected (no access without key)
- [ ] Static assets load correctly (images, fonts, CSS)
- [ ] API routes respond (`/api/healthz` returns 200)

---

## Troubleshooting

### Build fails: "Debug routes must be protected"

**Solution:** Set `VITE_PUBLIC_MODE=true` before building:
```bash
npm run build:public
```

### Waitlist submissions not persisting

**Check:**
1. `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
2. `public.waitlist` table exists (run `supabase/waitlist.sql` migration)
3. `/api/waitlist` endpoint is deployed and accessible

**Fallback:** If Supabase is not configured, waitlist returns success without storage (expected behavior).

### Routes redirect to /login

**Check:**
1. `VITE_PUBLIC_MODE=true` is set during build
2. `src/routes/RootRouter.tsx` has no auth guards (should allow anonymous access)
3. Clear browser cache and rebuild

---

## Related Documentation

- [Public Release Acceptance Tests](./public-release-acceptance-tests.md) - Detailed test specifications
- [Vercel Access Handoff](./VERCEL_ACCESS_HANDOFF.md) - Deployment credentials and process
- [Production Readiness Changes](../PRODUCTION_READINESS_CHANGES.md) - Implementation details
- [Launch Status](../LAUNCH_STATUS.md) - Pre-launch checklist

---

**Contract Version:** 1.0  
**Last Updated:** 2026-01-28  
**Status:** ✅ Enforceable
