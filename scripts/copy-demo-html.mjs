#!/usr/bin/env node
/**
 * Copy demo.html to dist and update asset references to match Vite build output
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = process.cwd()
const demoHtmlSrc = resolve(rootDir, 'demo.html')
const demoHtmlDest = resolve(rootDir, 'dist', 'demo.html')
const indexHtmlPath = resolve(rootDir, 'dist', 'index.html')

if (!existsSync(demoHtmlSrc)) {
  console.error(`[copy-demo-html] Source file does not exist: ${demoHtmlSrc}`)
  process.exit(1)
}

if (!existsSync(indexHtmlPath)) {
  console.error(`[copy-demo-html] dist/index.html does not exist. Run build first.`)
  process.exit(1)
}

try {
  // Read demo.html source
  let demoHtml = readFileSync(demoHtmlSrc, 'utf8')
  
  // Read dist/index.html to extract asset references
  const indexHtml = readFileSync(indexHtmlPath, 'utf8')
  
  // Extract script and link tags from index.html
  const scriptMatch = indexHtml.match(/<script[^>]*src="([^"]+)"[^>]*>/)
  const linkMatch = indexHtml.match(/<link[^>]*href="([^"]+)"[^>]*>/)
  
  if (scriptMatch && linkMatch) {
    const scriptSrc = scriptMatch[1]
    const linkHref = linkMatch[1]
    
    // Replace script and link tags in demo.html
    demoHtml = demoHtml.replace(
      /<script[^>]*src="[^"]*"[^>]*><\/script>/,
      `<script type="module" crossorigin src="${scriptSrc}"></script>`
    )
    demoHtml = demoHtml.replace(
      /<link[^>]*rel="stylesheet"[^>]*>/,
      `<link rel="stylesheet" crossorigin href="${linkHref}">`
    )
  }
  
  // Write to dist
  writeFileSync(demoHtmlDest, demoHtml, 'utf8')
  console.log(`[copy-demo-html] Copied ${demoHtmlSrc} to ${demoHtmlDest}`)
} catch (error) {
  console.error(`[copy-demo-html] Error:`, error.message)
  process.exit(1)
}
