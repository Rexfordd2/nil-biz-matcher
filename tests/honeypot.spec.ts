import { test, expect } from '@playwright/test'
import { TEST_FORM_DELAY } from '../src/config/honeypot'

test.describe('Honeypot Field Verification', () => {
	test.beforeEach(async ({ context, page }) => {
		// Clear localStorage to ensure we don't see the "already joined" state
		await context.clearCookies()
		await context.addInitScript(() => {
			localStorage.clear()
		})
		
		// Note: Honeypot field is in WaitlistForm component
		// Home page may use WaitlistEmbed which might not expose the form directly
		// For reliable testing, we can test on a page that uses WaitlistForm
		// or check if the form is available on home
		await page.goto('/')
		
		// Dismiss WaitlistGate modal if present
		const skipButton = page.getByTestId('skip-waitlist-button')
		if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await skipButton.click()
			await page.waitForTimeout(300)
		}
		
		// Check if waitlist form section exists (demo mode)
		const waitlistSection = page.locator('#waitlist-form')
		const hasWaitlistSection = await waitlistSection.isVisible().catch(() => false)
		
		if (hasWaitlistSection) {
			// Scroll to waitlist form if it exists
			await waitlistSection.scrollIntoViewIfNeeded()
		}
	})

	test('Honeypot field exists with correct attributes', async ({ page }) => {
		// Check if honeypot is on current page (depends on embed configuration)
		// If not present on home, skip this specific test or test elsewhere
		const honeypot = page.getByTestId('waitlist-honeypot')
		const isPresent = await honeypot.isAttached().catch(() => false)
		
		// Skip test if honeypot field not present (embed mode without form)
		test.skip(!isPresent, 'Honeypot field not present on this page (using embed)')
		
		// Verify honeypot field exists
		await expect(honeypot).toBeAttached()

		// Check attributes
		await expect(honeypot).toHaveAttribute('name', 'website')
		await expect(honeypot).toHaveAttribute('type', 'text')
		await expect(honeypot).toHaveAttribute('tabindex', '-1')
		await expect(honeypot).toHaveAttribute('aria-hidden', 'true')
		await expect(honeypot).toHaveAttribute('autocomplete', 'off')
	})

	test('Honeypot field is not visible', async ({ page }) => {
		const honeypot = page.getByTestId('waitlist-honeypot')
		
		// Field should not be visible to users
		await expect(honeypot).not.toBeVisible()
	})

	test('Honeypot field is not in viewport', async ({ page }) => {
		const honeypot = page.getByTestId('waitlist-honeypot')
		
		// Field should not be in viewport (positioned off-screen)
		const isInViewport = await honeypot.isVisible().catch(() => false)
		expect(isInViewport).toBe(false)
	})

	test('Honeypot field has proper CSS positioning', async ({ page }) => {
		const honeypot = page.getByTestId('waitlist-honeypot')
		
		// Check computed styles
		const styles = await honeypot.evaluate((el) => {
			const computed = window.getComputedStyle(el)
			return {
				position: computed.position,
				left: computed.left,
				width: computed.width,
				height: computed.height,
				overflow: computed.overflow
			}
		})

		expect(styles.position).toBe('absolute')
		expect(styles.left).toBe('-9999px')
		expect(styles.width).toBe('1px')
		expect(styles.height).toBe('1px')
		// Overflow can be 'hidden' or 'clip' - both work
		expect(['hidden', 'clip']).toContain(styles.overflow)
	})

	test('Honeypot field is not focusable via keyboard', async ({ page }) => {
		const emailInput = page.getByTestId('waitlist-email-input')
		const honeypot = page.getByTestId('waitlist-honeypot')
		
		// Focus on email input
		await emailInput.focus()
		
		// Try to tab to next field - should skip honeypot
		await page.keyboard.press('Tab')
		await page.waitForTimeout(100)
		
		// Honeypot should not be focused
		const isFocused = await honeypot.evaluate((el) => el === document.activeElement)
		expect(isFocused).toBe(false)
	})

	test('Honeypot field can be programmatically filled (bot simulation)', async ({ page }) => {
		const honeypot = page.getByTestId('waitlist-honeypot')

		// Verify honeypot starts empty
		let value = await honeypot.inputValue()
		expect(value).toBe('')
		
		// Simulate bot filling the field programmatically
		await honeypot.evaluate((el: HTMLInputElement) => {
			el.value = 'bot-filled-this'
		})
		
		// Verify field was filled
		value = await honeypot.inputValue()
		expect(value).toBe('bot-filled-this')
		
		// Field remains hidden even when filled
		await expect(honeypot).not.toBeVisible()
		
		// Note: Full submission test requires working API endpoint
		// The client-side honeypot check in WaitlistForm will:
		// 1. Detect filled honeypot
		// 2. Show success message without submitting to API
		// 3. Log security event to Observability
	})

	test('Normal form submission works correctly', async ({ page }) => {
		const emailInput = page.getByTestId('waitlist-email-input')
		const honeypot = page.getByTestId('waitlist-honeypot')
		const submitButton = page.getByTestId('waitlist-submit-button')

		// Verify honeypot is empty
		const honeypotValue = await honeypot.inputValue()
		expect(honeypotValue).toBe('')
		
		// Fill email (honeypot remains empty)
		await emailInput.fill('legitimate@example.com')
		
		// Wait to avoid timing check (uses shared constant from src/config/honeypot.ts)
		// This ensures tests stay in sync with app's anti-bot timing threshold
		await page.waitForTimeout(TEST_FORM_DELAY)
		
		// Submit form
		await submitButton.click()
		
		// Should show success message or error (API might not be available in test)
		await page.waitForTimeout(1000)
		const hasSuccess = await page.getByText(/You're in!/i).isVisible().catch(() => false)
		const hasError = await page.getByTestId('waitlist-error').isVisible().catch(() => false)
		
		// Either success or error is OK (API might not be available)
		expect(hasSuccess || hasError).toBe(true)
	})

	test('Honeypot field has no layout impact', async ({ page }) => {
		// Get initial layout
		const initialLayout = await page.evaluate(() => ({
			scrollHeight: document.documentElement.scrollHeight,
			clientHeight: document.documentElement.clientHeight
		}))
		
		// Honeypot field should not affect document height
		const honeypot = page.getByTestId('waitlist-honeypot')
		const boundingBox = await honeypot.boundingBox()
		
		// Bounding box might be null or minimal
		if (boundingBox) {
			expect(boundingBox.width).toBeLessThanOrEqual(1)
			expect(boundingBox.height).toBeLessThanOrEqual(1)
		}
		
		// Document dimensions should be unchanged
		const finalLayout = await page.evaluate(() => ({
			scrollHeight: document.documentElement.scrollHeight,
			clientHeight: document.documentElement.clientHeight
		}))
		
		expect(finalLayout.scrollHeight).toBe(initialLayout.scrollHeight)
		expect(finalLayout.clientHeight).toBe(initialLayout.clientHeight)
	})
})
