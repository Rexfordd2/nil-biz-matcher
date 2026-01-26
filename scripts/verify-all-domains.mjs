#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Production-grade domain verifier for build consistency.
 *
 * Env:
 * - DOMAINS="https://a.com,https://b.com" (comma-separated)
 * - VERCEL_TOKEN="token" (optional, for auto-discovery)
 *
 * CLI:
 * - --timeoutMs=10000 (override request timeout in ms; default 10000)
 *
 * Requirements:
 * 1) Accept DOMAINS env var OR auto-discover from Vercel when VERCEL_TOKEN is provided.
 * 2) For each domain:
 *    - call /healthz 5 times (detect instability)
 *    - fetch homepage and confirm header build id (via data-testid="build-id")
 * 3) Output a PASS/FAIL table with:
 *    - domain, buildId, stableAcrossRuns (yes/no), headerMatches (yes/no), error (if any)
 * 4) Exit codes:
 *    - 0 only if all pass and all buildIds match
 *    - 1 otherwise
 */
import 'dotenv/config'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { timeoutMs: 10000 }
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a.startsWith('--timeoutMs=')) {
      const v = Number(a.split('=')[1])
      if (Number.isFinite(v) && v > 0) out.timeoutMs = v
    } else if (a === '--timeoutMs') {
      const next = Number(args[i + 1])
      if (Number.isFinite(next) && next > 0) {
        out.timeoutMs = next
        i += 1
      }
    }
  }
  return out
}

function hasPlaceholderDomain(domains) {
  return domains.some(d => /yourdomain/i.test(d) || /your-app/i.test(d) || /yourapp/i.test(d) || /example\.com/i.test(d))
}

async function parseDomainsFromEnv() {
  const raw = process.env.DOMAINS || ''
  let list = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (list.length === 0) {
    // Attempt auto-discovery via Vercel API when VERCEL_TOKEN is provided
    if (process.env.VERCEL_TOKEN) {
      const scriptPath = join(__dirname, 'get-vercel-domains.mjs')
      try {
        const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
          env: process.env,
          timeout: 30000,
          windowsHide: true,
          maxBuffer: 1024 * 1024
        })
        const firstLine = String(stdout || '').split(/\r?\n/)[0]?.trim()
        const guessed = (firstLine || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
        if (guessed.length > 0) {
          console.error(`DOMAINS not set; auto-discovered ${guessed.length} domain(s) from Vercel.`)
          list = guessed
        }
      } catch (e) {
        console.error('Auto-discovery failed:', e?.message || e)
        console.error('Ensure VERCEL_TOKEN is valid and has access to project domains.')
      }
    }
  }
  if (list.length === 0) {
    console.error('DOMAINS env var is required, or set VERCEL_TOKEN for auto-discovery.')
    console.error('Examples:')
    console.error('  DOMAINS="https://a.com,https://b.com" npm run verify:prod')
    console.error('  $env:VERCEL_TOKEN="<token>"; npm run verify:prod')
    console.error('  export VERCEL_TOKEN="<token>"; npm run verify:prod')
    process.exit(2)
  }
  if (hasPlaceholderDomain(list)) {
    console.error('Replace placeholder domains in DOMAINS (found placeholder).')
    console.error('Example: DOMAINS="https://app.example.com,https://www.example.com"')
    process.exit(2)
  }
  for (const d of list) {
    try {
      // eslint-disable-next-line no-new
      new URL(d)
    } catch {
      console.error(`Invalid URL in DOMAINS: ${d}`)
      process.exit(2)
    }
  }
  return list
}

// Simple timeout wrapper around global fetch (Node 18+)
async function httpGet(url, opts = {}) {
  const controller = new AbortController()
  const t = setTimeout(() => {
    try { controller.abort() } catch {}
  }, opts.timeoutMs ?? 10000)
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'User-Agent': 'verify-all-domains/2.0',
        ...(opts.headers || {})
      }
    })
    return res
  } finally {
    clearTimeout(t)
  }
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pad(str, len) {
  const s = String(str)
  if (s.length >= len) return s
  return s + ' '.repeat(len - s.length)
}

function formatTable(rows, headers) {
  const widths = headers.map(h => h.length)
  const allRows = [headers, ...rows]
  for (const r of allRows) {
    r.forEach((cell, i) => {
      widths[i] = Math.max(widths[i], String(cell).length)
    })
  }
  const sep = widths.map(w => '-'.repeat(w)).join('  ')
  const lines = []
  lines.push(widths.map((w, i) => pad(headers[i], w)).join('  '))
  lines.push(sep)
  for (const r of rows) {
    lines.push(widths.map((w, i) => pad(String(r[i]), w)).join('  '))
  }
  return lines.join('\n')
}

