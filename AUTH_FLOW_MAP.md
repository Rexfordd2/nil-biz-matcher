# Authentication Flow Map

## Overview
This document describes the authentication routing and protection system for Athlete Ledger.

## Route Structure

### Public Routes (Always Accessible)
- `/` - Home page (landing)
- `/demo` - Demo page
- `/waitlist` - Waitlist signup page
- `/auth/login` - Login page
- `/auth/signup` - Signup page
- `/auth/reset` - Password reset page
- `/terms` - Terms of Service
- `/privacy` - Privacy Policy
- `/status` - Status page

### Protected Routes (Require Authentication)
- `/app/*` - Main application (all sub-routes)
- `/onboarding` - Onboarding flow (if authenticated)

## Authentication Guard Implementation

### Route Protection (`RootRouter.tsx`)
```typescript
case 'app':
  // Render app shell under /app/* - show AuthGate if not authenticated
  // If authenticated or still initializing, render the app
  if (!user && !initializing) {
    return <AuthGate returnTo={window.location.pathname} />
  }
  return <App />
```

**Behavior:**
- When user tries to access `/app/*` without being authenticated:
  - `AuthGate` component renders
  - Shows "Log In", "Sign Up", "Join Waitlist", and "Back Home" options
  - Passes current path as `returnTo` param for redirect after login

### Auth State Management (`AuthContext.tsx`)

**Initialization:**
1. Check localStorage for Supabase session token
2. If token exists, call `supabase.auth.getSession()`
3. If no token, skip network call (fast path)
4. Set `initializing: false` after session check completes

**State Sync:**
- Listens to `supabase.auth.onAuthStateChange()`
- Updates user state immediately when auth events occur:
  - `SIGNED_IN` - user logged in
  - `SIGNED_OUT` - user logged out
  - `TOKEN_REFRESHED` - session refreshed
  - `USER_UPDATED` - user metadata changed

**Emergency Fallback:**
- After 5 seconds, force `initializing: false` to prevent infinite loading states

## Login Flow

### User Journey: Not Logged In → Logged In

1. **User clicks "Sign In" or "Log In" button** (available in multiple locations)
   - Home page header
   - Demo page header
   - Waitlist page
   - App header (when logged out)
   - AuthGate component (when accessing /app while logged out)

2. **Navigate to `/auth/login`**
   - `returnTo` query param captures destination (default: `/app`)
   - Example: `/auth/login?returnTo=/app/discover`

3. **User enters credentials and submits**
   - `LoginSupabase` component calls `supabase.auth.signInWithPassword()`
   - On success, `onAuthStateChange` fires with `SIGNED_IN` event
   - `AuthContext` updates user state

4. **Redirect to destination**
   - Uses `returnTo` param from URL
   - Falls back to `/app` if no `returnTo` specified
   - Uses `navigate(returnTo, true)` for clean history

### Example Paths:
```
/app/discover (logged out) 
  → /auth/login?returnTo=/app/discover
  → (login success)
  → /app/discover (logged in)

/ (logged out, clicked "Get Started")
  → /app
  → (redirect via AuthGate)
  → /auth/login?returnTo=/app
  → (login success)
  → /app (logged in)
```

## Signup Flow

### User Journey: No Account → Account Created

1. **User clicks "Sign Up" button**
   - Home page
   - Login page ("Need an account?")
   - AuthGate component

2. **Navigate to `/auth/signup`**
   - `returnTo` query param captures destination (default: `/app`)

3. **User fills form and submits**
   - `SignUpSupabase` component calls `supabase.auth.signUp()`
   - Creates user account in Supabase Auth
   - Database trigger creates `athlete_profiles` row
   - On success, `onAuthStateChange` fires with `SIGNED_IN` event

4. **Redirect to destination**
   - Uses `returnTo` param from URL
   - Falls back to `/app`

## Logout Flow

### User Journey: Logged In → Logged Out

1. **User clicks "Log out" in user menu**

2. **Logout handler runs** (`App.tsx`)
   ```typescript
   async function handleLogout() {
     await signOut()
     setCurrentUser(null)
     setUserMenuOpen(false)
     show('Logged out successfully')
     window.location.href = '/auth/login'
   }
   ```

3. **Hard navigation to `/auth/login`**
   - Uses `window.location.href` to force full page reload
   - Clears all app state
   - Ensures clean auth context
   - Supabase session is cleared by `signOut()`

**Why hard navigation?**
- Guarantees all React state is cleared
- Prevents stale authenticated state in memory
- Simplifies logout edge cases
- User can log back in immediately from login page

## Access Gates

### AuthGate Component (`AuthGate.tsx`)

Renders when unauthenticated user tries to access `/app/*`:

```
┌─────────────────────────────────────┐
│  Welcome to Athlete Ledger         │
│                                     │
│  Sign in to access your full       │
│  account, or continue exploring.   │
│                                     │
│  [Log In]                          │
│  [Sign Up]                         │
│  [Join Waitlist]                   │
│  [Back Home]                       │
└─────────────────────────────────────┘
```

