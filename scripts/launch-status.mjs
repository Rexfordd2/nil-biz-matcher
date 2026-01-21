#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Generate LAUNCH_STATUS.md with overall launch readiness status.
 * 
 * Collects data from:
 * - verify:prod (domain/build consistency)
 * - debug harness (failureRate + inconsistencyRate)
 * - /healthz endpoint (buildId, timestamp, env presence)
 * 
 * Outputs:
 * - Overall status: PASS/WARN/FAIL
 * - Blocking issues
 * - Non-blocking issues
 * - BuildId and timestamp
 * - Recommended next action
 * 
 * Hardened requirements:
 * - MUST fail if no DOMAINS and VERCEL_TOKEN auto-discovery fails
 * - MUST fail if verify:prod fails to run or returns no table
 * - MUST fail if /healthz is unreachable on primary domain
 * - MUST fail if verify:prod shows ANY domain mismatch or failure
 * - MUST fail if buildId in header does not match /healthz buildId
 * - Harness metrics are optional but downgrade to WARN if unavailable
 * - --strict mode requires harness metrics (FAIL if unavailable)
 */

import 'dotenv/config'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { redactSecrets } from './redactSecrets.mjs'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Timeout for HTTP requests (ms)
const DEFAULT_TIMEOUT_MS = 30000

/**
 * Parse command line arguments
 */
function parseArgs() {
	const args = process.argv.slice(2)
	const strict = args.includes('--strict')
	return { strict }
}

/**
 * Select a deterministic primary domain from a list of domains.
 * Rules:
 * 1) Prefer a custom production domain (not *.vercel.app) if available.
 * 2) If multiple custom domains exist, choose the first sorted alphabetically.
 * 3) If no custom domains exist, fall back to the first vercel.app domain (sorted alphabetically).
 */
function selectPrimaryDomain(domains) {
	if (domains.length === 0) {
		return null
	}
	
	// Separate custom domains from vercel.app domains
	const customDomains = []
	const vercelDomains = []
	
	for (const domain of domains) {
		try {
			const url = new URL(domain)
			const hostname = url.hostname
			if (hostname.endsWith('.vercel.app')) {
				vercelDomains.push(domain)
			} else {
				customDomains.push(domain)
			}
		} catch {
			// Invalid URL, skip
			continue
		}
	}
	
	// Prefer custom domains, sorted alphabetically
	if (customDomains.length > 0) {
		customDomains.sort()
		return customDomains[0]
	}
	
	// Fall back to vercel.app domains, sorted alphabetically
	if (vercelDomains.length > 0) {
		vercelDomains.sort()
		return vercelDomains[0]
	}
	
	// Fallback: return first domain if classification failed
	return domains[0]
}

/**
 * Parse domains from env (same logic as verify-all-domains.mjs)
 * MUST fail (exit 1) if no DOMAINS provided AND VERCEL_TOKEN auto-discovery fails
 */
async function parseDomainsFromEnv() {
	const raw = process.env.DOMAINS || ''
	let list = raw
		.split(',')
		.map(s => s.trim())
		.filter(Boolean)
	
	let autoDiscoveryAttempted = false
	let autoDiscoveryFailed = false
	
	if (list.length === 0 && process.env.VERCEL_TOKEN) {
		autoDiscoveryAttempted = true
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
			} else {
				autoDiscoveryFailed = true
			}
		} catch (e) {
			console.error('Auto-discovery failed:', e?.message || e)
			autoDiscoveryFailed = true
		}
	}
	
	// Requirement: MUST fail if no domains and auto-discovery failed
	if (list.length === 0) {
		if (autoDiscoveryAttempted && autoDiscoveryFailed) {
			console.error('ERROR: No DOMAINS provided AND VERCEL_TOKEN auto-discovery failed.')
			console.error('Either set DOMAINS env var or ensure VERCEL_TOKEN is valid.')
			console.error('Example: DOMAINS="https://your-domain.com" npm run launch:status')
			process.exit(1)
		}
		console.error('DOMAINS env var is required, or set VERCEL_TOKEN for auto-discovery.')
		console.error('Example: DOMAINS="https://your-domain.com" npm run launch:status')
		process.exit(1)
	}
	
	for (const d of list) {
		try {
			new URL(d)
		} catch {
			console.error(`Invalid URL in DOMAINS: ${d}`)
			process.exit(1)
		}
	}
	return list
}

/**
 * Fetch /healthz endpoint
 */
async function fetchHealthz(domain, timeoutMs = DEFAULT_TIMEOUT_MS) {
	const url = new URL('/healthz', domain).toString()
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)
	
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: { Accept: 'application/json' }
		})
		if (!res.ok) {
			return { ok: false, error: `HTTP_${res.status}`, data: null }
		}
		const data = await res.json()
		return { ok: true, error: null, data }
	} catch (e) {
		const error = e.name === 'AbortError' ? 'TIMEOUT' : (e.message || 'FETCH_ERROR')
		return { ok: false, error, data: null }
	} finally {
		clearTimeout(timeout)
	}
}

/**
 * Extract buildId from homepage HTML header
 */
