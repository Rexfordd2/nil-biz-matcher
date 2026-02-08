# Auth Navigation Quick Reference

## For Developers: How to Use the Centralized Auth System

### Login Button

**When adding a login button anywhere in the app:**

```tsx
import { goToLogin } from '../lib/auth/navigation'

// In your component:
<Button onClick={() => goToLogin()}>
  Log In
</Button>

// Or with explicit return path:
<Button onClick={() => goToLogin('/app')}>
  Log In
</Button>
```

**Do NOT:**
```tsx
// ❌ Don't do this:
<Button onClick={() => navigate('/auth/login')}>Log In</Button>

// ❌ Don't do this:
<Button onClick={() => window.location.href = '/auth/login'}>Log In</Button>

// ❌ Don't do this:
<Button onClick={() => navigate(`/auth/login?returnTo=${returnTo}`)}>Log In</Button>
```

### Logout Button

**When adding a logout button anywhere in the app:**

```tsx
import { goToLogout } from '../lib/auth/navigation'

// In your component:
<Button onClick={() => goToLogout()}>
  Log Out
</Button>

// Or with async/await:
async function handleLogout() {
  await goToLogout()
  // Optional: additional cleanup here
}

<Button onClick={handleLogout}>
  Log Out
</Button>
```

**Do NOT:**
```tsx
// ❌ Don't do this:
<Button onClick={() => {
  signOut()
  setUser(null)
  navigate('/auth/login')
}}>Log Out</Button>

// ❌ Don't do this:
<Button onClick={async () => {
  await supabase.auth.signOut()
  window.location.replace('/auth/login')
}}>Log Out</Button>
```

### Debug Mode

**Enable debug panel during development:**

```
http://localhost:5173/?debug=1
```

**What it shows:**
- Current path
- Session status
- User ID
- Token presence
- Recent auth events

**When to use:**
- Testing login/logout flows
- Debugging session issues
- Verifying localStorage cleanup
- Checking auth state changes

### Import Paths

```tsx
// For login/logout functions:
import { goToLogin, goToLogout } from '../lib/auth/navigation'

// For debug panel:
import AuthDebugPanel from '../components/AuthDebugPanel'
```

### Common Patterns

#### Pattern 1: Login from Home/Demo
```tsx
import { goToLogin } from '../lib/auth/navigation'

<Button onClick={() => goToLogin('/app')}>
  Sign In
</Button>
```

#### Pattern 2: Login from AuthGate
```tsx
import { goToLogin } from '../lib/auth/navigation'

function AuthGate({ returnTo = '/app' }) {
  return (
    <Button onClick={() => goToLogin(returnTo)}>
      Log In
    </Button>
  )
}
```

#### Pattern 3: Logout from App Shell
```tsx
import { goToLogout } from '../lib/auth/navigation'

function UserMenu() {
  return (
    <button onClick={() => goToLogout()}>
      Log out
    </button>
  )
}
```

#### Pattern 4: Logout from Context
```tsx
import { goToLogout } from '../lib/auth/navigation'

const logout = useCallback(async () => {
  await goToLogout()
}, [])
```

### TypeScript Signatures

```typescript
/**
 * Navigate to login page with optional return path
 * @param returnTo - Path to return to after login (defaults to current path)
 */
function goToLogin(returnTo?: string): void

/**
 * Log out and navigate to login page
 * Clears all auth state and localStorage
 */
function goToLogout(): Promise<void>
```

### Best Practices

1. **Always use goToLogin()**
   - ✅ Ensures consistent behavior
   - ✅ Handles returnTo automatically
   - ✅ Proper URL encoding

2. **Always use goToLogout()**
   - ✅ Clears all auth state
   - ✅ Cleans localStorage
   - ✅ Uses replace navigation (prevents back button issues)

3. **Test with debug mode**
   - ✅ Add `?debug=1` to URL during development
   - ✅ Verify auth events appear in debug panel
   - ✅ Check session status and token presence

4. **Don't duplicate auth logic**
   - ❌ Never manually clear localStorage
   - ❌ Never manually call `supabase.auth.signOut()` directly
   - ❌ Never manually navigate to `/auth/login`

### Migration Checklist

If you find old auth code:
- [ ] Replace `navigate('/auth/login')` with `goToLogin()`
- [ ] Replace custom logout logic with `goToLogout()`
- [ ] Remove duplicate localStorage cleanup
- [ ] Remove manual session token clearing
- [ ] Add import for auth navigation functions
- [ ] Test with `?debug=1` to verify

### Common Issues

**Issue: Login button not working**
- Check import path: `import { goToLogin } from '../lib/auth/navigation'`
- Check function call: `onClick={() => goToLogin()}`
- Test with `?debug=1` to see auth events

**Issue: Logout button not clearing state**
- Use `goToLogout()` instead of custom logic
- Verify localStorage is cleared (check debug panel)
- Ensure using replace navigation (not push)

**Issue: Back button returns to authenticated state**
- Verify using `goToLogout()` (not custom logout)
- Check that `window.location.replace()` is used (not `navigate()`)
- Test manually: logout → press back → should stay on login

**Issue: Debug panel not showing**
- Add `?debug=1` to URL
- Verify `<AuthDebugPanel />` is in component tree
- Check browser console for errors

### Testing Your Changes

```bash
# 1. Start dev server
npm run dev

# 2. Visit with debug mode
# http://localhost:5173/?debug=1

# 3. Test login flow
# Click login → complete sign-in → verify return path

# 4. Test logout flow
# Click logout → verify redirect → press back button → verify stays on login

# 5. Check debug panel
# Verify session status, user ID, auth events
```

### Files Reference

**Core Files:**
- `src/lib/auth/navigation.ts` - Auth navigation functions
- `src/components/AuthDebugPanel.tsx` - Debug panel component

**Documentation:**
- `AUTH_NAVIGATION_IMPLEMENTATION_SUMMARY.md` - Full implementation details
- `AUTH_NAVIGATION_TEST_CHECKLIST.md` - Comprehensive test plan
- `AUTH_NAVIGATION_QUICK_REFERENCE.md` - This file

### Support

If you encounter issues:
1. Check implementation summary for context
2. Review test checklist for edge cases
3. Enable debug mode (`?debug=1`) to inspect auth state
4. Verify imports and function signatures
5. Test manually with debug panel visible
