#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Production domains verification script
 *
 * Env:
 * - DOMAINS="https://a.com,https://b.com"
 * - HEADFUL=1 (optional, to see the browser)
 * - PWDEBUG=1 (optional, Playwright debug)
 */
import 'dotenv/config'

// Prefer playwright (browsers) over @playwright/test here
let chromium
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  ;({ chromium } = await import('playwright'))
} catch (err) {
  console.error('Missing dependency: playwright. Install with: npm i -D playwright')
  process.exit(2)
}

// Node 18+ has global fetch; fall back if needed
async function httpGet(url, opts = {}) {
  const controller = new AbortController()
  const t = setTimeout(() => {
    try { controller.abort() } catch {}
  }, opts.timeoutMs ?? 20000)
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'User-Agent': 'verify-domains/1.0 (+playwright)',
        Accept: 'text/html,application/xhtml+xml',
        ...(opts.headers || {})
      }
    })
    return res
  } finally {
    clearTimeout(t)
  }
}

function parseDomainsFromEnv() {
  const raw = process.env.DOMAINS || ''
  const list = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (list.length === 0) {
    console.error('DOMAINS env var is required, e.g.:')
    console.error('  DOMAINS="https://a.com,https://b.com" npm run verify:domains')
    process.exit(2)
  }
  for (const d of list) {
    try {
      // Validate URL
      // eslint-disable-next-line no-new
      new URL(d)
    } catch {
      console.error(`Invalid URL in DOMAINS: ${d}`)
      process.exit(2)
    }
  }
  return list
}

function pad(str, len) {
  const s = String(str)
  if (s.length >= len) return s
  return s + ' '.repeat(len - s.length)
}

function formatTable(rows) {
  const headers = ['Domain', 'HTTP 200', 'Build in header', 'Discover UI x10', 'Recruiting UI x10', 'Debug harness (<5% fail)']
  const widths = headers.map(h => h.length)
  const allRows = [headers, ...rows]
  // compute widths
  for (const r of allRows) {
    r.forEach((cell, i) => {
      widths[i] = Math.max(widths[i], String(cell).length)
    })
  }
  const lines = []
  const sep = widths.map(w => '-'.repeat(w)).join('  ')
  lines.push(widths.map((w, i) => pad(headers[i], w)).join('  '))
  lines.push(sep)
  for (const r of rows) {
    lines.push(widths.map((w, i) => pad(String(r[i]), w)).join('  '))
  }
  return lines.join('\n')
}

async function assertBuildHeaderPresent(domain) {
  const res = await httpGet(domain, { redirect: 'follow', timeoutMs: 20000 })
  const ok = res && res.status === 200
  if (!ok) {
    return { ok: false, code: res?.status ?? 'ERR' }
  }
  const html = await res.text()
  const hasBuild = /Build:\s*[A-Za-z0-9._-]+/.test(html)
  return { ok: true, hasBuild }
}

async function runDiscoverSearches(page, domain, iterations = 10) {
  // Navigate to app root and open "Discover" tab via sidebar/bottom nav
  // Root first to hydrate the SPA
  await page.goto(new URL('/', domain).toString(), { waitUntil: 'domcontentloaded' })
  // "Build:" should be visible in header somewhere
  await page.getByText(/Build:/, { exact: false }).waitFor({ timeout: 15000 })

  // Prefer desktop sidebar; ensure large viewport so sidebar is visible
  try {
    await page.getByRole('button', { name: 'Discover' }).click({ timeout: 8000 })
  } catch {
    // Fallback to bottom nav on mobile
    await page.getByRole('button', { name: 'More' }).click({ timeout: 8000 })
    await page.getByRole('button', { name: 'Discover' }).click({ timeout: 8000 })
  }

  const whatInput = page.getByPlaceholder('What (pizza, gym, store...)')
  const whereInput = page.getByPlaceholder('Where (City, ST or zip)')
  const searchBtn = page.getByRole('button', { name: /^Search$/ }).first()

  const terms = ['pizza', 'gym', 'coffee', 'bakery', 'yoga', 'barber', 'pharmacy', 'restaurant', 'park', 'museum']
  const locs = ['Austin, TX', 'Seattle, WA', 'New York, NY', 'Miami, FL', 'Denver, CO', 'Chicago, IL', 'San Diego, CA', 'Phoenix, AZ']

  for (let i = 0; i < iterations; i++) {
    const term = terms[i % terms.length]
    const loc = locs[(i * 3) % locs.length]
    await whatInput.fill(term)
    await whereInput.fill(loc)
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}),
      searchBtn.click()
    ])
    // Assert no explicit data-format error and some result UI change
    await page.waitForTimeout(250) // brief settle
    const hasDataError = await page.getByText(/Data format error/i).count()
    if (hasDataError > 0) {
      throw new Error(`Data format error surfaced in Discover (term="${term}", loc="${loc}")`)
    }
    // Heuristic: after a search, either "No matches found." appears or a results list appears.
    // Require at least one of those and absence of a fatal error string.
    const noMatchesVisible = await page.getByText('No matches found.').isVisible().catch(() => false)
    const resultsButtons = await page.locator('button.card').count().catch(() => 0)
    if (!noMatchesVisible && resultsButtons === 0) {
      // Try a more generic heuristic: any card-like result (class "card" within results list)
      const anyCard = await page.locator('.card').count().catch(() => 0)
      if (anyCard === 0) {
        throw new Error('Discover results container did not render')
      }
    }
  }
  return { ok: true }
}

