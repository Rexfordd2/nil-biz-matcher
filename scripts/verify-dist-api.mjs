#!/usr/bin/env node
/**
 * Verify that dist/api contains the required API functions
 * This is a build-log proof step to show in Vercel logs
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const distApiDir = resolve(process.cwd(), 'dist', 'api')

console.log('\nBUILD PROOF dist/api:')

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
