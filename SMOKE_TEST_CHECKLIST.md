# Production Smoke Test Checklist

Quick verification checklist after deploying email/password auth to Vercel.

## Pre-Test Setup

- [ ] Deploy completed successfully
- [ ] Environment variables set in Vercel (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] Supabase Site URL configured: `https://your-app.vercel.app`

---

## 1. Health Check (/api/healthz)

```bash
curl https://your-app.vercel.app/api/healthz | jq
```

**✅ Expected Response:**
```json
{
  "buildId": "abc1234",
  "configPresence": {
    "hasViteSupabaseUrl": true,
    "hasViteSupabaseAnonKey": true
  },
  "supabase": {
    "configured": true,
    "connected": true,
    "error": null
  }
}
```

- [ ] `hasViteSupabaseUrl: true`
- [ ] `hasViteSupabaseAnonKey: true`
- [ ] `supabase.configured: true`
- [ ] `supabase.connected: true`
- [ ] No errors in response

---

## 2. Sign Up Flow

**URL:** `https://your-app.vercel.app/auth/signup`

1. [ ] Page loads without errors
2. [ ] Fill form:
   - Display name: `Test User ${Date.now()}`
   - Email: `test-${Date.now()}@example.com`
   - Password: `TestPass123!`
   - Role: Athlete
   - Terms: ✅
3. [ ] Click "Create my Athlete Ledger account"
4. [ ] No console errors
5. [ ] Signup succeeds
6. [ ] Redirected to `/app`
7. [ ] User name appears in header ("Test User...")
8. [ ] Account menu dropdown works

**Result:** ✅ PASS / ❌ FAIL

---

## 3. Protected Routes (Unauthenticated)

**Test in incognito/private window**

1. [ ] Visit `/app` → Redirects to `/auth/login?returnTo=/app`
2. [ ] Visit `/` → Loads without redirect
3. [ ] Visit `/demo` → Loads without redirect
4. [ ] Visit `/waitlist` → Loads without redirect
5. [ ] Visit `/auth/login` → Loads without redirect

**Result:** ✅ PASS / ❌ FAIL

---

## 4. Login Flow

1. [ ] Log out from authenticated session (Account → Log out)
2. [ ] Visit `/app` → Redirects to `/auth/login?returnTo=/app`
3. [ ] Enter credentials (from signup test)
4. [ ] Click "Log in"
5. [ ] Login succeeds
6. [ ] Redirected to `/app` (returnTo param)
7. [ ] User authenticated (name in header)

**Result:** ✅ PASS / ❌ FAIL

---

## 5. Password Reset Flow

1. [ ] Visit `/auth/login`
2. [ ] Click "Forgot password?"
3. [ ] Enter email from signup test
4. [ ] "Sending reset..." button shows
5. [ ] Check email inbox (may take 1-2 minutes)
6. [ ] Reset email received from Supabase
7. [ ] Click reset link in email
8. [ ] Redirected to `/auth/reset` with session token
9. [ ] Enter new password: `NewPass456!`
10. [ ] Confirm password: `NewPass456!`
11. [ ] Click "Save password"
12. [ ] Redirected to `/app`
13. [ ] User authenticated
14. [ ] Log out and log back in with **new password**
15. [ ] Login succeeds with new password

**Result:** ✅ PASS / ❌ FAIL

---

## 6. User Data Isolation

**Requires 2 test accounts**

### Setup User A
1. [ ] Create account A: `userA@example.com`
2. [ ] Log in as User A
3. [ ] Go to Discover tab
4. [ ] Search for "coffee Denver"
5. [ ] Save a business (click bookmark icon)
6. [ ] Verify business appears in saved list
7. [ ] Note business name: `_______________`
8. [ ] Log out

### Test User B
9. [ ] Create account B: `userB@example.com`
10. [ ] Log in as User B
11. [ ] Go to Discover tab
12. [ ] Check saved businesses
13. [ ] Verify User A's saved business **NOT visible**
14. [ ] Save a different business
15. [ ] Log out

### Verify User A
16. [ ] Log back in as User A
17. [ ] Check saved businesses
18. [ ] Verify only User A's business visible (not User B's)

**Result:** ✅ PASS / ❌ FAIL

---

## 7. Session Persistence

1. [ ] Log in
2. [ ] Verify authenticated (name in header)
3. [ ] Refresh page (F5)
4. [ ] Still authenticated (no redirect to login)
5. [ ] Close browser tab
6. [ ] Reopen tab to `/app`
7. [ ] Still authenticated (session persisted)
8. [ ] Wait 5 minutes
9. [ ] Refresh page
10. [ ] Still authenticated (session valid)

**Result:** ✅ PASS / ❌ FAIL

---

## 8. Browser Console Check

1. [ ] Open DevTools Console (F12)
2. [ ] Visit `/app` (authenticated)
3. [ ] No red errors in console
4. [ ] No auth-related warnings
5. [ ] Visit `/auth/login` (unauthenticated)
6. [ ] No errors in console

**Result:** ✅ PASS / ❌ FAIL

---

## 9. Network Tab Check

1. [ ] Open DevTools Network tab
2. [ ] Visit `/auth/login`
3. [ ] Enter credentials and submit
4. [ ] Check network requests:
   - [ ] POST to Supabase auth endpoint (2xx status)
   - [ ] No 401/403 errors
   - [ ] Cookies set correctly (sb-xxx-auth-token)
5. [ ] Visit `/app`
   - [ ] No auth errors
   - [ ] API calls include auth cookies

**Result:** ✅ PASS / ❌ FAIL

---

## 10. API Endpoint Security (Optional)

**Requires curl and auth token from DevTools**

```bash
# Get token from: DevTools → Application → Cookies → sb-xxx-auth-token

# Test authenticated request
curl -X GET https://your-app.vercel.app/api/healthz \
  -H "Cookie: sb-xxx-auth-token=YOUR_TOKEN_HERE"

# Test /api/recruiting/send without auth
curl -X POST https://your-app.vercel.app/api/recruiting/send \
  -H "Content-Type: application/json" \
  -d '{"athlete":{"fullName":"Test","email":"test@example.com"},"subject":"Test","body":"Test"}'
```

- [ ] Unauthenticated request returns 401
- [ ] Authenticated request with valid ownership succeeds or returns 503 (SMTP not configured)

**Result:** ✅ PASS / ❌ FAIL

---

## Overall Results

| Test | Status | Notes |
|------|--------|-------|
| 1. Health Check | ☐ | |
| 2. Sign Up | ☐ | |
| 3. Protected Routes | ☐ | |
| 4. Login | ☐ | |
| 5. Password Reset | ☐ | |
| 6. Data Isolation | ☐ | |
| 7. Session Persistence | ☐ | |
| 8. Console Check | ☐ | |
| 9. Network Check | ☐ | |
| 10. API Security | ☐ | |

**Final Status:** ✅ PASS / ⚠️ PARTIAL / ❌ FAIL

**Tested by:** _________________

**Date:** _________________

**Build ID:** _________________

**Notes:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## Troubleshooting Quick Reference

### "Supabase not configured" error
→ Check Vercel env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

### Login fails / "Invalid credentials"
→ Check Supabase Dashboard → Auth → Users (user exists? confirmed?)

### Redirect loop on /app
→ Check `/api/healthz` - `supabase.connected` should be `true`

### No email received (password reset)
→ Check Supabase Dashboard → Auth → Email Templates → Rate limiting

### Cross-user data visible
→ Check Supabase Dashboard → Database → Tables → RLS policies enabled

For full troubleshooting guide, see: `VERCEL_DEPLOYMENT_AUTH.md`