async function extractHeaderBuildId(domain, timeoutMs = DEFAULT_TIMEOUT_MS) {
	const url = new URL('/', domain).toString()
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)
	
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			redirect: 'follow',
			headers: { Accept: 'text/html' }
		})
		if (!res.ok) {
			return { ok: false, buildId: null, error: `HTTP_${res.status}` }
		}
		const html = await res.text()
		
		// Prioritize data-testid="client-build-id" (most stable)
		const clientBuildIdPattern = /data-testid=["']client-build-id["'][^>]*>([^<]+)/i
		const clientBuildIdMatch = html.match(clientBuildIdPattern)
		if (clientBuildIdMatch) {
			return { ok: true, buildId: clientBuildIdMatch[1].trim(), error: null }
		}
		
		// Fallback to data-testid="build-id"
		const testIdPattern = /data-testid=["']build-id["'][^>]*>([^<]+)/i
		const testIdMatch = html.match(testIdPattern)
		if (testIdMatch) {
			return { ok: true, buildId: testIdMatch[1].trim(), error: null }
		}
		
		// Fallback to "Build: {buildId}" pattern
		const buildPattern = /Build:\s*([^\s<]+)/i
		const buildMatch = html.match(buildPattern)
		if (buildMatch) {
			return { ok: true, buildId: buildMatch[1].trim(), error: null }
		}
		
		return { ok: false, buildId: null, error: 'BUILD_ID_NOT_FOUND' }
	} catch (e) {
		const error = e.name === 'AbortError' ? 'TIMEOUT' : (e.message || 'FETCH_ERROR')
		return { ok: false, buildId: null, error }
	} finally {
		clearTimeout(timeout)
	}
}

/**
 * Run verify:prod logic to get domain/build consistency results
 * MUST fail if script fails to run or returns no table
 */
async function runVerifyProd(domains) {
	const scriptPath = join(__dirname, 'verify-all-domains.mjs')
	try {
		const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
			env: { ...process.env, DOMAINS: domains.join(',') },
			timeout: 120000,
			windowsHide: true,
			maxBuffer: 1024 * 1024 * 10
		})
		
		// Parse the output to extract results
		const output = stdout + stderr
		const lines = output.split(/\r?\n/)
		
		const results = []
		let inTable = false
		for (const line of lines) {
			if (line.includes('Domain') && line.includes('buildId')) {
				inTable = true
				continue
			}
			if (inTable && line.includes('---')) {
				continue
			}
			if (inTable && line.trim()) {
				const parts = line.split(/\s{2,}/).filter(Boolean)
				if (parts.length >= 5) {
					results.push({
						domain: parts[0],
						buildId: parts[1],
						stableAcrossRuns: parts[2],
						headerMatches: parts[3],
						error: parts[4] || '-'
					})
				}
			}
		}
		
		// Requirement: MUST fail if verify:prod returns no table
		if (results.length === 0) {
			return {
				ok: false,
				error: 'VERIFY_PROD_NO_TABLE',
				results: [],
				uniqueBuildIds: [],
				buildIdMismatch: false,
				output
			}
		}
		
		const allPass = results.every(r => 
			r.buildId !== 'n/a' && 
			r.stableAcrossRuns === 'yes' && 
			r.headerMatches === 'yes'
		)
		
		const uniqueBuildIds = [...new Set(results.map(r => r.buildId).filter(id => id !== 'n/a'))]
		const buildIdMismatch = uniqueBuildIds.length > 1
		
		return {
			ok: allPass && !buildIdMismatch,
			results,
			uniqueBuildIds,
			buildIdMismatch,
			output
		}
	} catch (e) {
		// Requirement: MUST fail if verify:prod fails to run
		return {
			ok: false,
			error: e.message || 'VERIFY_PROD_FAILED',
			results: [],
			uniqueBuildIds: [],
			buildIdMismatch: false,
			output: ''
		}
	}
}

/**
 * Extract debug harness metrics using Playwright
 * Uses data-testid markers for robust scraping
 */
