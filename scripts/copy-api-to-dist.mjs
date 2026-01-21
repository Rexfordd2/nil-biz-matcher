#!/usr/bin/env node
/**
 * Copy API files to dist/api/ for Vercel deployment
 * When outputDirectory is set to "dist", Vercel looks for API functions in dist/api/
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = process.cwd()
const apiSrc = resolve(rootDir, 'api')
const apiDest = resolve(rootDir, 'dist', 'api')

if (!existsSync(apiSrc)) {
  console.error(`[copy-api-to-dist] Source directory does not exist: ${apiSrc}`)
  process.exit(1)
}

if (!existsSync(resolve(rootDir, 'dist'))) {
  console.error(`[copy-api-to-dist] dist directory does not exist. Run build first.`)
  process.exit(1)
}

try {
  // Ensure destination directory exists
  if (!existsSync(apiDest)) {
    mkdirSync(apiDest, { recursive: true })
  }
  
  cpSync(apiSrc, apiDest, { recursive: true })
  console.log(`[copy-api-to-dist] Copied ${apiSrc} to ${apiDest}`)
} catch (error) {
  console.error(`[copy-api-to-dist] Error copying API files:`, error.message)
  process.exit(1)
}