function shortErrorFromFetchError(err) {
  if (!err) return 'UNKNOWN'
  const code = err.code || err.cause?.code || ''
  const name = err.name || ''
  const msg = (err.message || '').toLowerCase()
  if (name === 'AbortError') return 'TIMEOUT'
  if (code === 'UND_ERR_CONNECT_TIMEOUT') return 'TIMEOUT'
  if (code === 'ENOTFOUND') return 'DNS'
  if (msg.includes('timeout')) return 'TIMEOUT'
  if (msg.includes('dns')) return 'DNS'
  return code || name || 'FETCH_ERROR'
}

/**
 * Fetch /healthz or /api/healthz endpoint and return buildId
 */
async function fetchHealthzOnce(base, endpoint, timeoutMs) {
  const url = new URL(endpoint, base).toString()
  try {
    const res = await httpGet(url, { headers: { Accept: 'application/json' }, timeoutMs })
    if (!res || !res.ok) {
      return {
        ok: false,
        error: res ? `HTTP_${res.status}` : 'NO_RESPONSE',
        buildId: null,
        contentType: res?.headers?.get('content-type') || 'unknown'
      }
    }
    const contentType = res.headers?.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return { ok: false, error: `WRONG_CONTENT_TYPE: ${contentType}`, buildId: null, contentType }
    }
    let json
    try {
      json = await res.json()
    } catch {
      return { ok: false, error: 'BAD_JSON', buildId: null, contentType }
    }
    const buildId = (json?.buildId ?? '').toString()
    if (!buildId) {
      return { ok: false, error: 'NO_BUILD_ID', buildId: null, contentType }
    }
    return { ok: true, error: '', buildId, contentType }
  } catch (e) {
    return { ok: false, error: shortErrorFromFetchError(e), buildId: null, contentType: 'unknown' }
  }
}

/**
 * Call /healthz and /api/healthz to test both endpoints
 * Returns result from /healthz (rewritten), with fallback to /api/healthz
 */
