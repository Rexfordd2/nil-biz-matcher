#!/usr/bin/env node
/**
 * Local verification script for vercel dev
 * 
 * Starts vercel dev on port 3000, validates:
 * - GET / returns 200
 * - POST /api/waitlist returns { ok: true, status: <string> }
 * 
 * Always shuts down the dev server and exits with proper code.
 */
import { spawn } from 'node:child_process'

const BASE_URL = 'http://127.0.0.1:3000'
const STARTUP_TIMEOUT_MS = 60000 // 60s for vercel dev to start
const REQUEST_TIMEOUT_MS = 10000 // 10s per request
const TEST_EMAIL = 'verify-vercel@example.com'

let vercelProcess = null
let exitCode = 0

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

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
 * Poll URL until it returns 200 or timeout
 */
async function waitForServer(url, timeoutMs) {
	const startTime = Date.now()
	let lastError = null
	
	while (Date.now() - startTime < timeoutMs) {
		try {
			const res = await fetchWithTimeout(url, {}, 5000)
			if (res.ok) {
				console.log(`✅ Server is ready at ${url}`)
				return true
			}
			lastError = `HTTP ${res.status}`
		} catch (err) {
			lastError = err.message
		}
		
		// Wait 2s between polls
		await sleep(2000)
	}
	
	console.error(`❌ Server did not become ready within ${timeoutMs}ms`)
	console.error(`   Last error: ${lastError}`)
	return false
}

/**
 * Test GET / endpoint
 */
async function testHomepage() {
	console.log('\n[TEST] GET /')
	try {
		const res = await fetchWithTimeout(BASE_URL)
		if (!res.ok) {
			console.error(`❌ GET / failed: HTTP ${res.status}`)
			return false
		}
		console.log(`✅ GET / returned ${res.status}`)
		return true
	} catch (err) {
		console.error(`❌ GET / error: ${err.message}`)
		return false
	}
}

/**
 * Test POST /api/waitlist endpoint
 */
async function testWaitlistEndpoint() {
	console.log('\n[TEST] POST /api/waitlist')
	try {
		const res = await fetchWithTimeout(`${BASE_URL}/api/waitlist`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				email: TEST_EMAIL
			})
		})
		
		if (!res.ok) {
			console.error(`❌ POST /api/waitlist failed: HTTP ${res.status}`)
			const text = await res.text()
			console.error(`   Response: ${text.substring(0, 200)}`)
			return false
		}
		
		const data = await res.json()
		console.log(`   Response: ${JSON.stringify(data)}`)
		
		// Validate response structure
		if (data.ok !== true) {
			console.error(`❌ Response missing ok: true`)
			return false
		}
		
		if (typeof data.status !== 'string' || data.status.length === 0) {
			console.error(`❌ Response missing valid status string`)
			return false
		}
		
		console.log(`✅ POST /api/waitlist returned { ok: true, status: "${data.status}" }`)
		return true
	} catch (err) {
		console.error(`❌ POST /api/waitlist error: ${err.message}`)
		return false
	}
}

/**
 * Kill the vercel dev process
 */
function killVercelProcess() {
	if (!vercelProcess || vercelProcess.killed) {
		return
	}
	
	console.log('\n[CLEANUP] Shutting down vercel dev...')
	
	try {
		// Try SIGINT first (Ctrl+C equivalent)
		vercelProcess.kill('SIGINT')
		
		// Give it 5s to shut down gracefully
		const killTimeout = setTimeout(() => {
			if (!vercelProcess.killed) {
				console.log('[CLEANUP] SIGINT failed, sending SIGTERM...')
				vercelProcess.kill('SIGTERM')
				
				// Last resort after 2s
				setTimeout(() => {
					if (!vercelProcess.killed) {
						console.log('[CLEANUP] SIGTERM failed, sending SIGKILL...')
						vercelProcess.kill('SIGKILL')
					}
				}, 2000)
			}
		}, 5000)
		
		vercelProcess.on('exit', () => {
			clearTimeout(killTimeout)
			console.log('✅ vercel dev shut down')
		})
	} catch (err) {
		console.error(`[CLEANUP] Error killing process: ${err.message}`)
	}
}

/**
 * Main verification function
 */
async function main() {
	console.log('=== Vercel Dev Local Verification ===\n')
	console.log(`Base URL: ${BASE_URL}`)
	console.log(`Test email: ${TEST_EMAIL}`)
	
	try {
		// Start vercel dev
		console.log('\n[START] Starting vercel dev --listen 3000 --yes')
		vercelProcess = spawn('npx', ['vercel', 'dev', '--listen', '3000', '--yes'], {
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: true
		})
		
		// Collect output for debugging
		let stdoutData = ''
		let stderrData = ''
		
		vercelProcess.stdout.on('data', (data) => {
			const text = data.toString()
			stdoutData += text
			// Only show important lines
			if (text.includes('Ready') || text.includes('Error') || text.includes('error')) {
				process.stdout.write(text)
			}
		})
		
		vercelProcess.stderr.on('data', (data) => {
			const text = data.toString()
			stderrData += text
			// Show errors
			if (text.includes('Error') || text.includes('error') || text.includes('WARN')) {
				process.stderr.write(text)
			}
		})
		
		vercelProcess.on('error', (err) => {
			console.error(`❌ Failed to start vercel dev: ${err.message}`)
			exitCode = 1
		})
		
		vercelProcess.on('exit', (code, signal) => {
			if (code !== 0 && code !== null && !signal) {
				console.error(`❌ vercel dev exited with code ${code}`)
				if (stdoutData || stderrData) {
					console.error('\n--- vercel dev output ---')
					console.error(stdoutData)
					console.error(stderrData)
					console.error('--- end output ---\n')
				}
			}
		})
		
		// Wait for server to be ready
		console.log(`[WAIT] Polling ${BASE_URL} (timeout: ${STARTUP_TIMEOUT_MS}ms)`)
		const serverReady = await waitForServer(BASE_URL, STARTUP_TIMEOUT_MS)
		if (!serverReady) {
			console.error('\n❌ Server failed to start')
			console.error('\n--- vercel dev output ---')
			console.error(stdoutData)
			console.error(stderrData)
			console.error('--- end output ---')
			exitCode = 1
			return
		}
		
		// Run tests
		const homepageOk = await testHomepage()
		const waitlistOk = await testWaitlistEndpoint()
		
		// Determine exit code
		if (!homepageOk || !waitlistOk) {
			exitCode = 1
			console.error('\n❌ Verification FAILED')
		} else {
			console.log('\n✅ All verifications PASSED')
		}
		
	} catch (err) {
		console.error(`\n❌ Unexpected error: ${err.message}`)
		console.error(err.stack)
		exitCode = 1
	} finally {
		// Always cleanup
		killVercelProcess()
		
		// Give it a moment to clean up before exiting
		await sleep(2000)
		
		console.log(`\n=== Exiting with code ${exitCode} ===`)
		process.exit(exitCode)
	}
}

// Handle Ctrl+C
process.on('SIGINT', () => {
	console.log('\n[SIGINT] Received interrupt signal')
	killVercelProcess()
	process.exit(130)
})

process.on('SIGTERM', () => {
	console.log('\n[SIGTERM] Received termination signal')
	killVercelProcess()
	process.exit(143)
})

main()
