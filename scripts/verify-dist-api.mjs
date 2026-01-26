#!/usr/bin/env node
/**
 * Verify that dist/api contains ONLY ping.js and healthz.js
 * Hard fails if any files are missing or extra files exist
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const distApiDir = resolve(process.cwd(), 'dist', 'api')

console.log('\nBUILD PROOF dist/api:')

if (!existsSync(distApiDir)) {
  console.error('❌ ERROR: dist/api directory does not exist!')
  process.exit(1)
}

function getAllFiles(dir, baseDir = dir) {
  const files = []
  const entries = readdirSync(dir)
  
  for (const entry of entries) {
    const fullPath = resolve(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir))
    } else {
      files.push(resolve(baseDir, entry))
    }
  }
  
  return files
}

const allFiles = getAllFiles(distApiDir)
const jsFiles = allFiles.filter(f => f.endsWith('.js')).map(f => f.replace(distApiDir + '\\', '').replace(distApiDir + '/', ''))

console.log('\nFiles in dist/api:')
if (jsFiles.length === 0) {
  console.log('  (no files)')
} else {
  for (const file of jsFiles.sort()) {
    const filePath = resolve(distApiDir, file)
    const size = statSync(filePath).size
    console.log(`  📄 ${file} (${size} bytes)`)
  }
}

// Verify required files exist
const pingPath = resolve(distApiDir, 'ping.js')
const healthzPath = resolve(distApiDir, 'healthz.js')

console.log('\n=== Verification ===')

let hasErrors = false

if (!existsSync(pingPath)) {
  console.error('❌ ERROR: dist/api/ping.js MISSING')
  hasErrors = true
} else {
  console.log('✅ dist/api/ping.js exists')
}

if (!existsSync(healthzPath)) {
  console.error('❌ ERROR: dist/api/healthz.js MISSING')
  hasErrors = true
} else {
  console.log('✅ dist/api/healthz.js exists')
}

// Verify no extra files
const expectedFiles = ['ping.js', 'healthz.js']
const extraFiles = jsFiles.filter(f => !expectedFiles.includes(f))

if (extraFiles.length > 0) {
  console.error(`❌ ERROR: dist/api contains ${extraFiles.length} extra file(s):`)
  for (const file of extraFiles) {
    console.error(`   - ${file}`)
  }
  hasErrors = true
} else {
  console.log('✅ No extra files found')
}

if (jsFiles.length !== 2) {
  console.error(`❌ ERROR: Expected exactly 2 files, found ${jsFiles.length}`)
  hasErrors = true
} else {
  console.log(`✅ Found exactly ${jsFiles.length} file(s) as expected`)
}

if (hasErrors) {
  console.error('\n=== Verification FAILED ===')
  process.exit(1)
}

console.log('=== Build proof complete ===\n')
