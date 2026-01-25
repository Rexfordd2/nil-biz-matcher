# Auth Resilience Changes

## Summary
Made the app resilient to missing authentication by removing blocking auth calls and skipping network requests when no session exists.

## Removed/Modified Calls

### 1. **AppShell - Removed Blocking "Loading auth..."**
   - **File**: `src/App.tsx`
   - **Before**: Blocked rendering with "Loading auth..." message
   - **After**: Renders immediately, session loads in background
   - **Impact**: App no longer blocks on auth initialization

### 2. **SupabaseSessionContext - Skip getSession() if no session indicators**
   - **File**: `src/context/SupabaseSessionContext.tsx`
   - **Before**: Always called `supabase.auth.getSession()` on mount
   - **After**: Checks for session cookie/token indicators first, skips network call if none exist
   - **Impact**: No network requests for anonymous users

### 3. **AuthContext boot() - Skip getSession() if no session indicators**
   - **File**: `src/context/AuthContext.tsx`
   - **Before**: Always called `supabase.auth.getSession()` on mount
   - **After**: Checks for session cookie/token indicators first, skips network call if none exist
   - **Impact**: No network requests for anonymous users

### 4. **AuthContext refresh() - Skip getSession() if no session indicators**
   - **File**: `src/context/AuthContext.tsx`
   - **Before**: Always called `supabase.auth.getSession()` when refresh() was called
   - **After**: Checks for session cookie/token indicators first, skips network call if none exist
   - **Impact**: No network requests when refreshing without a session

### 5. **AppHome - Skip getUser() if no session indicators**
   - **File**: `src/components/AppHome.tsx`
   - **Before**: Always called `supabase.auth.getUser()` on mount
   - **After**: Checks for session cookie/token indicators first, skips network call if none exist
   - **Impact**: No network requests for anonymous users viewing AppHome

## Preserved Calls (Intentional)

These calls remain but are only made in specific contexts:

1. **savedBusinesses.ts** - `getUser()` called only when user explicitly saves a business
2. **Status.tsx** - `getSession()` called for status/debug page (intentional)
3. **ResetRoute.tsx** - `getSession()` called for password reset flow (intentional)
4. **authSupabase.ts** - `getSession()` used in debug health check (intentional)

## Final Behavior

### Anonymous Users
- ✅ App renders immediately without blocking
- ✅ No network requests to `/api/auth/*` endpoints
- ✅ No Supabase `getSession()` or `getUser()` calls
- ✅ Discover component works fully (searches, maps, place details)
- ✅ Recruiting component works fully (explore map, search)
- ✅ All features work except those requiring authentication (saving businesses, cloud sync)

### Authenticated Users
- ✅ Session detected via cookie/token indicators
- ✅ Network calls made only when session exists
- ✅ Full functionality including cloud sync

### Error Handling
- ✅ Network errors for missing sessions are silently handled
- ✅ No "Network error" messages shown for anonymous users
- ✅ Errors only shown for actual network/API failures

## Session Detection Logic

The app checks for Supabase session tokens in localStorage before making network calls:
- Supabase stores sessions in localStorage with keys like `sb-<project-ref>-auth-token`
- Detection: `Object.keys(localStorage).some(key => key.startsWith('sb-') && key.includes('auth-token'))`

If no session token exists, the network call is skipped entirely.
