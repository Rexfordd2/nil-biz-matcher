import { test, expect } from '@playwright/test'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const BASE_URL = process.env.BASE_URL || 'https://athlete-ledger.vercel.app'
const SMOKE_EMAIL = process.env.SMOKE_EMAIL
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD
const ARTIFACTS_DIR = './smoke-artifacts'

// Ensure artifacts directory exists
if (!existsSync(ARTIFACTS_DIR)) {
	mkdirSync(ARTIFACTS_DIR, { recursive: true })
}

// Fail if credentials are missing
if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
	throw new Error('SMOKE_EMAIL and SMOKE_PASSWORD environment variables must be set')
}

// Prevent duplicate login screenshots across tests
let didLoginScreenshot = false

async function loginIfNeeded(page: any) {
	const currentUrl = page.url()
	if (currentUrl.includes('/auth/login')) {
		// Wait for login page to load - check for heading first
		await page.waitForSelector('h3:has-text("Log in to Athlete Ledger")', { timeout: 10000 })
		await page.waitForTimeout(1000) // Wait for form to render
		
		// Try to find login inputs - use multiple strategies
		let emailInput = page.getByTestId('login-email')
		let passwordInput = page.getByTestId('login-password')
		let submitButton = page.getByTestId('login-submit')
		
		// Fallback: if test-id not found, use placeholder/type selectors
		if (!(await emailInput.isVisible().catch(() => false))) {
			emailInput = page.locator('input[type="email"]').first()
		}
		if (!(await passwordInput.isVisible().catch(() => false))) {
			passwordInput = page.locator('input[type="password"]').first()
		}
		if (!(await submitButton.isVisible().catch(() => false))) {
			submitButton = page.getByRole('button', { name: /log in/i }).first()
		}

		await emailInput.fill(SMOKE_EMAIL!)
		await passwordInput.fill(SMOKE_PASSWORD!)
		
		// Wait for submit button to be enabled before clicking (ensure form is ready)
		await submitButton.waitFor({ state: 'visible' })
		
		// Wait a moment for form to be fully ready
		await page.waitForTimeout(500)
		
		await submitButton.click()

		// Wait until login-status becomes 'submitting' (timeout 3s)
		// First ensure element exists, then wait for text change
		try {
			// Wait for element to exist (it should always be in DOM)
			await page.waitForFunction(
				() => !!document.querySelector('[data-testid="login-status"]'),
				{ timeout: 2000 }
			).catch(() => {
				throw new Error('LOGIN_SUBMIT_NOT_TRIGGERED: login-status element not found in DOM')
			})
			
			// Wait for status to become 'submitting'
			await page.waitForFunction(
				() => {
					const statusEl = document.querySelector('[data-testid="login-status"]')
					if (!statusEl) return false
					const text = statusEl.textContent?.trim() || ''
					return text === 'submitting'
				},
				{ timeout: 3000 }
			)
		} catch (e: any) {
			if (e.message?.includes('not found')) {
				throw e
			}
			throw new Error('LOGIN_SUBMIT_NOT_TRIGGERED: status did not become submitting within 3s')
		}

		// Wait until login-status becomes 'idle' OR URL becomes /app (timeout 12s)
		try {
			await Promise.race([
				page.waitForFunction(
					() => {
						const statusEl = document.querySelector('[data-testid="login-status"]')
						const text = statusEl?.textContent?.trim() || ''
						return text === 'idle'
					},
					{ timeout: 12000 }
				),
				page.waitForURL(/\/app/, { timeout: 12000 })
			])
		} catch {
			// If both time out, check current state below
		}

		// Check final state
		const currentUrl = page.url()
		if (currentUrl.includes('/app')) {
			// Success - wait for nav sidebar to appear
			await page.waitForSelector('[data-testid="nav-discover-button"], [data-testid="nav-recruiting-button"]', { timeout: 5000 })
			const navBtn = page.locator('[data-testid="nav-discover-button"], [data-testid="nav-recruiting-button"]').first()
			await expect(navBtn).toBeVisible({ timeout: 5000 })
			
			// Screenshot after successful login (only once)
			if (!didLoginScreenshot) {
				const successPath = join(ARTIFACTS_DIR, 'login-success.png')
				await page.screenshot({ path: successPath, fullPage: true })
				console.log(`Screenshot saved: ${successPath}`)
				didLoginScreenshot = true
			}
			
			await page.waitForTimeout(2000) // Wait for app to stabilize
		} else {
			// Still on /auth/login - check status and error
			const statusText = await page.evaluate(() => {
				const statusEl = document.querySelector('[data-testid="login-status"]')
				return statusEl?.textContent?.trim() || ''
			}).catch(() => '')
			const errorEl = page.getByTestId('login-error')
			const errorText = await errorEl.textContent().catch(() => '')
			
			// Take screenshot on failure (only once)
			if (!didLoginScreenshot) {
				try {
					const failPath = join(ARTIFACTS_DIR, 'login-failed.png')
					await page.screenshot({ path: failPath, fullPage: true })
					console.log(`Screenshot saved: ${failPath}`)
					didLoginScreenshot = true
				} catch (e) {
					// Screenshot failed, continue
				}
			}

			if (statusText.trim() === 'idle') {
				// Request finished
				if (errorText && errorText.trim().length > 0) {
					throw new Error(`LOGIN_FAILED: check SMOKE_EMAIL/SMOKE_PASSWORD or Supabase auth (Error: ${errorText.trim()})`)
				} else {
					throw new Error('LOGIN_FAILED_UI_BUG_DONE_NO_ERROR')
				}
			} else {
				// Status is still 'submitting' or unknown - timeout
				throw new Error('LOGIN_FAILED: check SMOKE_EMAIL/SMOKE_PASSWORD or Supabase auth (Timeout: still submitting after 12s)')
			}
		}
	}
}