async function runRecruitingSearches(page, domain, iterations = 10) {
  // Navigate to app root and open "Recruiting" tab
  await page.goto(new URL('/', domain).toString(), { waitUntil: 'domcontentloaded' })
  await page.getByText(/Build:/, { exact: false }).waitFor({ timeout: 15000 })

  try {
    await page.getByRole('button', { name: 'Recruiting' }).click({ timeout: 8000 })
  } catch {
    // Fallback: open mobile menu first
    try {
      await page.getByRole('button', { name: 'More' }).click({ timeout: 8000 })
      await page.getByRole('button', { name: 'Recruiting' }).click({ timeout: 8000 })
    } catch (e) {
      // If recruiting is protected and redirects to login, treat as failure
      throw new Error('Recruiting route not accessible (auth required?)')
    }
  }

  // Wait for Explore panel headline to be present (or any recruiting marker)
  const exploreMarker = await page.getByText('Explore (Map)').first()
  await exploreMarker.waitFor({ timeout: 15000 })

  // The Explore panel triggers searches on map idle; perform gentle pans to trigger multiple
  // Identify the map container (PlacesMap renders a bordered div)
  const map = page.locator('div[style*="width: 100%"]').locator('..') // parent wrapper
  for (let i = 0; i < iterations; i++) {
    // Trigger idle by minor mouse movements if map is interactable
    try {
      const box = await map.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + 20 * ((i % 2) ? 1 : -1), box.y + box.height / 2 + 10)
        await page.mouse.up()
      }
    } catch {}
    // Allow search to run and render
    await page.waitForTimeout(800)
    // Assert no obvious error UI surfaced
    const errVisible =
      (await page.getByText(/Search failed/i).count()) +
      (await page.getByText(/Google Places not available/i).count())
    if (errVisible > 0) {
      throw new Error('Recruiting Explore showed an error UI')
    }
    // Either a list item exists or the list says "No results yet." before user login
    const anyListItem = await page.locator('button:has(.font-medium)').count().catch(() => 0)
    const noResultsYet = await page.getByText(/No results yet|No results found/i).isVisible().catch(() => false)
    if (anyListItem === 0 && !noResultsYet) {
      // Still allow if user must be logged in for full features, but ensure UI is stable (no crashes)
      // Check the page is still responsive by ensuring the Explore marker is visible
      const vis = await exploreMarker.isVisible().catch(() => false)
      if (!vis) throw new Error('Recruiting UI unstable')
    }
  }
  return { ok: true }
}

