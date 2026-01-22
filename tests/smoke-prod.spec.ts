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
		
		// Step 1: Confirm DOM wiring
		const form = page.getByTestId('login-form')
		const emailInput = page.getByTestId('login-email')
		const passwordInput = page.getByTestId('login-password')
		const submitButton = page.getByTestId('login-submit')
		const statusEl = page.getByTestId('login-status')
		
		// Assert all elements exist and are visible (except status which is hidden)
		await expect(form).toBeVisible({ timeout: 5000 })
		await expect(emailInput).toBeVisible({ timeout: 5000 })
		await expect(passwordInput).toBeVisible({ timeout: 5000 })
		await expect(submitButton).toBeVisible({ timeout: 5000 })
		await expect(statusEl).toHaveCount(1, { timeout: 5000 })
		
		// Get submit button details
		const submitTagName = await submitButton.evaluate((el: any) => el.tagName)
		const submitType = await submitButton.evaluate((el: any) => el.type || 'N/A')
		const submitDisabled = await submitButton.isDisabled()
		
		// Check if submit button is inside form
		const submitInForm = await page.evaluate(() => {
			const form = document.querySelector('[data-testid="login-form"]')
			const submit = document.querySelector('[data-testid="login-submit"]')
			if (!form || !submit) return false
			return form.contains(submit)
		})
		
		console.log('DOM_WIRING:')
		console.log(`  submit button: ${submitTagName} type="${submitType}" disabled=${submitDisabled}`)
		console.log(`  submit in form: ${submitInForm}`)

		await emailInput.fill(SMOKE_EMAIL!)
		await passwordInput.fill(SMOKE_PASSWORD!)
		
		// Wait for form to be ready
		await page.waitForTimeout(500)
		
		// Step 2: Read submitStartCount BEFORE submit
		const beforeSubmitStart = await page.evaluate(() => {
			const el = document.querySelector('[data-testid="login-submit-start-count"]')
			return parseInt(el?.textContent?.trim() || '0', 10)
		})
		
		// Step 3: Submit via form submit event dispatch
		await submitButton.waitFor({ state: 'visible' })
		const isDisabledBefore = await submitButton.isDisabled()
		if (isDisabledBefore) {
			throw new Error('Submit button is disabled before submit')
		}
		
		// Step 4: Sample login-status every 250ms for 5 seconds (20 samples)
		// Start sampling immediately, then submit
		const samples: string[] = []
		const samplingPromise = (async () => {
			for (let i = 0; i < 20; i++) {
				await page.waitForTimeout(250)
				const statusText = await page.evaluate(() => {
					const statusEl = document.querySelector('[data-testid="login-status"]')
					return statusEl?.textContent?.trim() || 'missing'
				}).catch(() => 'error')
				samples.push(statusText)
			}
		})()
		
		// Dispatch submit event directly on form (triggers React onSubmit)
		await form.evaluate((f: HTMLFormElement) => {
			const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
			f.dispatchEvent(submitEvent)
		})
		
		// Step 5: Wait until submitStartCount increments by 1 (timeout 3s)
		try {
			await page.waitForFunction(
				(expectedValue: number) => {
					const el = document.querySelector('[data-testid="login-submit-start-count"]')
					const currentValue = parseInt(el?.textContent?.trim() || '0', 10)
					return currentValue === expectedValue + 1
				},
				beforeSubmitStart,
				{ timeout: 3000 }
			)
		} catch {
			// Timeout - continue anyway to capture proof
		}
		
		// Read values after submit
		const afterSubmitStart = await page.evaluate(() => {
			const el = document.querySelector('[data-testid="login-submit-start-count"]')
			return parseInt(el?.textContent?.trim() || '0', 10)
		})
		const handleSubmitCount = await page.evaluate(() => {
			const el = document.querySelector('[data-testid="login-handle-submit-count"]')
			return parseInt(el?.textContent?.trim() || '0', 10)
		})
		const loginStatus = await page.evaluate(() => {
			const el = document.querySelector('[data-testid="login-status"]')
			return el?.textContent?.trim() || 'missing'
		})
		
		// Print LOGIN_PROOF block
		console.log(`LOGIN_PROOF:`)
		console.log(`beforeSubmitStart=${beforeSubmitStart} afterSubmitStart=${afterSubmitStart} handleSubmitCount=${handleSubmitCount} loginStatus=${loginStatus}`)
		
		await page.waitForTimeout(200) // Small delay to let React process
		
		// Read tripwire values immediately after submit attempt
		const tripwireValues = await page.evaluate(() => {
			const nativeSubmit = document.querySelector('[data-testid="login-native-submit-count"]')?.textContent?.trim() || '0'
			const clickCaptured = document.querySelector('[data-testid="login-click-captured"]')?.textContent?.trim() || '0'
			const submitCaptured = document.querySelector('[data-testid="login-submit-captured"]')?.textContent?.trim() || '0'
			const handleSubmit = document.querySelector('[data-testid="login-handle-submit-count"]')?.textContent?.trim() || '0'
			const captureDefaultPrevented = document.querySelector('[data-testid="login-capture-default-prevented"]')?.textContent?.trim() || 'false'
			const captureEventPhase = document.querySelector('[data-testid="login-capture-event-phase"]')?.textContent?.trim() || '0'
			const bridgeFired = document.querySelector('[data-testid="login-bridge-fired-count"]')?.textContent?.trim() || '0'
			const status = document.querySelector('[data-testid="login-status"]')?.textContent?.trim() || 'missing'
			return { nativeSubmit, clickCaptured, submitCaptured, handleSubmit, captureDefaultPrevented, captureEventPhase, bridgeFired, status }
		})
		
		// Screenshot for tripwire proof
		const tripwirePath = join(ARTIFACTS_DIR, 'prod-tripwire.png')
		await page.screenshot({ path: tripwirePath, fullPage: true })
		console.log(`Screenshot saved: ${tripwirePath}`)
		
		console.log(`TRIPWIRE:`)
		console.log(`nativeSubmit=${tripwireValues.nativeSubmit} clickCaptured=${tripwireValues.clickCaptured} submitCaptured=${tripwireValues.submitCaptured} status=${tripwireValues.status}`)
		
		console.log(`HANDLE_SUBMIT_PROOF:`)
		console.log(`nativeSubmit=${tripwireValues.nativeSubmit} submitCaptured=${tripwireValues.submitCaptured} captureDefaultPrevented=${tripwireValues.captureDefaultPrevented} captureEventPhase=${tripwireValues.captureEventPhase} bridgeFired=${tripwireValues.bridgeFired} handleSubmit=${tripwireValues.handleSubmit} status=${tripwireValues.status}`)
		
		// Screenshot for handleSubmit proof
		const handleSubmitProofPath = join(ARTIFACTS_DIR, 'prod-handleSubmit-proof.png')
		await page.screenshot({ path: handleSubmitProofPath, fullPage: true })
		console.log(`Screenshot saved: ${handleSubmitProofPath}`)
		
		// Wait for all samples to complete
		await samplingPromise
		console.log(`STATUS_SAMPLES: ${samples.join(', ')}`)
		
		// Step 4: Check if status became 'submitting'
		const becameSubmitting = samples.some(s => s === 'submitting')
		
		if (!becameSubmitting) {
			const currentUrl = page.url()
			const failPath = join(ARTIFACTS_DIR, 'prod-submit-not-triggered.png')
			await page.screenshot({ path: failPath, fullPage: true })
			console.log(`Screenshot saved: ${failPath}`)
			
			console.log('RESULT: FAIL')
			console.log(`  Error: LOGIN_SUBMIT_NOT_TRIGGERED: status never became submitting`)
			console.log(`  Screenshot: ${tripwirePath}`)
			throw new Error('LOGIN_SUBMIT_NOT_TRIGGERED: status never became submitting')
		}
		
		console.log('RESULT: PASS (status became submitting)')

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