test.describe('Production Smoke Tests', () => {
	test('A) Discover Businesses Flow', async ({ page }) => {
		// Navigate to production site
		await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

		// Navigate directly to /app (will redirect to login if not authenticated)
		await page.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' })
		
		// Wait for page to stabilize
		await page.waitForTimeout(2000)

		// Authenticate if needed
		await loginIfNeeded(page)

		// Try to find and click Discover tab/button
		const discoverBtn = page.getByTestId('nav-discover-button')
		if (await discoverBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
			await discoverBtn.click()
		} else {
			// Try "More" menu on mobile
			const moreBtn = page.getByRole('button', { name: /More/i }).first()
			if (await moreBtn.isVisible().catch(() => false)) {
				await moreBtn.click()
				await page.waitForTimeout(500)
				const menuDiscover = page.getByTestId('nav-discover-button')
				await menuDiscover.click()
			} else {
				throw new Error('Could not find Discover button')
			}
		}

		// Wait for Discover page to load
		await page.waitForTimeout(1000)

		// Look for search inputs using data-testid
		const whatInput = page.getByTestId('discover-what-input')
		const whereInput = page.getByTestId('discover-where-input')

		// Fill in search fields
		await whatInput.fill('gym')
		await whereInput.fill('Austin, TX')

		// Find and click Search button
		const searchButton = page.getByTestId('discover-search-button')
		await searchButton.click()

		// Wait for search to complete - wait for loading indicator to disappear
		await page.waitForFunction(() => {
			const loadingText = Array.from(document.querySelectorAll('*')).some(el => 
				el.textContent?.toLowerCase().includes('searching')
			)
			return !loadingText
		}, { timeout: 15000 }).catch(() => {
			// If wait fails, just wait a fixed time
		})
		await page.waitForTimeout(3000)

		// Check for error banner (should NOT be present)
		const errorBanner = page.getByTestId('discover-error-banner')
		if (await errorBanner.isVisible().catch(() => false)) {
			const errorText = await errorBanner.textContent().catch(() => 'Unknown error')
			throw new Error(`Error banner found: ${errorText}`)
		}

		// Assert that results render OR clear "No results" state
		const resultsContainer = page.getByTestId('discover-results-container')
		const hasResults = await resultsContainer.isVisible().catch(() => false)
		
		if (!hasResults) {
			throw new Error('Results container not found')
		}

		// Take screenshot AFTER results load
		const screenshotPath = join(ARTIFACTS_DIR, 'discover-flow.png')
		await page.screenshot({ path: screenshotPath, fullPage: true })
		console.log(`Screenshot saved: ${screenshotPath}`)
	})

	test('B) Recruiting Finder Flow', async ({ page }) => {
		// Navigate to production site
		await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

		// Navigate directly to /app
		await page.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' })
		
		// Wait for page to stabilize
		await page.waitForTimeout(2000)

		// Authenticate if needed
		await loginIfNeeded(page)

		// Try to find and click Recruiting tab/button
		const recruitingBtn = page.getByTestId('nav-recruiting-button')
		if (await recruitingBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
			await recruitingBtn.click()
		} else {
			// Try "More" menu on mobile
			const moreBtn = page.getByRole('button', { name: /More/i }).first()
			if (await moreBtn.isVisible().catch(() => false)) {
				await moreBtn.click()
				await page.waitForTimeout(500)
				const menuRecruiting = page.getByTestId('nav-recruiting-button')
				await menuRecruiting.click()
			} else {
				throw new Error('Could not find Recruiting button')
			}
		}

		// Wait for Recruiting page to load
		await page.waitForTimeout(1000)

		// Look for search inputs using data-testid
		const sportInput = page.getByTestId('recruiting-sport-input')
		const regionInput = page.getByTestId('recruiting-region-input')

		// Fill in search fields
		await sportInput.fill('football')
		await regionInput.fill('TX')

		// Find and click Search button
		const searchButton = page.getByTestId('recruiting-search-button')
		await searchButton.click()

		// Wait for search to complete
		await page.waitForFunction(() => {
			const loadingText = Array.from(document.querySelectorAll('*')).some(el => 
				el.textContent?.toLowerCase().includes('searching')
			)
			return !loadingText
		}, { timeout: 15000 }).catch(() => {
			// If wait fails, just wait a fixed time
		})
		await page.waitForTimeout(3000)

		// Check for error banner (should NOT be present)
		const errorBanner = page.getByTestId('recruiting-error-banner')
		if (await errorBanner.isVisible().catch(() => false)) {
			const errorText = await errorBanner.textContent().catch(() => 'Unknown error')
			throw new Error(`Error banner found: ${errorText}`)
		}

		// Assert that results render OR clear "No results" state
		const resultsContainer = page.getByTestId('recruiting-results-container')
		const hasResults = await resultsContainer.isVisible().catch(() => false)
		
		if (!hasResults) {
			throw new Error('Results container not found')
		}

		// Take screenshot AFTER results load
		const screenshotPath = join(ARTIFACTS_DIR, 'recruiting-flow.png')
		await page.screenshot({ path: screenshotPath, fullPage: true })
		console.log(`Screenshot saved: ${screenshotPath}`)
	})
})