async function fetchHealthzStable(base, timeoutMs) {
  // Try /healthz first (should rewrite to /api/healthz)
  const healthzResults = []
  const apiHealthzResults = []
  const attempts = 5
  
  for (let i = 0; i < attempts; i++) {
    const healthzResult = await fetchHealthzOnce(base, '/healthz', timeoutMs)
    healthzResults.push(healthzResult)
    const apiResult = await fetchHealthzOnce(base, '/api/healthz', timeoutMs)
    apiHealthzResults.push(apiResult)
    // Small delay between attempts (except last)
    if (i < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  // Check /healthz results first
  const healthzSuccessful = healthzResults.filter(r => r.ok)
  const apiSuccessful = apiHealthzResults.filter(r => r.ok)
  
  // Prefer /healthz results, fallback to /api/healthz if /healthz fails
  const resultsToUse = healthzSuccessful.length > 0 ? healthzResults : apiHealthzResults
  const successful = healthzSuccessful.length > 0 ? healthzSuccessful : apiSuccessful
  
  if (successful.length === 0) {
    // Both failed - return combined error info
    const healthzError = healthzResults[0]?.error || 'UNKNOWN'
    const apiError = apiHealthzResults[0]?.error || 'UNKNOWN'
    const healthzContentType = healthzResults[0]?.contentType || 'unknown'
    const apiContentType = apiHealthzResults[0]?.contentType || 'unknown'
    return {
      ok: false,
      error: `/healthz: ${healthzError} (${healthzContentType}), /api/healthz: ${apiError} (${apiContentType})`,
      buildId: null,
      stable: false
    }
  }

  // Check if all successful results have same buildId
  const buildIds = successful.map(r => r.buildId).filter(Boolean)
  const uniqueBuildIds = [...new Set(buildIds)]
  const isStable = uniqueBuildIds.length === 1 && successful.length === attempts

  // Use most common buildId (or first if all different)
  const buildId = uniqueBuildIds[0] || buildIds[0] || null

  // Check if /healthz returned HTML (wrong content type)
  const healthzReturnedHtml = healthzResults.some(r => r.contentType?.includes('text/html'))
  const apiReturnedHtml = apiHealthzResults.some(r => r.contentType?.includes('text/html'))
  
  let error = ''
  if (healthzReturnedHtml && !healthzSuccessful.length) {
    error = `/healthz returned HTML instead of JSON`
  } else if (apiReturnedHtml && !apiSuccessful.length) {
    error = `/api/healthz returned HTML instead of JSON`
  }

  return {
    ok: successful.length > 0,
    error,
    buildId,
    stable: isStable
  }
}

/**
 * Verify build ID in homepage HTML via data-testid="build-id" or pattern matching
 */
async function verifyHeaderBuild(base, expectedBuildId, timeoutMs) {
  try {
    const res = await httpGet(new URL('/', base).toString(), { redirect: 'follow', timeoutMs })
    if (!res || res.status !== 200) {
      return { ok: false, matches: false, error: res ? `HTTP_${res.status}` : 'NO_RESPONSE' }
    }
    const html = await res.text()

    // First, try to find data-testid="build-id" element
    // Pattern: <... data-testid="build-id">...buildId...</...>
    // or: <... data-testid="build-id">buildId</...>
    const testIdPattern = new RegExp(`data-testid=["']build-id["'][^>]*>([^<]+)`, 'i')
    const testIdMatch = html.match(testIdPattern)
    if (testIdMatch) {
      const foundBuildId = testIdMatch[1].trim()
      const matches = foundBuildId === expectedBuildId
      return { ok: true, matches, error: matches ? '' : `MISMATCH: found "${foundBuildId}"` }
    }

    // Fallback: check for "Build: {buildId}" pattern
    const buildPattern = new RegExp(`Build:\\s*${escapeRegExp(expectedBuildId)}`, 'i')
    const patternMatch = buildPattern.test(html)
    if (patternMatch) {
      return { ok: true, matches: true, error: '' }
    }

    // Also check for data-testid="client-build-id" as another fallback
    const clientBuildIdPattern = new RegExp(`data-testid=["']client-build-id["'][^>]*>([^<]+)`, 'i')
    const clientBuildIdMatch = html.match(clientBuildIdPattern)
    if (clientBuildIdMatch) {
      const foundBuildId = clientBuildIdMatch[1].trim()
      const matches = foundBuildId === expectedBuildId
      return { ok: true, matches, error: matches ? '' : `MISMATCH: found "${foundBuildId}"` }
    }

    return { ok: true, matches: false, error: 'BUILD_ID_NOT_FOUND' }
  } catch (e) {
    return { ok: false, matches: false, error: shortErrorFromFetchError(e) }
  }
}

async function main() {
  const { timeoutMs } = parseArgs()
  const domains = await parseDomainsFromEnv()
  const rows = []
  const successes = []

  console.log(`\nVerifying ${domains.length} domain(s)...\n`)

  for (const domain of domains) {
    let health
    let header = { ok: false, matches: false, error: 'n/a' }
    try {
      // Call /healthz 5 times to detect instability
      health = await fetchHealthzStable(domain, timeoutMs)
      if (health.ok && health.buildId) {
        header = await verifyHeaderBuild(domain, health.buildId, timeoutMs)
      } else {
        header = { ok: false, matches: false, error: 'n/a' }
      }
    } catch (e) {
      // Defensive: record as failure, but never throw
      health = { ok: false, error: shortErrorFromFetchError(e), buildId: null, stable: false }
      header = { ok: false, matches: false, error: 'n/a' }
    }

    const buildIdOut = health.ok && health.buildId ? health.buildId : 'n/a'
    const stableAcrossRuns = health.ok ? (health.stable ? 'yes' : 'no') : 'n/a'
    const headerMatches = health.ok && buildIdOut !== 'n/a'
      ? (header.matches ? 'yes' : 'no')
      : 'n/a'
    const errorOut = (() => {
      if (!health.ok) return health.error || 'FAIL'
      if (!health.stable) return `UNSTABLE: ${health.error || 'buildId varied'}`
      if (headerMatches === 'no') return header.error || 'HEADER_MISMATCH'
      return ''
    })()

    rows.push([
      domain,
      buildIdOut,
      stableAcrossRuns,
      headerMatches,
      errorOut || '-'
    ])

    if (health.ok && health.stable && headerMatches === 'yes') {
      successes.push(buildIdOut)
    }
  }

  const headers = ['Domain', 'buildId', 'stableAcrossRuns', 'headerMatches', 'error']
  console.log('Domain Build Consistency Verification\n')
  console.log(formatTable(rows, headers))
  console.log('')

  // Determine exit code
  const allPass = rows.every(r => {
    const buildId = r[1]
    const stable = r[2]
    const headerMatch = r[3]
    return buildId !== 'n/a' && stable === 'yes' && headerMatch === 'yes'
  })

  const uniqueBuilds = [...new Set(successes.filter(Boolean))]
  const mismatch = uniqueBuilds.length > 1

  if (mismatch) {
    console.error(`❌ BuildId mismatch detected among successful domains: ${uniqueBuilds.join(', ')}`)
  }

  if (!allPass || mismatch) {
    const failures = rows.filter(r => {
      const buildId = r[1]
      const stable = r[2]
      const headerMatch = r[3]
      return buildId === 'n/a' || stable !== 'yes' || headerMatch !== 'yes'
    })
    if (failures.length > 0) {
      console.error(`❌ ${failures.length} domain(s) failed verification`)
    }
    process.exitCode = 1
  } else {
    console.log('✅ All domains passed verification and buildIds match')
    process.exitCode = 0
  }
}

// Run
main().catch((e) => {
  console.error('Fatal error in verify-all-domains:', e?.message || e)
  process.exit(1)
})