async function extractDebugHarnessMetrics(domain, strictMode = false) {
	let playwright = null
	try {
		playwright = await import('playwright')
	} catch (e) {
		return { ok: false, error: 'PLAYWRIGHT_NOT_AVAILABLE', metrics: null, schemaMismatch: false, debugGated: false }
	}
	
	let browser = null
	try {
		browser = await playwright.chromium.launch({ headless: true })
		const page = await browser.newPage()
		
		const url = new URL('/debug/discover-recruiting', domain).toString()
		const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
		
		if (!res || res.status() >= 400) {
			return { ok: false, error: 'DEBUG_HARNESS_NOT_ACCESSIBLE', metrics: null, schemaMismatch: false, debugGated: false }
		}
		
		// Wait for page to be ready (network idle)
		await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
		
		// Check if debug route is gated (shows Home page instead of debug page)
		// Debug page should have "Debug: Discover & Recruiting Harness" text
		const debugHeaderVisible = await page.locator('text=Debug: Discover & Recruiting Harness').isVisible({ timeout: 2000 }).catch(() => false)
		
		if (!debugHeaderVisible) {
			// Debug route is gated - shows Home page instead
			return { ok: false, error: 'DEBUG_GATED', metrics: null, schemaMismatch: false, debugGated: true }
		}
		
		// Helper function to check if testid exists
		async function testidExists(testid) {
			try {
				const element = page.locator(`[data-testid="${testid}"]`)
				const count = await element.count()
				return count > 0
			} catch {
				return false
			}
		}
		
		// Helper function to extract metric from testid
		async function extractMetric(testid) {
			try {
				const element = page.locator(`[data-testid="${testid}"]`)
				const count = await element.count()
				if (count === 0) {
					return { found: false, value: null }
				}
				const text = await element.first().innerText()
				// Parse percentage (e.g., "5%" or "—")
				if (text === '—' || text.trim() === '') {
					return { found: true, value: 0 }
				}
				const percent = parseInt(text.replace(/\D+/g, ''), 10) || 0
				return { found: true, value: percent / 100 }
			} catch (e) {
				return { found: false, value: null }
			}
		}
		
		// Helper function to extract raw metrics JSON from testid
		async function extractRawMetricsJson() {
			try {
				const element = page.locator(`[data-testid="harness-raw-metrics-json"]`)
				const count = await element.count()
				if (count === 0) {
					return { found: false, value: null }
				}
				const text = await element.first().innerText()
				if (!text || text.trim() === '') {
					return { found: true, value: null }
				}
				try {
					const parsed = JSON.parse(text)
					return { found: true, value: parsed }
				} catch {
					return { found: true, value: null }
				}
			} catch (e) {
				return { found: false, value: null }
			}
		}
		
		// Run discover tests
		// Set target to discover
		await page.selectOption('select', 'discover')
		await page.waitForTimeout(500)
		
		// Run 50 sequential for discover
		await page.getByRole('button', { name: 'Run 50 sequential' }).click()
		await page.waitForFunction(() => {
			const el = document.querySelector('div:has(> .grid)')
			return Boolean(el)
		}, { timeout: 60000 }).catch(() => {})
		await page.waitForTimeout(3000)
		
		// Extract discover metrics using testids ONLY
		const discoverFailureRate = await extractMetric('discover-failure-rate')
		const discoverInconsistencyRate = await extractMetric('discover-inconsistency-rate')
		
		// Run recruiting tests
		// Set target to recruiting
		await page.selectOption('select', 'recruiting')
		await page.waitForTimeout(500)
		
		// Run 50 sequential for recruiting
		await page.getByRole('button', { name: 'Run 50 sequential' }).click()
		await page.waitForFunction(() => {
			const el = document.querySelector('div:has(> .grid)')
			return Boolean(el)
		}, { timeout: 60000 }).catch(() => {})
		await page.waitForTimeout(3000)
		
		// Extract recruiting metrics using testids ONLY
		const recruitingFailureRate = await extractMetric('recruiting-failure-rate')
		const recruitingInconsistencyRate = await extractMetric('recruiting-inconsistency-rate')
		
		// Extract raw metrics JSON using testid
		const rawMetricsJson = await extractRawMetricsJson()
		
		// Check for missing testids - ALL required testids must be present
		const missingTestids = []
		if (!discoverFailureRate.found) missingTestids.push('discover-failure-rate')
		if (!discoverInconsistencyRate.found) missingTestids.push('discover-inconsistency-rate')
		if (!recruitingFailureRate.found) missingTestids.push('recruiting-failure-rate')
		if (!recruitingInconsistencyRate.found) missingTestids.push('recruiting-inconsistency-rate')
		if (!rawMetricsJson.found) missingTestids.push('harness-raw-metrics-json')
		
		if (missingTestids.length > 0) {
			const error = `HARNESS_SCHEMA_MISMATCH: Missing testids: ${missingTestids.join(', ')}`
			return {
				ok: false,
				error,
				metrics: null,
				schemaMismatch: true,
				debugGated: false
			}
		}
		
		// Use values from testids (prefer raw JSON if available, fallback to individual testids)
		let finalMetrics = {
			discoverFailureRate: discoverFailureRate.value,
			discoverInconsistencyRate: discoverInconsistencyRate.value,
			recruitingFailureRate: recruitingFailureRate.value,
			recruitingInconsistencyRate: recruitingInconsistencyRate.value
		}
		
		// If raw JSON is available and valid, use it as source of truth
		if (rawMetricsJson.found && rawMetricsJson.value) {
			const json = rawMetricsJson.value
			if (json.discover) {
				if (json.discover.failureRate !== undefined) finalMetrics.discoverFailureRate = json.discover.failureRate
				if (json.discover.inconsistencyRate !== undefined) finalMetrics.discoverInconsistencyRate = json.discover.inconsistencyRate
			}
			if (json.recruiting) {
				if (json.recruiting.failureRate !== undefined) finalMetrics.recruitingFailureRate = json.recruiting.failureRate
				if (json.recruiting.inconsistencyRate !== undefined) finalMetrics.recruitingInconsistencyRate = json.recruiting.inconsistencyRate
			}
		}
		
		return {
			ok: true,
			error: null,
			metrics: finalMetrics,
			rawMetricsJson: rawMetricsJson.value,
			schemaMismatch: false,
			debugGated: false
		}
	} catch (e) {
		return {
			ok: false,
			error: e.message || 'PLAYWRIGHT_ERROR',
			metrics: null,
			schemaMismatch: false,
			debugGated: false
		}
	} finally {
		if (browser) {
			await browser.close()
		}
	}
}

/**
 * Determine overall status and issues
 * Hardened rules:
 * - FAIL if verify:prod failed OR no parseable results OR domain failures OR buildId mismatches
 * - FAIL if /healthz failed OR missing buildId
 * - FAIL if header buildId doesn't match /healthz buildId
 * - WARN if harness unavailable (unless --strict mode)
 * - PASS only if all critical checks pass AND harness available (unless strict disabled)
 * - FAIL in --strict mode if debug is gated (unless ALLOW_STRICT_WITHOUT_DEBUG=true)
 */
