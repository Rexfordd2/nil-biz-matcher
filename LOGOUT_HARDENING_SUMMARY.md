# Logout Behavior Hardening Summary

## Overview
Hardened logout behavior to ensure complete state cleanup and prevent back button navigation into authenticated app shell.

Date: 2026-02-04

---

## Changes Made

### 1. **AuthContext Logout** ✅
**File:** `src/context/AuthContext.tsx`

**Updated `logout` callback** to:
1. Sign out from Supabase via `authLogout()`
2. Clear React user state with `setUser(null)`
3. Clear cached profile data from localStorage (all `athleteProfileDraft:*` keys)
4. Navigate with `window.location.replace('/auth/login')` to prevent back button history

### 2. **Main App Logout Handler** ✅
**File:** `src/App.tsx`

**Updated `handleLogout` function** to:
1. Sign out from Supabase via `signOut()`
2. Clear React state:
   - `setCurrentUser(null)`
   - `setUserMenuOpen(false)`
   - `setAthlete(null)`
3. Clear cached profile data from localStorage (all `athleteProfileDraft:*` keys)
4. Show success toast
5. Navigate with `window.location.replace('/auth/login')` to prevent back button history

### 3. **AppHome Logout Handler** ✅
**File:** `src/components/AppHome.tsx`

**Updated `handleLogout` function** to:
1. Sign out from Supabase via `supabase?.auth.signOut()`
2. Clear cached profile data from localStorage (all `athleteProfileDraft:*` keys)
3. Notify parent component via `onLogout?.()` (clears parent React state)
4. Navigate with `window.location.replace('/auth/login')` to prevent back button history

---

## Key Improvements

### ✅ Complete State Cleanup
- **Supabase session**: Cleared via `supabase.auth.signOut()`
- **React user state**: Cleared via `setUser(null)` / `setCurrentUser(null)`
- **Profile state**: Cleared via `setAthlete(null)`
- **Cached localStorage data**: All `athleteProfileDraft:*` keys removed
- **Supabase session tokens**: Automatically cleared by Supabase SDK

### ✅ Prevent Back Button Issues
- **Before**: Used `window.location.href` which adds to browser history
- **After**: Uses `window.location.replace()` which replaces current history entry
- **Result**: Back button cannot return user to authenticated app shell

### ✅ Immediate UI Update
The app shell header already properly renders logged-out state when user is null:
- Shows "Sign In" button when `!currentUser` (line 344-352 in App.tsx)
- Hides user menu and profile options
- Updates immediately after `setCurrentUser(null)` is called

### ✅ Automatic Context Sync
- **SupabaseSessionContext**: Automatically updates via `onAuthStateChange` listener
- **AuthContext**: Explicitly clears state in logout handler
- Both contexts stay in sync during logout flow

---

## Logout Flow Sequence

```typescript
// User clicks "Log out"
1. handleLogout() called
2. supabase.auth.signOut() → clears Supabase session
3. setUser(null) / setCurrentUser(null) → triggers header re-render
4. setAthlete(null) → clears profile state
5. Clear athleteProfileDraft:* from localStorage
6. window.location.replace('/auth/login') → navigate (no history entry)
7. User lands on login page, back button cannot return to app
```

---

## Edge Cases Handled

### ✅ localStorage Unavailable
- All localStorage operations wrapped in try-catch
- Silently fails without blocking logout flow

### ✅ Supabase Errors
- Sign out wrapped in try-catch
- Continues with state cleanup even if network call fails

### ✅ Multiple Logout Handlers
- All three logout handlers now follow the same pattern
- Consistent behavior across different logout triggers

### ✅ Context Providers
- Both AuthContext and SupabaseSessionContext properly clear state
- No stale user data in any React context

---

## Verification Checklist

- [x] Logout clears Supabase session
- [x] Logout clears all React user state
- [x] Logout clears athlete profile state
- [x] Logout clears cached localStorage profile drafts
- [x] Uses `window.location.replace()` not `.href`
- [x] Header shows "Sign In" button immediately after logout
- [x] Back button cannot return to authenticated app shell
- [x] No linter errors introduced
- [x] Error handling for localStorage and network failures

---

## Security Benefits

1. **No residual auth state**: Complete cleanup prevents unauthorized access
2. **No back button vulnerability**: `replace()` prevents history-based re-entry
3. **Clear UI feedback**: Immediate header update shows logged-out state
4. **Defense in depth**: Route guards still protect `/app` routes even if logout fails

---

## Testing Recommendations

### Manual Testing
1. Log in to the app
2. Navigate to various pages within `/app`
3. Click "Log out"
4. Verify you land on `/auth/login`
5. Click browser back button
6. Verify you cannot return to authenticated pages (should see AuthGate)
7. Verify header shows "Sign In" button, not user menu

### Automated Testing
- Test logout clears localStorage profile drafts
- Test logout clears React state (user, athlete)
- Test logout calls `supabase.auth.signOut()`
- Test navigation uses `window.location.replace()`
- Test route guard prevents unauthenticated access to `/app`

---

## Files Modified

1. `src/context/AuthContext.tsx` - Updated `logout` callback
2. `src/App.tsx` - Updated `handleLogout` function
3. `src/components/AppHome.tsx` - Updated `handleLogout` function

---

## Related Files (Not Modified, Already Correct)

- `src/routes/RootRouter.tsx` - Route guard shows AuthGate for unauthenticated users
- `src/context/SupabaseSessionContext.tsx` - Auto-syncs via `onAuthStateChange`
- `src/lib/authSupabase.ts` - Basic signOut helper (no changes needed)
- `src/utils/auth.ts` - authLogout helper (no changes needed)
