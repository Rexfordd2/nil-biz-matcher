#!/usr/bin/env node
/**
 * Prepare build environment variables deterministically and cross-platform.
 * - Sets/derives VITE_BUILD_ID for the client build.
 * - Writes .env.build for debugging visibility and updates .env.local for Vite loading.
 *
 * Priority:
 * 1) VERCEL_GIT_COMMIT_SHA (CI)
 * 2) VITE_BUILD_ID (pre-set)
 * 3) GIT_COMMIT_SHA or COMMIT_REF (other CI)
 * 4) git rev-parse HEAD
 * 5) ISO timestamp
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function safeExec(cmd) {
  try {
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return out || null
  } catch {
    return null
  }
}

function getIsoNow() {
  return new Date().toISOString()
}

function shortSha(s) {
  if (!s) return null
  const m = /^[a-f0-9]{7,40}$/i.test(s) ? s.slice(0, 7) : s
  return m
}

function deriveBuildId() {
  // Priority order
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA
  if (fromVercel) return shortSha(fromVercel)

  const preSet = process.env.VITE_BUILD_ID
  if (preSet) return shortSha(preSet)

  const fromOtherCi = process.env.GIT_COMMIT_SHA || process.env.COMMIT_REF
  if (fromOtherCi) return shortSha(fromOtherCi)

  const fromGit = safeExec('git rev-parse HEAD')
  if (fromGit) return shortSha(fromGit)

  return getIsoNow()
}

function upsertEnvVar(lines, key, value) {
  const idx = lines.findIndex(l => l.startsWith(`${key}=`))
  const line = `${key}=${value}`
  if (idx >= 0) lines[idx] = line
  else lines.push(line)
}

function validateRequiredEnvVars() {
  const isProduction = process.env.NODE_ENV === 'production'
  const appMode = process.env.VITE_APP_MODE || process.env.APP_MODE || 'beta'
  const allowMissingGoogleKey = process.env.VITE_ALLOW_MISSING_GOOGLE_MAPS_KEY === 'true'
  
  // In production beta mode, Google Maps key is required unless explicitly opted out
  if (isProduction && appMode === 'beta' && !allowMissingGoogleKey) {
    const googleKey = process.env.VITE_GOOGLE_MAPS_API_KEY
    if (!googleKey || googleKey.trim() === '') {
      console.error('')
      console.error('❌ BUILD FAILED: Missing required environment variable')
      console.error('')
      console.error('VITE_GOOGLE_MAPS_API_KEY is required for production builds.')
      console.error('')
      console.error('To fix this:')
      console.error('  1. Set VITE_GOOGLE_MAPS_API_KEY in your environment')
      console.error('  2. For Vercel: Add it in Settings → Environment Variables')
      console.error('  3. For local builds: Add it to .env or .env.local')
      console.error('')
      console.error('To bypass this check (demo builds only):')
      console.error('  Set VITE_ALLOW_MISSING_GOOGLE_MAPS_KEY=true')
      console.error('')
      process.exit(1)
    }
  }
}

function main() {
  // Validate required env vars before proceeding
  validateRequiredEnvVars()
  
  const buildId = deriveBuildId()
  const buildTime = getIsoNow()

  // Always set process.env for current shell children, though main use is file-based loading
  process.env.VITE_BUILD_ID = buildId
  process.env.VITE_BUILD_TIME = buildTime
  
  // Propagate NEXT_PUBLIC_PUBLIC_MODE → VITE_PUBLIC_MODE for client builds
  if (process.env.NEXT_PUBLIC_PUBLIC_MODE && !process.env.VITE_PUBLIC_MODE) {
    process.env.VITE_PUBLIC_MODE = process.env.NEXT_PUBLIC_PUBLIC_MODE
  }
  
  // Propagate APP_MODE → VITE_APP_MODE for client builds
  if (process.env.APP_MODE && !process.env.VITE_APP_MODE) {
    process.env.VITE_APP_MODE = process.env.APP_MODE
  }

  const cwd = process.cwd()
  const envBuildPath = resolve(cwd, '.env.build')
  const envLocalPath = resolve(cwd, '.env.local')

  // .env.build (debug visibility)
  {
    const lines = []
    upsertEnvVar(lines, 'VITE_BUILD_ID', buildId)
    upsertEnvVar(lines, 'VITE_BUILD_TIME', buildTime)
    writeFileSync(envBuildPath, lines.join('\n') + '\n', 'utf8')
  }

  // .env.local (ensures Vite loads values at build time)
  {
    const existing = existsSync(envLocalPath) ? readFileSync(envLocalPath, 'utf8') : ''
    const lines = existing.split(/\r?\n/).filter(Boolean)
      .filter(l => !l.startsWith('VITE_BUILD_ID=') && !l.startsWith('VITE_BUILD_TIME=') && !l.startsWith('VITE_PUBLIC_MODE=') && !l.startsWith('VITE_APP_MODE='))
    upsertEnvVar(lines, 'VITE_BUILD_ID', buildId)
    upsertEnvVar(lines, 'VITE_BUILD_TIME', buildTime)
    
    // Propagate NEXT_PUBLIC_PUBLIC_MODE → VITE_PUBLIC_MODE if alias is set
    if (process.env.NEXT_PUBLIC_PUBLIC_MODE && !process.env.VITE_PUBLIC_MODE) {
      upsertEnvVar(lines, 'VITE_PUBLIC_MODE', process.env.NEXT_PUBLIC_PUBLIC_MODE)
    } else if (process.env.VITE_PUBLIC_MODE) {
      upsertEnvVar(lines, 'VITE_PUBLIC_MODE', process.env.VITE_PUBLIC_MODE)
    }
    
    // Propagate APP_MODE → VITE_APP_MODE if set
    if (process.env.APP_MODE && !process.env.VITE_APP_MODE) {
      upsertEnvVar(lines, 'VITE_APP_MODE', process.env.APP_MODE)
    } else if (process.env.VITE_APP_MODE) {
      upsertEnvVar(lines, 'VITE_APP_MODE', process.env.VITE_APP_MODE)
    }
    
    writeFileSync(envLocalPath, lines.join('\n') + '\n', 'utf8')
  }

  console.log(`[prepare-build-env] VITE_BUILD_ID=${buildId} VITE_BUILD_TIME=${buildTime}`)
}

main()

