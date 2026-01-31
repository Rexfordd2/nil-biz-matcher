#!/usr/bin/env node
/**
 * Smoke test for Vercel production deployments
 * 
 * Tests:
 * - GET / returns 200-399 (homepage accessible)
 * - POST /api/waitlist returns JSON with ok:true OR {ok:false, error:"..."} (not HTML, not 404)
 * 
 * Usage:
 *   DOMAIN=https://your-app.vercel.app npm run smoke:vercel:prod
 * 
 * PowerShell:
 *   $env:DOMAIN="https://your-app.vercel.app"; npm run smoke:vercel:prod
 */

const DOMAIN = process.env.DOMAIN
const REQUEST_TIMEOUT_MS = 10000 // 10s per request
const TEST_EMAIL = 'smoke-test@example.com'

let exitCode = 0

/**
 * Make HTTP request with timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)
	
	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal
		})
		clearTimeout(timeout)
		return response
	} catch (err) {
		clearTimeout(timeout)
		throw err
	}
}

/**
 * Test GET / endpoint
 */
async function testHomepage() {
	console.log('\n[TEST] GET /')
	try {
		const res = await fetchWithTimeout(DOMAIN)
		if (res.status < 200 || res.status >= 400) {
			console.error(`❌ FAIL: GET / returned HTTP ${res.status} (expected 200-399)`)
			return false
		}
		console.log(`✅ PASS: GET / returned ${res.status}`)
		return true
	} catch (err) {
		console.error(`❌ FAIL: GET / error: ${err.message}`)
		return false
	}
}

/**
 * Test POST /api/waitlist endpoint
 */
async function testWaitlistEndpoint() {
	console.log('\n[TEST] POST /api/waitlist')
	try {
		const res = await fetchWithTimeout(`${DOMAIN}/api/waitlist`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				email: TEST_EMAIL
			})
		})
		
		// Check Content-Type is JSON (not HTML)
		const contentType = res.headers.get('content-type') || ''
		if (!contentType.includes('application/json')) {
			console.error(`❌ FAIL: POST /api/waitlist returned Content-Type: ${contentType} (expected application/json)`)
			const text = await res.text()
			console.error(`   Response preview: ${text.substring(0, 200)}`)
			return false
		}
		
		// Reject 404 (function not found)
		if (res.status === 404) {
			console.error(`❌ FAIL: POST /api/waitlist returned 404 (function not deployed)`)
			return false
		}
		
		// Accept 200, 400 (validation error), or 503 (missing env)
		if (res.status !== 200 && res.status !== 400 && res.status !== 503) {
			console.error(`❌ FAIL: POST /api/waitlist returned HTTP ${res.status} (expected 200, 400, or 503)`)
			const text = await res.text()
			console.error(`   Response: ${text.substring(0, 200)}`)
			return false
		}
		
		// Validate JSON response
		let data
		try {
			data = await res.json()
		} catch (err) {
			console.error(`❌ FAIL: POST /api/waitlist did not return valid JSON`)
			console.error(`   Error: ${err.message}`)
			return false
		}
		
		// Validate response structure: must have "ok" field
		if (typeof data.ok !== 'boolean') {
			console.error(`❌ FAIL: POST /api/waitlist response missing "ok" field`)
			console.error(`   Response: ${JSON.stringify(data)}`)
			return false
		}
		
		// If ok: false, must have error field
		if (data.ok === false && !data.error) {
			console.error(`❌ FAIL: POST /api/waitlist returned ok:false without error field`)
			console.error(`   Response: ${JSON.stringify(data)}`)
			return false
		}
		
		console.log(`✅ PASS: POST /api/waitlist returned ${res.status} with valid JSON`)
		console.log(`   Response: ${JSON.stringify(data)}`)
		return true
	} catch (err) {
		console.error(`❌ FAIL: POST /api/waitlist error: ${err.message}`)
		return false
	}
}

/**
 * Main test function
 */
async function main() {
	console.log('=== Vercel Production Smoke Tests ===\n')
	
	// Validate DOMAIN is set
	if (!DOMAIN) {
		console.error('❌ ERROR: DOMAIN environment variable is required')
		console.error('   Example:')
		console.error('     DOMAIN=https://your-app.vercel.app npm run smoke:vercel:prod')
		console.error('   Or on Windows PowerShell:')
		console.error('     $env:DOMAIN="https://your-app.vercel.app"; npm run smoke:vercel:prod\n')
		process.exit(1)
	}
	
	console.log(`Target: ${DOMAIN}`)
	console.log(`Test email: ${TEST_EMAIL}`)
	
	try {
		// Run tests
		const homepageOk = await testHomepage()
		const waitlistOk = await testWaitlistEndpoint()
		
		// Determine exit code
		if (!homepageOk || !waitlistOk) {
			exitCode = 1
			console.error('\n❌ FAIL: Some tests failed')
		} else {
			console.log('\n✅ PASS: All tests passed')
		}
		
	} catch (err) {
		console.error(`\n❌ FAIL: Unexpected error: ${err.message}`)
		console.error(err.stack)
		exitCode = 1
	}
	
	process.exit(exitCode)
}

main()