function analyzeStatus(verifyProd, debugHarness, healthz, headerBuildId, strictMode, allowStrictWithoutDebug = false) {
	const blockingIssues = []
	const nonBlockingIssues = []
	
	// Rule 1: FAIL if verify:prod did not run successfully OR produced no parseable results
	if (!verifyProd.ok) {
		if (verifyProd.error === 'VERIFY_PROD_NO_TABLE') {
			blockingIssues.push('verify:prod failed to return a results table')
		} else if (verifyProd.error === 'VERIFY_PROD_FAILED') {
			blockingIssues.push(`verify:prod script failed to run: ${verifyProd.error}`)
		} else {
			blockingIssues.push(`verify:prod failed: ${verifyProd.error || 'Unknown error'}`)
		}
	}
	
	// Rule 1: FAIL if verify:prod has no parseable results (even if ok flag is true)
	if (verifyProd.ok && (!verifyProd.results || verifyProd.results.length === 0)) {
		blockingIssues.push('verify:prod produced no parseable results')
	}
	
	// Rule 1: FAIL if any domain failed OR buildId mismatch across domains
	if (verifyProd.ok && verifyProd.results && verifyProd.results.length > 0) {
		if (verifyProd.buildIdMismatch) {
			blockingIssues.push(`BuildId mismatch across domains: ${verifyProd.uniqueBuildIds.join(', ')}`)
		}
		const failedDomains = verifyProd.results.filter(r => 
			r.buildId === 'n/a' || r.stableAcrossRuns !== 'yes' || r.headerMatches !== 'yes'
		)
		if (failedDomains.length > 0) {
			blockingIssues.push(`${failedDomains.length} domain(s) failed verification`)
			failedDomains.forEach(d => {
				if (d.error && d.error !== '-') {
					blockingIssues.push(`  - ${d.domain}: ${d.error}`)
				} else {
					blockingIssues.push(`  - ${d.domain}: buildId=${d.buildId}, stable=${d.stableAcrossRuns}, headerMatches=${d.headerMatches}`)
				}
			})
		}
	}
	
	// Rule 1: FAIL if /healthz fetch failed
	if (!healthz.ok) {
		blockingIssues.push(`/healthz endpoint not accessible: ${healthz.error}`)
	}
	
	// Rule 1: FAIL if /healthz returned missing buildId
	if (healthz.ok && healthz.data) {
		if (!healthz.data.buildId || healthz.data.buildId === 'unknown' || healthz.data.buildId === '') {
			blockingIssues.push('/healthz returned missing or invalid buildId')
		}
	}
	
	// Rule 1: FAIL if header buildId does not match /healthz buildId
	if (healthz.ok && healthz.data && healthz.data.buildId && healthz.data.buildId !== 'unknown') {
		if (headerBuildId.ok && headerBuildId.buildId) {
			const healthzBuildId = healthz.data.buildId
			const headerBuildIdValue = headerBuildId.buildId
			if (healthzBuildId !== headerBuildIdValue) {
				blockingIssues.push(`BuildId mismatch: /healthz reports "${healthzBuildId}" but header shows "${headerBuildIdValue}"`)
			}
		} else {
			// Header buildId extraction failed but /healthz succeeded
			blockingIssues.push(`Failed to extract buildId from homepage header: ${headerBuildId.error || 'Unknown error'}`)
		}
	}
	
	// Debug harness checks
	if (debugHarness.ok && debugHarness.metrics) {
		const { discoverFailureRate, discoverInconsistencyRate, recruitingFailureRate, recruitingInconsistencyRate } = debugHarness.metrics
		
		// Check discover metrics
		if (discoverFailureRate > 0.10) {
			blockingIssues.push(`Discover failure rate too high: ${(discoverFailureRate * 100).toFixed(1)}% (threshold: 10%)`)
		} else if (discoverFailureRate > 0.05) {
			nonBlockingIssues.push(`Discover failure rate elevated: ${(discoverFailureRate * 100).toFixed(1)}% (threshold: 5%)`)
		}
		if (discoverInconsistencyRate !== null && discoverInconsistencyRate > 0.10) {
			blockingIssues.push(`Discover inconsistency rate too high: ${(discoverInconsistencyRate * 100).toFixed(1)}% (threshold: 10%)`)
		} else if (discoverInconsistencyRate !== null && discoverInconsistencyRate > 0.05) {
			nonBlockingIssues.push(`Discover inconsistency rate elevated: ${(discoverInconsistencyRate * 100).toFixed(1)}% (threshold: 5%)`)
		}
		
		// Check recruiting metrics
		if (recruitingFailureRate > 0.10) {
			blockingIssues.push(`Recruiting failure rate too high: ${(recruitingFailureRate * 100).toFixed(1)}% (threshold: 10%)`)
		} else if (recruitingFailureRate > 0.05) {
			nonBlockingIssues.push(`Recruiting failure rate elevated: ${(recruitingFailureRate * 100).toFixed(1)}% (threshold: 5%)`)
		}
		if (recruitingInconsistencyRate !== null && recruitingInconsistencyRate > 0.10) {
			blockingIssues.push(`Recruiting inconsistency rate too high: ${(recruitingInconsistencyRate * 100).toFixed(1)}% (threshold: 10%)`)
		} else if (recruitingInconsistencyRate !== null && recruitingInconsistencyRate > 0.05) {
			nonBlockingIssues.push(`Recruiting inconsistency rate elevated: ${(recruitingInconsistencyRate * 100).toFixed(1)}% (threshold: 5%)`)
		}
	} else {
		// Rule 2: WARN if harness metrics are unavailable (unless --strict mode)
		// Rule 4: FAIL in --strict mode if harness unavailable
		const harnessError = debugHarness.error || 'UNKNOWN'
		
		// Special handling for DEBUG_GATED error
		if (debugHarness.debugGated && harnessError === 'DEBUG_GATED') {
			if (strictMode) {
				if (allowStrictWithoutDebug) {
					// Fallback: allow strict mode to pass if flag is set
					nonBlockingIssues.push(`Debug route is gated (DEBUG_GATED) but ALLOW_STRICT_WITHOUT_DEBUG=true allows strict mode to pass`)
				} else {
					// In strict mode, fail with reason "DEBUG_GATED"
					blockingIssues.push(`DEBUG_GATED: Debug routes are intentionally gated in production (required in --strict mode). Set VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to enable access, or set ALLOW_STRICT_WITHOUT_DEBUG=true to allow strict mode without debug access.`)
				}
			} else {
				// Normal mode: warn but don't fail
				nonBlockingIssues.push(`DEBUG_GATED: Debug routes are gated in production. Set VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to enable access.`)
			}
		} else if (debugHarness.schemaMismatch) {
			// Schema mismatch: WARN in normal mode, FAIL in strict mode
			if (strictMode) {
				blockingIssues.push(`HARNESS_SCHEMA_MISMATCH (required in --strict mode): ${harnessError}`)
			} else {
				nonBlockingIssues.push(`HARNESS_SCHEMA_MISMATCH: ${harnessError}`)
			}
		} else {
			// Harness unavailable: WARN in normal mode, FAIL in strict mode
			if (strictMode) {
				blockingIssues.push(`Debug harness unavailable (required in --strict mode): ${harnessError}`)
			} else {
				nonBlockingIssues.push(`HARNESS_UNAVAILABLE: ${harnessError}`)
			}
		}
	}
	
	// Rule 2: WARN if env presence booleans show any missing non-critical config
	if (healthz.ok && healthz.data) {
		// buildId check already handled above as blocking
		// Check config presence
		if (healthz.data.configPresence) {
			const cp = healthz.data.configPresence
			// Check for missing critical config (non-blocking warnings)
			if (!cp.hasViteGoogleMapsApiKey && !cp.hasGoogleMapsServerKey) {
				nonBlockingIssues.push('GOOGLE_MAPS_API_KEY not set (business search may use fallback)')
			}
			if (!cp.hasViteSupabaseUrl) {
				nonBlockingIssues.push('VITE_SUPABASE_URL not set (Supabase client may not work)')
			}
			if (!cp.hasViteSupabaseAnonKey) {
				nonBlockingIssues.push('VITE_SUPABASE_ANON_KEY not set (Supabase client may not work)')
			}
		}
	}
	
	// Determine overall status
	// Rule 3: PASS only if all critical checks pass AND harness available (unless strict disabled)
	let overallStatus = 'PASS'
	
	// If any blocking issues, status is FAIL
	if (blockingIssues.length > 0) {
		overallStatus = 'FAIL'
	} else {
		// Check if harness is available and metrics are within acceptable thresholds (<= 10%)
		// Note: Metrics 5-10% are warnings (non-blocking), but still acceptable for PASS
		// Only metrics > 10% are blocking (FAIL)
		const harnessAvailable = debugHarness.ok && debugHarness.metrics
		const harnessWithinThresholds = harnessAvailable && 
			debugHarness.metrics.discoverFailureRate <= 0.10 &&
			(debugHarness.metrics.discoverInconsistencyRate === null || debugHarness.metrics.discoverInconsistencyRate <= 0.10) &&
			debugHarness.metrics.recruitingFailureRate <= 0.10 &&
			(debugHarness.metrics.recruitingInconsistencyRate === null || debugHarness.metrics.recruitingInconsistencyRate <= 0.10)
		
		// Rule 3: PASS requires:
		// - All critical checks pass (no blocking issues) ✓
		// - Harness metrics available AND within thresholds (unless strict mode disabled)
		// Special case: DEBUG_GATED with allowStrictWithoutDebug flag
		const isDebugGatedWithAllowance = debugHarness.debugGated && debugHarness.error === 'DEBUG_GATED' && strictMode && allowStrictWithoutDebug
		
		if (!harnessAvailable && !strictMode) {
			// Rule 2: WARN if harness unavailable (not strict mode)
			// Harness unavailable is already recorded as non-blocking issue
			overallStatus = 'WARN'
		} else if (!harnessAvailable && strictMode && !isDebugGatedWithAllowance) {
			// Rule 4: FAIL in strict mode if harness unavailable (unless DEBUG_GATED with allowance)
			// This should have been caught above as blocking issue, but double-check
			overallStatus = 'FAIL'
		} else if (harnessAvailable && !harnessWithinThresholds) {
			// Metrics exceed thresholds - should be caught as blocking issues above
			// But if somehow not, this is still a problem
			overallStatus = 'FAIL'
		} else if (nonBlockingIssues.length > 0) {
			// All critical checks pass, harness OK, but non-blocking issues exist
			overallStatus = 'WARN'
		} else {
			// All checks pass AND harness available and within thresholds (or strict disabled)
			overallStatus = 'PASS'
		}
	}
	
	return { overallStatus, blockingIssues, nonBlockingIssues }
}

