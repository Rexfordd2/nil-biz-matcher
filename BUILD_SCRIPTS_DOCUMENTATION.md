# Build Scripts Documentation

## Overview

This document explains the build script configuration for public release deployments.

## Build Scripts

### `npm run build` (Standard Build)

```bash
npm run build
```

**Purpose**: Standard production build  
**Environment**: Requires either:
- `VITE_DEBUG_KEY` set (for debug route protection), OR
- `VITE_DIAGNOSTICS=true`, OR
- `VITE_PUBLIC_MODE=true` (bypasses debug protection)

**Use Case**: Internal builds, testing, or when debug routes need protection

**Process**:
1. Runs `prebuild` hook → `scripts/prepare-build-env.mjs`
2. TypeScript compilation (`tsc -b`)
3. Build info display (`scripts/print-build-info.js`)
4. Vite production build

---

### `npm run build:public` (Public Release Build) ⭐

```bash
npm run build:public
```

**Purpose**: Public release build with authentication bypass enabled  
**Environment**: Automatically sets `VITE_PUBLIC_MODE=true`

**Use Case**: Public production deployments where:
- No authentication is required
- Supabase is optional
- Debug routes are protected by default
- App works in anonymous mode

**Process**:
1. Sets `VITE_PUBLIC_MODE=true` via `cross-env`
2. Runs all `npm run build` steps with public mode enabled

**Cross-Platform**: Uses `cross-env` for Windows/Linux/macOS compatibility

---

## CI/CD Configuration

### GitHub Actions Workflows

Both deployment workflows set `VITE_PUBLIC_MODE: 'true'` as environment variables:

#### `.github/workflows/deploy-vercel.yml`

```yaml
# Preview deployments (Pull Requests)
- name: Deploy to Vercel (Preview)
  env:
    VITE_PUBLIC_MODE: 'true'  # ← Public mode enabled

# Production deployments (main branch)
- name: Deploy to Vercel (Production)
  env:
    VITE_PUBLIC_MODE: 'true'  # ← Public mode enabled
```

#### `.github/workflows/vercel-production.yml`

Uses Vercel's native build process which respects environment variables set in Vercel Dashboard.

**Recommended**: Set `VITE_PUBLIC_MODE=true` in Vercel Dashboard → Project Settings → Environment Variables → Production

---

## Vercel Build Configuration

### `vercel.json`

```json
{
  "buildCommand": "npm run vercel-build"
}
```

### Package.json Scripts

```json
{
  "vercel-build": "tsc -b && cross-env VITE_BUILD_ID=$VERCEL_GIT_COMMIT_SHA vite build && node scripts/copy-demo-html.mjs",
  "vercel-build:public": "cross-env VITE_PUBLIC_MODE=true npm run vercel-build"
}
```

**Note**: The `vercel-build` script respects the `VITE_PUBLIC_MODE` environment variable set in Vercel Dashboard or GitHub Actions.

---

## Environment Variables

### Required for Public Release

```bash
VITE_PUBLIC_MODE=true              # Enable public mode
VITE_GOOGLE_MAPS_API_KEY=<key>     # Google Maps JavaScript API
APP_URL=https://your-domain.app    # Production URL
```

### Optional (Graceful Degradation)

```bash
VITE_SUPABASE_URL=<url>            # Supabase project URL
VITE_SUPABASE_ANON_KEY=<key>       # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=<key>    # Server-side writes
GOOGLE_MAPS_API_KEY=<key>          # Server-side Places API
```

See [.env.example](./.env.example) for complete list.

---

## Verification Commands

### Pre-Deployment

```bash
# Type check
npm run verify:lint

# Build for public release
npm run build:public

# Run acceptance tests
npm run test:public-release
```

### Post-Deployment

```bash
# Verify production deployment
npm run verify:prod

# Check specific domain
npm run verify:build
```

---

## Quick Reference

| Command | Public Mode | Use Case |
|---------|-------------|----------|
| `npm run build` | Manual | Standard build (requires debug protection) |
| `npm run build:public` | ✅ Auto | **Public release** (recommended) |
| `npm run vercel-build` | Manual | Vercel native build |
| `npm run vercel-build:public` | ✅ Auto | Vercel public release |

---

## Local Development

For local public mode testing:

```bash
# Development server with public mode
VITE_PUBLIC_MODE=true npm run dev

# Or set in .env.local
echo "VITE_PUBLIC_MODE=true" > .env.local
npm run dev
```

---

## Troubleshooting

### Build fails with "Debug routes not protected"

**Solution**: Use `npm run build:public` instead of `npm run build`

### Windows: "VITE_PUBLIC_MODE is not recognized"

**Solution**: `cross-env` is already installed. Use `npm run build:public` (not manual env var setting)

### CI deployment succeeds but public mode not active

**Solution**: Verify `VITE_PUBLIC_MODE: 'true'` is set in:
1. GitHub Actions workflow env vars, OR
2. Vercel Dashboard → Environment Variables → Production

---

## Related Documentation

- [Release Candidate Checklist](../.cursor/plans/release_candidate_checklist_d0bc68b7.plan.md)
- [Public Release Acceptance Tests](./docs/public-release-acceptance-tests.md)
- [.env.example](./.env.example)
- [Deployment Guide](./DEPLOYMENT.md)
