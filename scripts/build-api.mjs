#!/usr/bin/env node
/**
 * Build API TypeScript files to JavaScript for Vercel deployment
 * Compiles ONLY serverless_src/ping.ts and serverless_src/healthz.ts into dist/api/*.js
 */
import { build } from 'esbuild'
import { rm, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const rootDir = process.cwd()
const apiSrcDir = resolve(rootDir, 'serverless_src')
const apiDestDir = resolve(rootDir, 'dist', 'api')

async function buildApiFiles() {
  if (!existsSync(apiSrcDir)) {
    console.error(`[build-api] Source directory does not exist: ${apiSrcDir}`)
    process.exit(1)
  }

  if (!existsSync(resolve(rootDir, 'dist'))) {
    console.error(`[build-api] dist directory does not exist. Run build first.`)
    process.exit(1)
  }

  // Clean dist/api before building
  if (existsSync(apiDestDir)) {
    await rm(apiDestDir, { recursive: true, force: true })
    console.log(`[build-api] Cleaned dist/api`)
  }
  await mkdir(apiDestDir, { recursive: true })

  // Only compile these two files
  const filesToBuild = [
    { src: resolve(apiSrcDir, 'ping.ts'), dest: 'ping.js' },
    { src: resolve(apiSrcDir, 'healthz.ts'), dest: 'healthz.js' },
  ]

  console.log(`[build-api] Compiling ${filesToBuild.length} endpoint files`)

  const buildPromises = filesToBuild.map(async ({ src, dest }) => {
    const outputPath = resolve(apiDestDir, dest)

    if (!existsSync(src)) {
      console.error(`[build-api] ✗ Source file missing: ${src}`)
      process.exit(1)
    }

    try {
      await build({
        entryPoints: [src],
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
      
      console.log(`[build-api] ✓ ${dest}`)
    } catch (error) {
      console.error(`[build-api] ✗ Failed to build ${dest}:`, error.message)
      throw error
    }
  })

  await Promise.all(buildPromises)
  
  console.log(`[build-api] Successfully compiled ${filesToBuild.length} files to ${apiDestDir}`)
}

buildApiFiles().catch((error) => {
  console.error(`[build-api] Fatal error:`, error)
  process.exit(1)
})