/**
 * Generate recommended next action
 */
function getRecommendedAction(status, blockingIssues, nonBlockingIssues) {
	if (status === 'FAIL') {
		if (blockingIssues.some(i => i.includes('BuildId mismatch'))) {
			return 'Fix buildId consistency across domains by ensuring all deployments use the same build.'
		}
		if (blockingIssues.some(i => i.includes('domain(s) failed verification'))) {
			return 'Investigate and fix domain verification failures before proceeding with launch.'
		}
		if (blockingIssues.some(i => i.includes('failure rate'))) {
			return 'Investigate and fix high failure rates in debug harness before launch.'
		}
		if (blockingIssues.some(i => i.includes('DEBUG_GATED'))) {
			return 'Debug routes are gated in production (expected). In --strict mode, either enable debug access (set VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY) or set ALLOW_STRICT_WITHOUT_DEBUG=true to allow strict mode without debug access.'
		}
		if (blockingIssues.some(i => i.includes('harness unavailable'))) {
			return 'Debug harness is required in --strict mode. Ensure Playwright is installed and harness is accessible.'
		}
		return 'Address all blocking issues before proceeding with launch.'
	}
	if (status === 'WARN') {
		const hasHarnessUnavailable = nonBlockingIssues.some(i => i.startsWith('HARNESS_UNAVAILABLE'))
		if (hasHarnessUnavailable) {
			return 'Debug harness metrics unavailable. Review other issues and consider running with --strict mode for full validation.'
		}
		return 'Review non-blocking issues and address critical ones before launch.'
	}
	return 'All checks passed. Ready for launch.'
}