async function runDebugHarness(page, domain) {
  // This page is only available when diagnostics are enabled
  const url = new URL('/debug/discover-recruiting', domain).toString()
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' })
  const status = res?.status() ?? 0
  if (!status || status >= 400) {
    throw new Error(`Debug page not reachable (${status})`)
  }

  const header = page.getByText('Debug: Discover & Recruiting Harness')
  const visible = await header.isVisible().catch(() => false)
  if (!visible) throw new Error('Debug harness UI not rendered (enable VITE_DIAGNOSTICS)')

  // Helper function to extract failure rate from testid
  async function readFailureRate(testid) {
    try {
      const element = page.locator(`[data-testid="${testid}"]`)
      const count = await element.count()
      if (count === 0) {
        throw new Error(`HARNESS_SCHEMA_MISMATCH: Missing testid ${testid}`)
      }
      const text = await element.first().innerText()
      if (text === '—' || text.trim() === '') {
        return 0
      }
      const percent = parseInt(text.replace(/\D+/g, ''), 10) || 0
      return percent / 100
    } catch (e) {
      if (e.message && e.message.includes('HARNESS_SCHEMA_MISMATCH')) {
        throw e
      }
      throw new Error(`HARNESS_SCHEMA_MISMATCH: Failed to read testid ${testid}: ${e.message || e}`)
    }
  }

  // Helper function to determine which testid to use based on current target
  async function getCurrentFailureRateTestid() {
    const select = page.locator('select')
    const value = await select.inputValue().catch(() => 'discover')
    return value === 'recruiting' ? 'recruiting-failure-rate' : 'discover-failure-rate'
  }

  // Run 50 sequential
  await page.getByRole('button', { name: 'Run 50 sequential' }).click()
  await page.waitForFunction(() => {
    const el = document.querySelector('div:has(> .grid)') // summary wrapper exists; rough gate
    return Boolean(el)
  }, { timeout: 60000 }).catch(() => {})
  // Give time to finish (sequential can be slow depending on APIs)
  await page.waitForTimeout(2000)
  const seqTestid = await getCurrentFailureRateTestid()
  const seqFailRate = await readFailureRate(seqTestid)
  if (seqFailRate > 0.05) {
    throw new Error(`Sequential failure rate too high: ${(seqFailRate * 100).toFixed(1)}%`)
  }

  // Run 20 concurrent
  await page.getByRole('button', { name: 'Run 20 concurrent' }).click()
  await page.waitForTimeout(4000)
  const concTestid = await getCurrentFailureRateTestid()
  const concFailRate = await readFailureRate(concTestid)
  if (concFailRate > 0.05) {
    throw new Error(`Concurrent failure rate too high: ${(concFailRate * 100).toFixed(1)}%`)
  }
  return { ok: true }
}

async function verifyDomain(domain, browser) {
  const result = {
    domain,
    httpOk: false,
    buildOk: false,
    discoverOk: false,
    recruitingOk: false,
    debugOk: false
  }
  try {
    const baseCheck = await assertBuildHeaderPresent(domain)
    result.httpOk = baseCheck.ok
    result.buildOk = baseCheck.hasBuild === true
  } catch {
    // leave flags as false
  }

  const context = await browser.newContext({
    userAgent: 'verify-domains/1.0 (+playwright)',
    viewport: { width: 1360, height: 820 },
    ignoreHTTPSErrors: true
  })
  const page = await context.newPage()
  try {
    // Try Discover
    await page.goto(domain, { waitUntil: 'domcontentloaded' })
    await runDiscoverSearches(page, domain, 10)
    result.discoverOk = true
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[${domain}] Discover check failed:`, e?.message || e)
  }

  try {
    // Try Recruiting
    await page.goto(domain, { waitUntil: 'domcontentloaded' })
    await runRecruitingSearches(page, domain, 10)
    result.recruitingOk = true
  } catch (e) {
    console.error(`[${domain}] Recruiting check failed:`, e?.message || e)
  }

  try {
    await runDebugHarness(page, domain)
    result.debugOk = true
  } catch (e) {
    console.error(`[${domain}] Debug harness failed:`, e?.message || e)
  }

  await context.close()
  return result
}

async function main() {
  const domains = parseDomainsFromEnv()
  const headless = process.env.HEADFUL ? false : true
  const browser = await chromium.launch({ headless })
  const results = []
  let anyFail = false
  for (const d of domains) {
    const r = await verifyDomain(d, browser)
    results.push([
      d,
      r.httpOk ? 'PASS' : 'FAIL',
      r.buildOk ? 'PASS' : 'FAIL',
      r.discoverOk ? 'PASS' : 'FAIL',
      r.recruitingOk ? 'PASS' : 'FAIL',
      r.debugOk ? 'PASS' : 'FAIL'
    ])
    if (!r.httpOk || !r.buildOk || !r.discoverOk || !r.recruitingOk || !r.debugOk) {
      anyFail = true
    }
  }
  await browser.close()

  console.log('\nProduction Domains Verification\n')
  console.log(formatTable(results))
  console.log('')
  if (anyFail) {
    process.exitCode = 1
  }
}

// Run
main().catch((e) => {
  console.error('Fatal error in verifier:', e)
  process.exit(1)
})

