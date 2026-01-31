# Deployment Model - Vercel Functions

## Current (Correct) Model

**API Functions Location**: Root `api/` directory (NOT `dist/api/`)  
**Static Assets**: `dist/` directory  
**Build Command**: `npm run vercel-build`

### How It Works

1. **Vercel automatically detects** serverless functions in the root `api/` directory
2. Each `.ts` file in `api/` becomes a serverless function endpoint:
   - `api/waitlist.ts` → `/api/waitlist`
   - `api/ping.ts` → `/api/ping`
   - `api/healthz.ts` → `/api/healthz`
   - `api/build-id.ts` → `/api/build-id`

3. **Static files** are built to `dist/` by Vite and served from there

### Current Build Process (vercel-build)

```json
"vercel-build": "tsc -b && cross-env VITE_BUILD_ID=$VERCEL_GIT_COMMIT_SHA vite build && node scripts/copy-demo-html.mjs"
```

This does:
1. Compile TypeScript (`tsc -b`)
2. Build Vite app to `dist/` (`vite build`)
3. Copy demo.html to `dist/` (`copy-demo-html.mjs`)

**Does NOT** produce `dist/api/` output (this is intentional and correct).

## Scripts That Are NOT Used in Deployment

The following scripts exist but are **not part of the current deployment**:

- `scripts/build-api.mjs` - Compiles `serverless_src/*.ts` to `dist/api/*.js`
- `scripts/copy-api-to-dist.mjs` - Copies `api/` to `dist/api/`
- `scripts/verify-dist-api.mjs` - Verifies `dist/api/` exists

These scripts were part of an earlier deployment model experiment and can be:
- **Ignored** (they don't run during deployment)
- **Removed** (if you want to clean up unused code)
- **Kept** (for potential future use or local testing)

## Verification

✅ Correct setup:
- `api/waitlist.ts` exists in root `api/` directory
- `vercel.json` uses `routes` (not `rewrites`) with `handle: filesystem`
- `vercel.json` does NOT reference `dist/api/`
- Build command does NOT produce `dist/api/`
- Vercel will auto-detect and deploy functions from root `api/`

## Common Pitfalls to Avoid

❌ **Don't** add `outputDirectory: "dist"` configuration that expects functions in `dist/api/`
❌ **Don't** move `api/` files to a different location
❌ **Don't** try to configure functions with paths like `dist/api/**/*.js`

✅ **Do** keep `api/` in the root directory
✅ **Do** use `vercel.json` `routes` with proper ordering
✅ **Do** let Vercel auto-detect the functions

## If You Need to Change the Model

If you want to use `dist/api/` in the future, you would need to:
1. Update `package.json` `vercel-build` to run `build-api.mjs` or `copy-api-to-dist.mjs`
2. Add `functions` config to `vercel.json`:
   ```json
   "functions": {
     "dist/api/**/*.js": {
       "runtime": "nodejs20.x"
     }
   }
   ```
3. Ensure all dependencies are bundled correctly

But for now, **stick with the root `api/` directory model** (it's simpler and working).
