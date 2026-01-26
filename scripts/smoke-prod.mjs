#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const BASE_URL = process.env.BASE_URL || 'https://athlete-ledger.vercel.app'
const SMOKE_EMAIL = process.env.SMOKE_EMAIL
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD
const ARTIFACTS_DIR = './smoke-artifacts'

if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
	console.error('\n❌ ERROR: Missing required environment variables')
	console.error('   SMOKE_EMAIL and SMOKE_PASSWORD must be set to run smoke tests')
	console.error('   Example:')
	console.error('     $env:SMOKE_EMAIL="test@example.com"')
	console.error('     $env:SMOKE_PASSWORD="password123"')
	console.error('     npm run smoke:prod\n')
	process.exit(1)
}

console.log(`\n🧪 Production Smoke Tests`)
console.log(`📍 Testing: ${BASE_URL}`)
console.log(`👤 Email: ${SMOKE_EMAIL}\n`)

try {
	// Run Playwright tests
	execSync(
		`npx playwright test tests/smoke-prod.spec.ts --config=playwright.config.ts`,
		{ 
			stdio: 'inherit',
			env: { ...process.env, BASE_URL, SMOKE_EMAIL, SMOKE_PASSWORD }
		}
	)
	
	// Check for screenshots
	const discoverScreenshot = join(ARTIFACTS_DIR, 'discover-authed.png')
	const recruitingScreenshot = join(ARTIFACTS_DIR, 'recruiting-authed.png')
	
	console.log(`\n✅ PASS: All smoke tests completed successfully`)
	console.log(`\n📸 Screenshots:`)
	if (existsSync(discoverScreenshot)) {
		console.log(`   • Discover: ${discoverScreenshot}`)
	}
	if (existsSync(recruitingScreenshot)) {
		console.log(`   • Recruiting: ${recruitingScreenshot}`)
	}
	console.log()
	process.exit(0)
} catch (error) {
	console.log(`\n❌ FAIL: Smoke tests failed`)
	const discoverScreenshot = join(ARTIFACTS_DIR, 'discover-authed.png')
	const recruitingScreenshot = join(ARTIFACTS_DIR, 'recruiting-authed.png')
	console.log(`\n📸 Screenshots:`)
	if (existsSync(discoverScreenshot)) {
		console.log(`   • Discover: ${discoverScreenshot}`)
	}
	if (existsSync(recruitingScreenshot)) {
		console.log(`   • Recruiting: ${recruitingScreenshot}`)
	}
	console.log()
	process.exit(1)
}
