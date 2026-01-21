# Debug Routes Access Control

## Overview

Debug routes (`/debug/build` and `/debug/discover-recruiting`) are protected in production and only accessible when specific conditions are met.

## Access Conditions

Debug routes are accessible when **any** of the following is true:

1. **Development Mode**: `import.meta.env.DEV === true` (automatic in local dev)
2. **Diagnostics Enabled**: `VITE_DIAGNOSTICS=true` environment variable is set
3. **Secret Key Access**: `?debugKey=<secret>` query param matches `VITE_DEBUG_KEY` environment variable

## Protection Behavior

- **Without access**: Debug routes return the Home page (404-like behavior)
- **With access**: Debug routes render normally

## How to Enable Debug Access in Production

### Option 1: Enable Diagnostics Mode (All Routes)

Set the environment variable in your deployment platform (Vercel, etc.):

```bash
VITE_DIAGNOSTICS=true
```

**Pros:**
- Simple to enable
- All debug routes accessible

**Cons:**
- Less secure (all routes accessible)
- No granular control

### Option 2: Use Secret Key (Recommended)

Set a secret key in your deployment platform:

```bash
VITE_DEBUG_KEY=your-secret-key-here
```

Then access debug routes with the query parameter:

```
https://your-domain.com/debug/build?debugKey=your-secret-key-here
https://your-domain.com/debug/discover-recruiting?debugKey=your-secret-key-here
```

**Pros:**
- More secure (requires secret key)
- Can be shared with specific team members
- Key can be rotated easily

**Cons:**
- Requires passing query param
- Key must be kept secret

## Build-Time Protection

The build process will **fail** if:
- Building for production (`NODE_ENV=production` or `VERCEL=1`)
- AND `VITE_DIAGNOSTICS` is not set to `true`
- AND `VITE_DEBUG_KEY` is not set

This ensures that production deployments require explicit opt-in for debug access.

## Runtime Protection

Even if debug routes are included in the build, they are protected at runtime by `RootRouter.tsx`, which checks access conditions before rendering debug components.

## Testing

### Local Development

Debug routes are automatically accessible in dev mode (`npm run dev`).

### Production Testing

1. **With Diagnostics**:
   ```bash
   VITE_DIAGNOSTICS=true npm run build
   npm run preview
   # Visit http://localhost:5173/debug/build
   ```

2. **With Secret Key**:
   ```bash
   VITE_DEBUG_KEY=test-key-123 npm run build
   npm run preview
   # Visit http://localhost:5173/debug/build?debugKey=test-key-123
   ```

3. **Without Access** (should show Home page):
   ```bash
   npm run build
   npm run preview
   # Visit http://localhost:5173/debug/build
   # Should show Home page, not debug page
   ```

## Security Notes

- **Never commit `VITE_DEBUG_KEY` to version control**
- Use strong, random keys (e.g., `openssl rand -hex 32`)
- Rotate keys periodically
- Only share keys with trusted team members
- Consider using environment-specific keys (staging vs production)

## Files Modified

- `src/lib/debugAccess.ts` - Access control logic
- `src/routes/RootRouter.tsx` - Route protection
- `vite.config.ts` - Build-time protection plugin
- `tests/debug-routes.spec.ts` - Integration tests

## Troubleshooting

### Build Fails with "Debug routes must be protected"

**Solution**: Set either `VITE_DIAGNOSTICS=true` or `VITE_DEBUG_KEY=<secret>` in your build environment.

### Debug Routes Not Accessible in Production

**Check:**
1. Is `VITE_DIAGNOSTICS=true` set? OR
2. Is `VITE_DEBUG_KEY` set and matches the `?debugKey=` query param?

### Debug Routes Accessible Without Key in Production

**Check:**
1. Is `VITE_DIAGNOSTICS=true` accidentally set?
2. Is the app running in dev mode (`import.meta.env.DEV === true`)?
