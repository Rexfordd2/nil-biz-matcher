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