/**
 * Filter /healthz JSON to only include booleans + buildId/timestamp
 */
function filterHealthzPayload(data) {
	if (!data || typeof data !== 'object') {
		return {}
	}
	
	const filtered = {}
	
	// Always include buildId and timestamp
	if ('buildId' in data) {
		filtered.buildId = data.buildId
	}
	if ('timestamp' in data) {
		filtered.timestamp = data.timestamp
	}
	
	// Include all boolean values
	for (const [key, value] of Object.entries(data)) {
		if (typeof value === 'boolean') {
			filtered[key] = value
		}
		// Also include nested boolean objects (like envPresence)
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			const nestedBooleans = {}
			for (const [nestedKey, nestedValue] of Object.entries(value)) {
				if (typeof nestedValue === 'boolean') {
					nestedBooleans[nestedKey] = nestedValue
				}
			}
			if (Object.keys(nestedBooleans).length > 0) {
				filtered[key] = nestedBooleans
			}
		}
	}
	
	return filtered
}

/**
 * Generate LAUNCH_STATUS.md content
 */
function generateMarkdown(status, verifyProd, debugHarness, healthz, headerBuildId, blockingIssues, nonBlockingIssues, recommendedAction, primaryDomain, proofData) {
	const buildId = healthz.data?.buildId || 'unknown'
	const timestamp = healthz.data?.timestamp || new Date().toISOString()
	const reportTimestamp = proofData?.reportTimestamp || new Date().toISOString()
	
	let md = `# Launch Status Report\n\n`
	md += `**Generated:** ${reportTimestamp}\n\n`
	md += `## Overall Status: ${status === 'PASS' ? '✅ PASS' : status === 'WARN' ? '⚠️ WARN' : '❌ FAIL'}\n\n`
	
	md += `### Build Information\n`
	md += `- **Primary Domain:** ${primaryDomain}\n`
	md += `- **BuildId:** ${buildId}\n`
	md += `- **Timestamp:** ${timestamp}\n`
	if (headerBuildId.ok && headerBuildId.buildId) {
		md += `- **Header BuildId:** ${headerBuildId.buildId}\n`
		if (healthz.ok && healthz.data && healthz.data.buildId !== headerBuildId.buildId) {
			md += `- **⚠️ BuildId Mismatch:** Header (${headerBuildId.buildId}) ≠ /healthz (${healthz.data.buildId})\n`
		}
	}
	md += `\n`
	
	if (healthz.data?.configPresence) {
		md += `### Environment Variables (Presence)\n`
		Object.entries(healthz.data.configPresence).forEach(([key, present]) => {
			md += `- **${key}:** ${present ? '✅ Present' : '❌ Missing'}\n`
		})
		md += `\n`
	}
	
	if (blockingIssues.length > 0) {
		md += `## ❌ Blocking Issues\n\n`
		blockingIssues.forEach(issue => {
			md += `- ${issue}\n`
		})
		md += `\n`
	}
	
	if (nonBlockingIssues.length > 0) {
		md += `## ⚠️ Non-Blocking Issues\n\n`
		nonBlockingIssues.forEach(issue => {
			md += `- ${issue}\n`
		})
		md += `\n`
	}
	
	if (verifyProd.results.length > 0) {
		md += `### Domain Verification Results\n\n`
		md += `| Domain | BuildId | Stable | Header Matches | Error |\n`
		md += `|--------|---------|--------|----------------|-------|\n`
		verifyProd.results.forEach(r => {
			md += `| ${r.domain} | ${r.buildId} | ${r.stableAcrossRuns} | ${r.headerMatches} | ${r.error} |\n`
		})
		md += `\n`
	} else if (!verifyProd.ok && verifyProd.error) {
		md += `### Domain Verification Results\n\n`
		md += `**Error:** ${verifyProd.error}\n\n`
	}
	
	if (debugHarness.ok && debugHarness.metrics) {
		md += `### Debug Harness Metrics\n\n`
		const { discoverFailureRate, discoverInconsistencyRate, recruitingFailureRate, recruitingInconsistencyRate } = debugHarness.metrics
		md += `#### Discover\n`
		md += `- **Failure Rate:** ${(discoverFailureRate * 100).toFixed(2)}%\n`
		if (discoverInconsistencyRate !== null) {
			md += `- **Inconsistency Rate:** ${(discoverInconsistencyRate * 100).toFixed(2)}%\n`
		}
		md += `\n`
		md += `#### Recruiting\n`
		md += `- **Failure Rate:** ${(recruitingFailureRate * 100).toFixed(2)}%\n`
		if (recruitingInconsistencyRate !== null) {
			md += `- **Inconsistency Rate:** ${(recruitingInconsistencyRate * 100).toFixed(2)}%\n`
		}
		md += `\n`
	} else if (!debugHarness.ok) {
		md += `### Debug Harness\n\n`
		if (debugHarness.debugGated && debugHarness.error === 'DEBUG_GATED') {
			md += `- **Status:** DEBUG_GATED\n`
			md += `- **Note:** Debug routes are intentionally gated in production. Set VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to enable access. In --strict mode, this causes FAIL unless ALLOW_STRICT_WITHOUT_DEBUG=true is set.\n\n`
		} else if (debugHarness.schemaMismatch) {
			md += `- **Status:** HARNESS_SCHEMA_MISMATCH (${debugHarness.error})\n`
			md += `- **Note:** Expected data-testid markers are missing from the debug page\n\n`
		} else {
			md += `- **Status:** HARNESS_UNAVAILABLE (${debugHarness.error})\n`
			md += `- **Note:** Debug harness requires VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY to be accessible\n\n`
		}
	}
	
	md += `## Recommended Next Action\n\n`
	md += `${recommendedAction}\n\n`
	
	// PROOF section
	md += `## PROOF\n\n`
	
	// Exact command run
	if (proofData?.command) {
		md += `### Exact Command Run\n\n`
		md += `\`\`\`bash\n`
		md += `${proofData.command}\n`
		md += `\`\`\`\n\n`
	}
	
	// Timestamp of report generation
	md += `### Timestamp of Report Generation\n\n`
	md += `${reportTimestamp}\n\n`
	
	// Raw /healthz JSON payload (booleans only + buildId/timestamp)
	if (healthz.ok && healthz.data) {
		md += `### Raw /healthz JSON Payload (Booleans + buildId/timestamp)\n\n`
		const filteredHealthz = filterHealthzPayload(healthz.data)
		md += `\`\`\`json\n`
		md += `${JSON.stringify(filteredHealthz, null, 2)}\n`
		md += `\`\`\`\n\n`
	} else {
		md += `### Raw /healthz JSON Payload\n\n`
		md += `**Error:** ${healthz.error || 'Not available'}\n\n`
	}
	
	// Raw verify:prod table output
	if (verifyProd.output) {
		md += `### Raw verify:prod Table Output\n\n`
		md += `\`\`\`\n`
		md += `${verifyProd.output}\n`
		md += `\`\`\`\n\n`
	} else {
		md += `### Raw verify:prod Table Output\n\n`
		md += `**Error:** ${verifyProd.error || 'Not available'}\n\n`
	}
	
	// Harness raw metrics captured from debug page (as JSON)
	if (debugHarness.ok && debugHarness.metrics) {
		md += `### Harness Raw Metrics (from Debug Page)\n\n`
		md += `\`\`\`json\n`
		md += `${JSON.stringify(debugHarness.metrics, null, 2)}\n`
		md += `\`\`\`\n\n`
	} else {
		md += `### Harness Raw Metrics\n\n`
		md += `**Status:** ${debugHarness.error || 'Not available'}\n\n`
	}
	
	return md
}

