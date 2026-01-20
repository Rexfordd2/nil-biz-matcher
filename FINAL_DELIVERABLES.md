# Final Deliverables

## 1. Final vercel.json (full)

```json
{
  "version": 2,
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "dist",
  "functions": {
    "dist/api/**/*.js": {
      "runtime": "nodejs20.x"
    }
  },
  "routes": [
    { "src": "/healthz", "dest": "/api/healthz" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

## 2. Final package.json scripts section (only relevant scripts)

```json
{
  "scripts": {
    "prevercel-build": "node scripts/prepare-build-env.mjs",
    "vercel-build": "tsc -b && cross-env VITE_BUILD_ID=$VERCEL_GIT_COMMIT_SHA vite build && node scripts/build-api.mjs && node scripts/verify-dist-api.mjs"
  }
}
```

## 3. The full build-api script (scripts/build-api.mjs)

```javascript
#!/usr/bin/env node
/**
 * Build API TypeScript files to JavaScript for Vercel deployment
 * Compiles api/*.ts into dist/api/*.js using esbuild targeting node20
 */
import { build } from 'esbuild'
import { readdir, stat, mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative, extname } from 'node:path'
import { existsSync } from 'node:fs'

const rootDir = process.cwd()
const apiSrcDir = resolve(rootDir, 'api')
const apiDestDir = resolve(rootDir, 'dist', 'api')

async function getAllTsFiles(dir, baseDir = dir) {
  const files = []
  const entries = await readdir(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name)
    const relativePath = relative(baseDir, fullPath)
    
    if (entry.isDirectory()) {
      // Skip node_modules and other common directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue
      }
      files.push(...await getAllTsFiles(fullPath, baseDir))
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push({ fullPath, relativePath })
    }
  }
  
  return files
}

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

async function buildApiFiles() {
  if (!existsSync(apiSrcDir)) {
    console.error(`[build-api] Source directory does not exist: ${apiSrcDir}`)
    process.exit(1)
  }

  if (!existsSync(resolve(rootDir, 'dist'))) {
    console.error(`[build-api] dist directory does not exist. Run build first.`)
    process.exit(1)
  }

  await ensureDir(apiDestDir)

  const tsFiles = await getAllTsFiles(apiSrcDir)
  
  if (tsFiles.length === 0) {
    console.warn(`[build-api] No TypeScript files found in ${apiSrcDir}`)
    return
  }

  console.log(`[build-api] Found ${tsFiles.length} TypeScript files to compile`)

  const buildPromises = tsFiles.map(async ({ fullPath, relativePath }) => {
    const outputPath = resolve(apiDestDir, relativePath.replace(/\.ts$/, '.js'))
    const outputDir = dirname(outputPath)
    
    await ensureDir(outputDir)

    try {
      await build({
        entryPoints: [fullPath],
        bundle: true,
        platform: 'node',
        target: 'node20',
        format: 'esm',
        outfile: outputPath,
        external: [
          '@vercel/node',
          '@prisma/client',
          '@prisma/client/*',
          'prisma',
          'prisma/*',
          'node:*',
        ],
        banner: {
          js: '// @ts-nocheck\n',
        },
        logLevel: 'silent',
      })
      
      console.log(`[build-api] ✓ ${relativePath} → ${relative(outputDir, outputPath)}`)
    } catch (error) {
      console.error(`[build-api] ✗ Failed to build ${relativePath}:`, error.message)
      throw error
    }
  })

  await Promise.all(buildPromises)
  
  console.log(`[build-api] Successfully compiled ${tsFiles.length} files to ${apiDestDir}`)
  
  // Verify critical files exist
  const pingPath = resolve(apiDestDir, 'ping.js')
  const healthzPath = resolve(apiDestDir, 'healthz.js')
  
  if (!existsSync(pingPath)) {
    console.error(`[build-api] ERROR: dist/api/ping.js does not exist after build`)
    process.exit(1)
  }
  
  if (!existsSync(healthzPath)) {
    console.error(`[build-api] ERROR: dist/api/healthz.js does not exist after build`)
    process.exit(1)
  }
  
  console.log(`[build-api] ✓ Verified dist/api/ping.js exists`)
  console.log(`[build-api] ✓ Verified dist/api/healthz.js exists`)
}