**Props:**
- `returnTo` - Path to redirect to after successful login/signup
- `mode` - 'home' | 'demo' (determines "Back" button destination)

### Beta Mode Guard (`App.tsx`)

In BETA mode, app component automatically redirects unauthenticated users:
```typescript
useEffect(() => {
  if (isBetaMode() && !loading && !user) {
    navigate('/auth/login', true)
  }
}, [user, loading])
```

## Sign In Button Locations

To ensure users are never trapped, "Sign In" / "Log In" buttons are placed strategically:

### Always Visible (Public Pages)
1. **Home page header** (`/`)
   - "Log In" button (red glow)
   - "Get Started" button → leads to `/app` → AuthGate if logged out

2. **Demo page header** (`/demo`)
   - "Sign In" button (red glow)
   - Visible when logged out

3. **Waitlist page** (`/waitlist`)
   - "Log In" button after joining waitlist
   - Success state shows login option

### Within App (When Logged Out)
4. **App header** (`/app` - when logged out)
   - "Sign In" button (red glow)
   - Displayed prominently in header

5. **AuthGate component**
   - "Log In" button (primary action)
   - "Sign Up" button (secondary)
   - Shown when accessing `/app/*` while logged out

6. **App sidebar** (desktop)
   - "Log In" and "Sign Up" nav items
   - Only shown when logged out

7. **App mobile menu**
   - "Log In" and "Sign Up" buttons
   - Only shown when logged out

## State Transitions

```
┌─────────────────────────────────────────────────────────┐
│                    LOGGED OUT STATE                      │
│                                                          │
│  Can Access:                                            │
│  - / (home)                                             │
│  - /demo                                                │
│  - /waitlist                                            │
│  - /auth/login                                          │
│  - /auth/signup                                         │
│  - /terms, /privacy, /status                           │
│                                                          │
│  Cannot Access:                                         │
│  - /app/* (shows AuthGate instead)                     │
└─────────────────────────────────────────────────────────┘
                            │
                            │ User logs in
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    LOGGED IN STATE                       │
│                                                          │
│  Can Access:                                            │
│  - Everything in LOGGED OUT                             │
│  - /app/* (all app routes)                             │
│  - /onboarding                                          │
│                                                          │
│  User Menu Shows:                                       │
│  - Profile                                              │
│  - Settings                                             │
│  - Log out                                              │
└─────────────────────────────────────────────────────────┘
                            │
                            │ User logs out
                            ▼
              Hard redirect to /auth/login
              (back to LOGGED OUT STATE)
```

## Edge Cases Handled

### 1. Refresh while on protected route
- `AuthContext` checks session on mount
- If no session: render `AuthGate` on `/app/*`
- User can log in and return to same page via `returnTo`

### 2. Direct navigation to `/app` when logged out
- `RootRouter` renders `AuthGate` component
- No redirect loop (gate renders in place)
- User has clear options to proceed

### 3. Logout while on protected route
- Hard navigate to `/auth/login`
- Full page reload clears state
- No stale data in React tree

### 4. Session expired
- `onAuthStateChange` fires `SIGNED_OUT` event
- User state cleared automatically
- Next protected route access shows `AuthGate`

### 5. Beta mode enforcement
- BETA mode redirects unauthenticated users to login
- Demo mode allows unauthenticated access to `/app`
- Controlled via `APP_MODE` environment variable

### 6. Slow auth initialization
- Emergency timer forces `initializing: false` after 5s
- Prevents infinite loading screens
- User sees auth state or gate UI

### 7. Multiple tabs
- Supabase session stored in localStorage
- Login in one tab updates other tabs via `onAuthStateChange`
- Logout in one tab clears session in all tabs

## Testing Checklist

See `AUTH_FLOW_TEST_CHECKLIST.md` for comprehensive manual testing steps.

## Configuration

### Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_APP_MODE` - 'DEMO' | 'BETA' (controls auth requirements)
- `PUBLIC_MODE` - When true, disables auth routes

### App Modes
- **DEMO**: Allows unauthenticated access to `/app`, shows waitlist CTAs
- **BETA**: Requires authentication for `/app`, shows waitlist modal

## File References

### Key Files
- `src/routes/RootRouter.tsx` - Route definitions and protection
- `src/context/AuthContext.tsx` - Auth state management
- `src/components/AuthGate.tsx` - Gate UI for protected routes
- `src/pages/auth/LoginRoute.tsx` - Login page wrapper
- `src/pages/auth/SignupRoute.tsx` - Signup page wrapper
- `src/components/auth/LoginSupabase.tsx` - Login form
- `src/components/auth/SignUpSupabase.tsx` - Signup form
- `src/lib/authSupabase.ts` - Auth API functions
- `src/App.tsx` - Main app shell (logout handler)
