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
		// Wait for login page to load
		await page.waitForSelector('h3:has-text("Log in to Athlete Ledger")', { timeout: 10000 })
		await page.waitForTimeout(1000)
		
		const emailInput = page.getByTestId('login-email')
		const passwordInput = page.getByTestId('login-password')
		const submitButton = page.getByTestId('login-submit')
		
		await expect(emailInput).toBeVisible({ timeout: 5000 })
		await expect(passwordInput).toBeVisible({ timeout: 5000 })
		await expect(submitButton).toBeVisible({ timeout: 5000 })

		await emailInput.fill(SMOKE_EMAIL!)
		await passwordInput.fill(SMOKE_PASSWORD!)
		await page.waitForTimeout(500)
		
		// Debug markers (read but don't fail on them)
		const beforeSubmitStart = await page.evaluate(() => {
			const el = document.querySelector('[data-testid="login-submit-start-count"]')
			return parseInt(el?.textContent?.trim() || '0', 10)
		}).catch(() => 0)
		
		// Click submit button
		await submitButton.click()
		
		// Wait for FIRST of: URL contains /app (success) OR login-error has non-empty text (fail)
		// Timeout 20s
		let loginSuccess = false
		let loginError = ''
		
		try {
			await Promise.race([
				page.waitForURL(/\/app/, { timeout: 20000 }).then(() => { loginSuccess = true }),
				page.waitForFunction(
					() => {
						const errorEl = document.querySelector('[data-testid="login-error"]')
						const errorText = errorEl?.textContent?.trim() || ''
						return errorText.length > 0
					},
					{ timeout: 20000 }
				).then(async () => {
					const errorEl = page.getByTestId('login-error')
					loginError = await errorEl.textContent().catch(() => '')
				})
			])
		} catch {
			// Timeout - check current state below
		}
		
		// Debug markers (read but don't fail)
		const afterSubmitStart = await page.evaluate(() => {
			const el = document.querySelector('[data-testid="login-submit-start-count"]')
			return parseInt(el?.textContent?.trim() || '0', 10)
		}).catch(() => 0)
		const handleSubmitCount = await page.evaluate(() => {
			const el = document.querySelector('[data-testid="login-handle-submit-count"]')
			return parseInt(el?.textContent?.trim() || '0', 10)
		}).catch(() => 0)
		
		// Debug output (optional)
		if (process.env.DEBUG_LOGIN) {
			console.log(`LOGIN_PROOF: beforeSubmitStart=${beforeSubmitStart} afterSubmitStart=${afterSubmitStart} handleSubmitCount=${handleSubmitCount}`)
		}
		
		// Check final state
		const currentUrl = page.url()
		if (loginSuccess || currentUrl.includes('/app')) {
			// Success - wait for nav sidebar to appear
			await page.waitForSelector('[data-testid="nav-discover-button"], [data-testid="nav-recruiting-button"]', { timeout: 5000 })
			await page.waitForTimeout(2000) // Wait for app to stabilize
		} else {
			// Failure - get error text if not already captured
			if (!loginError) {
				const errorEl = page.getByTestId('login-error')
				loginError = await errorEl.textContent().catch(() => '')
			}
			
			if (loginError && loginError.trim().length > 0) {
				throw new Error(`LOGIN_FAILED: ${loginError.trim()}`)
			} else {
				throw new Error('LOGIN_FAILED: Timeout waiting for login response')
			}
		}
	}
}

test.describe('Production Smoke Tests', () => {
	test('Authenticated App Flows', async ({ page }) => {
		// Navigate to production site
		await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

		// Navigate directly to /app (will redirect to login if not authenticated)
		await page.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' })
		
		// Wait for page to stabilize
		await page.waitForTimeout(2000)

		// Authenticate if needed
		await loginIfNeeded(page)

		// A) Discover Flow
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

		await page.waitForTimeout(1000)

		const whatInput = page.getByTestId('discover-what-input')
		const whereInput = page.getByTestId('discover-where-input')

		await whatInput.fill('gym')
		await whereInput.fill('Austin, TX')

		const discoverSearchButton = page.getByTestId('discover-search-button')
		await discoverSearchButton.click()

		// Wait for search to complete
		await page.waitForFunction(() => {
			const loadingText = Array.from(document.querySelectorAll('*')).some(el => 
				el.textContent?.toLowerCase().includes('searching')
			)
			return !loadingText
		}, { timeout: 15000 }).catch(() => {})
		await page.waitForTimeout(3000)

		// Assert NO error banner
		const discoverErrorBanner = page.getByTestId('discover-error-banner')
		if (await discoverErrorBanner.isVisible().catch(() => false)) {
			const errorText = await discoverErrorBanner.textContent().catch(() => 'Unknown error')
			throw new Error(`Discover error banner found: ${errorText}`)
		}

		// Assert results container is visible
		const discoverResultsContainer = page.getByTestId('discover-results-container')
		await expect(discoverResultsContainer).toBeVisible({ timeout: 5000 })

		// Screenshot
		const discoverScreenshotPath = join(ARTIFACTS_DIR, 'discover-authed.png')
		await page.screenshot({ path: discoverScreenshotPath, fullPage: true })
		console.log(`Screenshot saved: ${discoverScreenshotPath}`)

		// B) Recruiting Flow
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

		await page.waitForTimeout(1000)

		const sportInput = page.getByTestId('recruiting-sport-input')
		const regionInput = page.getByTestId('recruiting-region-input')

		await sportInput.fill('football')
		await regionInput.fill('TX')

		const recruitingSearchButton = page.getByTestId('recruiting-search-button')
		await recruitingSearchButton.click()

		// Wait for search to complete
		await page.waitForFunction(() => {
			const loadingText = Array.from(document.querySelectorAll('*')).some(el => 
				el.textContent?.toLowerCase().includes('searching')
			)
			return !loadingText
		}, { timeout: 15000 }).catch(() => {})
		await page.waitForTimeout(3000)

		// Assert NO error banner
		const recruitingErrorBanner = page.getByTestId('recruiting-error-banner')
		if (await recruitingErrorBanner.isVisible().catch(() => false)) {
			const errorText = await recruitingErrorBanner.textContent().catch(() => 'Unknown error')
			throw new Error(`Recruiting error banner found: ${errorText}`)
		}

		// Assert results container is visible
		const recruitingResultsContainer = page.getByTestId('recruiting-results-container')
		await expect(recruitingResultsContainer).toBeVisible({ timeout: 5000 })

		// Screenshot
		const recruitingScreenshotPath = join(ARTIFACTS_DIR, 'recruiting-authed.png')
		await page.screenshot({ path: recruitingScreenshotPath, fullPage: true })
		console.log(`Screenshot saved: ${recruitingScreenshotPath}`)
	})
})