buildApiFiles().catch((error) => {
  console.error(`[build-api] Fatal error:`, error)
  process.exit(1)
})
```

## 4. The full verify-dist-api script (scripts/verify-dist-api.mjs)

```javascript
#!/usr/bin/env node
/**
 * Verify that dist/api contains the required API functions
 * This is a build-log proof step to show in Vercel logs
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const distApiDir = resolve(process.cwd(), 'dist', 'api')

console.log('\n=== BUILD PROOF: dist/api contents ===')

if (!existsSync(distApiDir)) {
  console.error('❌ ERROR: dist/api directory does not exist!')
  process.exit(1)
}

function listFiles(dir, prefix = '') {
  const entries = readdirSync(dir)
  const files = []
  const dirs = []
  
  for (const entry of entries) {
    const fullPath = resolve(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      dirs.push(entry)
    } else {
      files.push(entry)
    }
  }
  
  // Print directories first
  for (const dirName of dirs.sort()) {
    console.log(`${prefix}📁 ${dirName}/`)
    listFiles(resolve(dir, dirName), prefix + '  ')
  }
  
  // Print files
  for (const file of files.sort()) {
    const filePath = resolve(dir, file)
    const size = statSync(filePath).size
    console.log(`${prefix}📄 ${file} (${size} bytes)`)
  }
}

listFiles(distApiDir)

// Verify critical files
const pingPath = resolve(distApiDir, 'ping.js')
const healthzPath = resolve(distApiDir, 'healthz.js')

console.log('\n=== Verification ===')
if (existsSync(pingPath)) {
  console.log('✅ dist/api/ping.js exists')
} else {
  console.error('❌ dist/api/ping.js MISSING')
  process.exit(1)
}

if (existsSync(healthzPath)) {
  console.log('✅ dist/api/healthz.js exists')
} else {
  console.error('❌ dist/api/healthz.js MISSING')
  process.exit(1)
}

console.log('=== Build proof complete ===\n')
```

## 5. Exact PowerShell command blocks

### B) Proof of Deployment (Preview)

```powershell
# Step 1: Deploy preview with --token and --force
$env:VERCEL_TOKEN='your-token-here'
vercel deploy --prebuilt --token $env:VERCEL_TOKEN --force

# Step 2: Copy the preview URL from output (e.g., https://athlete-ledger-abc123.vercel.app)
# Replace PREVIEW_URL below with the actual preview URL

$PREVIEW_URL='https://athlete-ledger-abc123.vercel.app'

# Step 3: Curl proof (cache-busting) against preview
Write-Host "Testing /api/ping..."
curl.exe -H "Cache-Control: no-cache" -H "Pragma: no-cache" "$PREVIEW_URL/api/ping?t=$(Get-Date -Format 'yyyyMMddHHmmss')" -i

Write-Host "`nTesting /api/healthz..."
curl.exe -H "Cache-Control: no-cache" -H "Pragma: no-cache" "$PREVIEW_URL/api/healthz?t=$(Get-Date -Format 'yyyyMMddHHmmss')" -i

Write-Host "`nTesting /healthz..."
curl.exe -H "Cache-Control: no-cache" -H "Pragma: no-cache" "$PREVIEW_URL/healthz?t=$(Get-Date -Format 'yyyyMMddHHmmss')" -i
```

**Pass condition:** Content-Type: application/json and JSON body (starts with {)
**Fail condition:** any HTML or Content-Disposition: attachment; filename="index.html"

### C) Promote to Production

```powershell
# Step 1: Deploy prod with --token and --force
$env:VERCEL_TOKEN='your-token-here'
vercel deploy --prod --prebuilt --token $env:VERCEL_TOKEN --force

# Step 2: Curl proof (cache-busting) against prod
$PROD_URL='https://athlete-ledger.vercel.app'

Write-Host "Testing /api/ping..."
curl.exe -H "Cache-Control: no-cache" -H "Pragma: no-cache" "$PROD_URL/api/ping?t=$(Get-Date -Format 'yyyyMMddHHmmss')" -i

Write-Host "`nTesting /api/healthz..."
curl.exe -H "Cache-Control: no-cache" -H "Pragma: no-cache" "$PROD_URL/api/healthz?t=$(Get-Date -Format 'yyyyMMddHHmmss')" -i

Write-Host "`nTesting /healthz..."
curl.exe -H "Cache-Control: no-cache" -H "Pragma: no-cache" "$PROD_URL/healthz?t=$(Get-Date -Format 'yyyyMMddHHmmss')" -i

# Step 3: Run strict gate
$env:DOMAINS='https://athlete-ledger.vercel.app'
$env:ALLOW_STRICT_WITHOUT_DEBUG='true'
npm run launch:status -- --strict
```

## 6. Success Checklist (6-line definition of DONE)

```
✅ Build: npm run vercel-build completes with dist/api/ping.js and dist/api/healthz.js present
✅ Preview: /api/ping returns Content-Type: application/json with JSON body starting with {
✅ Preview: /api/healthz returns Content-Type: application/json with JSON body starting with {
✅ Preview: /healthz returns Content-Type: application/json with JSON body starting with {
✅ Production: All 3 endpoints return JSON (not HTML) on production domain
✅ Gate: npm run launch:status -- --strict exits with code 0 (PASS status)
```
