# Supabase Authentication URL Configuration

This guide explains how to configure Supabase Auth URL settings for production deployments.

## Why This Matters

Supabase requires proper URL configuration to allow authentication redirects. Without correct settings, login attempts may fail or redirect incorrectly, especially in production environments.

## Configuration Steps

### 1. Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**

### 2. Configure Site URL (Production)

Set the **Site URL** to your production domain:

```
https://athlete-ledger.vercel.app
```

### 3. Configure Redirect URLs (Production)

Add the following URLs to the **Redirect URLs** list (one per line):

```
https://athlete-ledger.vercel.app/*
https://athlete-ledger.vercel.app/auth/*
https://athlete-ledger.vercel.app/app*
```

**Important:** The wildcard patterns (`*`) allow all paths under those base paths to work correctly.

### 4. Add Preview Deployment URLs (Optional but Recommended)

If you use Vercel preview deployments for testing, add your preview domain pattern:

```
https://athlete-ledger-*.vercel.app/*
https://athlete-ledger-*.vercel.app/auth/*
https://athlete-ledger-*.vercel.app/app*
```

Or if you have a specific preview domain pattern, add it accordingly.

### 5. Save Configuration

Click **Save** to apply the changes.

### 6. Redeploy Your Application

After updating Supabase configuration:

1. Go to your Vercel dashboard
2. Navigate to your project → **Deployments**
3. Click **Redeploy** on the latest deployment
4. Optionally toggle **"Clear build cache"** to eliminate caching confusion
5. Confirm the redeploy

## Verification

After redeploying, test the login flow:

1. Navigate to your production site: `https://athlete-ledger.vercel.app`
2. Attempt to log in with valid credentials
3. Verify that authentication completes successfully
4. Check that redirects work correctly (e.g., after login, you should be redirected to `/app`)

## Troubleshooting

### Login Still Fails After Configuration

1. **Verify environment variables**: Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly in Vercel production environment variables
2. **Check browser console**: Look for authentication errors in the browser developer console
3. **Verify Supabase project**: Ensure you're configuring the correct Supabase project that matches your environment variables
4. **Check redirect URLs**: Make sure the exact URLs match (including `https://` and trailing paths)

### Common Issues

- **Redirect mismatch**: The redirect URL in your code must match one of the patterns in Supabase's Redirect URLs list
- **HTTPS required**: Production URLs must use `https://`, not `http://`
- **Wildcard patterns**: Use `*` to match any path under a base URL (e.g., `https://athlete-ledger.vercel.app/*`)

## Content-Security-Policy (CSP) Configuration

**Important:** If you have a Content-Security-Policy header configured, it must allow Supabase connections. Otherwise, authentication requests will be silently blocked by the browser.

### Current CSP Configuration

The project includes CSP headers in `vercel.json` that allow:

- **Supabase connections**: `https://*.supabase.co` and `https://*.supabase.in` in `connect-src`
- **Google Maps API**: Required for business discovery features
- **YouTube embeds**: For video content
- **Other required resources**: Scripts, styles, images, and fonts

### Verifying CSP is Not Blocking

If login fails silently, check the browser console (DevTools → Console) for CSP violations:

```
Refused to connect to 'https://...supabase.co/...' because it violates the following Content-Security-Policy directive: connect-src ...
```

If you see this error:

1. **Check `vercel.json`**: Ensure the CSP header includes `https://*.supabase.co` in `connect-src`
2. **Verify deployment**: The CSP header is applied via Vercel headers configuration
3. **Test after redeploy**: CSP changes require a redeploy to take effect

### Adding Custom CSP

If you need to customize CSP further, edit `vercel.json` and ensure `connect-src` includes:

```
connect-src 'self' https://*.supabase.co https://*.supabase.in ...
```

**Never remove Supabase from `connect-src`** - this will break authentication.

## Related Configuration

This configuration works in conjunction with:

- **Vercel Environment Variables**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set
- **Login Component**: The login form uses `signInWithPassword` (not OTP) - see `src/components/auth/LoginSupabase.tsx`
- **Diagnostics**: Check `data-testid="diag-compiled"` element to verify environment variables are compiled correctly
- **CSP Headers**: Configured in `vercel.json` to allow Supabase connections

## References

- [Supabase Auth URL Configuration Docs](https://supabase.com/docs/guides/auth/url-configuration)
- [Supabase Redirect URLs Guide](https://supabase.com/docs/guides/auth/redirect-urls)