/**
 * Main function
 */
async function main() {
	const { strict: strictMode } = parseArgs()
	const reportTimestamp = new Date().toISOString()
	
	// Parse ALLOW_STRICT_WITHOUT_DEBUG flag
	const allowStrictWithoutDebug = String(process.env.ALLOW_STRICT_WITHOUT_DEBUG || '').toLowerCase() === 'true'
	
	console.log('Generating launch status report...\n')
	if (strictMode) {
		console.log('Running in --strict mode (harness metrics required)\n')
		if (allowStrictWithoutDebug) {
			console.log('ALLOW_STRICT_WITHOUT_DEBUG=true: strict mode will pass even if debug routes are gated\n')
		}
	}
	
	// Capture command and environment variables for PROOF section
	const scriptPath = join(__dirname, 'launch-status.mjs')
	const args = process.argv.slice(2)
	const commandParts = [process.execPath, scriptPath, ...args]
	const command = commandParts.join(' ')
	
	// Collect relevant environment variables (redact secrets)
	const relevantEnvVars = {}
	const envVarNames = ['DOMAINS', 'VERCEL_TOKEN', 'GOOGLE_MAPS_API_KEY', 'VERCEL_GIT_COMMIT_SHA', 'NODE_ENV']
	for (const key of envVarNames) {
		if (process.env[key] !== undefined) {
			relevantEnvVars[key] = process.env[key]
		}
	}
	const redactedEnvVars = redactSecrets(relevantEnvVars)
	
	// Build command with env vars for PROOF section
	let proofCommand = command
	if (Object.keys(redactedEnvVars).length > 0) {
		const envPrefix = Object.entries(redactedEnvVars)
			.map(([key, value]) => `${key}="${value}"`)
			.join(' ')
		proofCommand = `${envPrefix} ${command}`
	}
	
	// Parse domains (will exit 1 if no domains and auto-discovery fails)
	const domains = await parseDomainsFromEnv()
	console.log(`Checking ${domains.length} domain(s): ${domains.join(', ')}\n`)
	
	// Select deterministic primary domain
	const primaryDomain = selectPrimaryDomain(domains)
	if (!primaryDomain) {
		console.error('ERROR: No valid primary domain could be selected')
		process.exit(1)
	}
	console.log(`Selected primary domain: ${primaryDomain}\n`)
	
	// Fetch healthz from first domain (MUST be reachable)
	console.log('Fetching /healthz endpoint...')
	const healthz = await fetchHealthz(primaryDomain)
	if (!healthz.ok) {
		console.error(`ERROR: /healthz check failed: ${healthz.error}`)
		// Will be caught by analyzeStatus and cause FAIL
	}
	
	// Extract buildId from header
	console.log('Extracting buildId from homepage header...')
	const headerBuildId = await extractHeaderBuildId(primaryDomain)
	if (!headerBuildId.ok) {
		console.error(`Warning: Failed to extract buildId from header: ${headerBuildId.error}`)
	}
	
	// Run verify:prod (MUST succeed and return table)
	console.log('Running domain/build consistency verification...')
	const verifyProd = await runVerifyProd(domains)
	if (!verifyProd.ok) {
		console.error(`ERROR: verify:prod failed: ${verifyProd.error}`)
		if (verifyProd.results.length === 0) {
			console.error('No results table returned from verify:prod')
		}
	}
	
	// Extract debug harness metrics (optional, but downgrades to WARN if unavailable)
	console.log('Extracting debug harness metrics...')
	const debugHarness = await extractDebugHarnessMetrics(primaryDomain, strictMode)
	if (!debugHarness.ok) {
		if (debugHarness.debugGated && debugHarness.error === 'DEBUG_GATED') {
			console.log(`Debug route is gated: ${debugHarness.error}`)
			if (strictMode && !allowStrictWithoutDebug) {
				console.error('ERROR: Debug route is gated but --strict mode requires it (set ALLOW_STRICT_WITHOUT_DEBUG=true to allow)')
			} else if (strictMode && allowStrictWithoutDebug) {
				console.log('INFO: Debug route is gated but ALLOW_STRICT_WITHOUT_DEBUG=true allows strict mode to pass')
			}
		} else {
			console.log(`Debug harness not accessible: ${debugHarness.error}`)
			if (strictMode) {
				console.error('ERROR: Harness unavailable but --strict mode requires it')
			}
		}
	}
	
	// Analyze status
	const { overallStatus, blockingIssues, nonBlockingIssues } = analyzeStatus(
		verifyProd,
		debugHarness,
		healthz,
		headerBuildId,
		strictMode,
		allowStrictWithoutDebug
	)
	const recommendedAction = getRecommendedAction(overallStatus, blockingIssues, nonBlockingIssues)
	
	// Prepare proof data
	const proofData = {
		command: proofCommand,
		reportTimestamp
	}
	
	// Generate markdown
	const markdown = generateMarkdown(
		overallStatus,
		verifyProd,
		debugHarness,
		healthz,
		headerBuildId,
		blockingIssues,
		nonBlockingIssues,
		recommendedAction,
		primaryDomain,
		proofData
	)
	
	// Write to file
	const outputPath = join(process.cwd(), 'LAUNCH_STATUS.md')
	const fs = await import('fs/promises')
	await fs.writeFile(outputPath, markdown, 'utf-8')
	
	console.log(`\n✅ Launch status report generated: ${outputPath}`)
	console.log(`\nOverall Status: ${overallStatus}`)
	if (blockingIssues.length > 0) {
		console.log(`\n❌ Blocking Issues: ${blockingIssues.length}`)
		blockingIssues.forEach(issue => console.log(`  - ${issue}`))
	}
	if (nonBlockingIssues.length > 0) {
		console.log(`\n⚠️  Non-Blocking Issues: ${nonBlockingIssues.length}`)
		nonBlockingIssues.forEach(issue => console.log(`  - ${issue}`))
	}
	console.log(`\nRecommended: ${recommendedAction}`)
	
	// Exit with appropriate code
	// Requirement: FAIL status MUST exit with code 1
	const exitCode = overallStatus === 'FAIL' ? 1 : 0
	console.log(`\nExit code: ${exitCode}`)
	process.exit(exitCode)
}

main().catch((e) => {
	console.error('Fatal error generating launch status:', e?.message || e)
	process.exit(1)
})
