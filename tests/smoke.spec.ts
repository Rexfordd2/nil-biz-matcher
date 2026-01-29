import { test, expect } from '@playwright/test'

test.describe('Production smoke checks', () => {
	test.beforeEach(async ({ page }) => {
		// Dismiss WaitlistGate modal if present
		await page.goto('/')
		const skipButton = page.getByTestId('skip-waitlist-button')
		if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await skipButton.click()
			await page.waitForTimeout(300)
		}
	})

	test('Home shows hero, steps, and CTAs', async ({ page }) => {
		await expect(page.getByTestId('hero-heading')).toBeVisible()
		await expect(page.getByTestId('how-it-works-heading')).toBeVisible()
		await expect(page.getByTestId('try-demo-button').first()).toBeVisible()
		await expect(page.getByTestId('save-progress-button').first()).toBeVisible()
		// Confirm waitlist section exists
		await expect(page.locator('#waitlist-form')).toBeVisible()
	})

	test('Try Demo CTA routes to /demo', async ({ page }) => {
		await page.getByTestId('try-demo-button').first().click()
		await expect(page).toHaveURL(/\/demo/)
	})

	test('Save my progress scrolls to waitlist form', async ({ page }) => {
		// Click "Save my progress" button
		await page.getByTestId('save-progress-button').first().click()
		// Wait for scroll animation
		await page.waitForTimeout(1000)
		// Confirm waitlist form is in viewport
		const waitlistSection = page.locator('#waitlist-form')
		await expect(waitlistSection).toBeInViewport()
	})

	test('/app loads in anonymous mode (public release)', async ({ page }) => {
		await page.goto('/app')
		// Should load /app without redirect
		await expect(page).toHaveURL(/\/app/)
		// Anonymous mode indicator should be visible
		await expect(page.getByText('No login required')).toBeVisible()
	})

	test('/terms and /privacy return 200 and contain headings', async ({ page }) => {
		const resTerms = await page.goto('/terms')
		expect(resTerms?.status()).toBeLessThan(400)
		await expect(page.getByRole('heading', { name: 'Terms of Use' }).first()).toBeVisible()

		const resPrivacy = await page.goto('/privacy')
		expect(resPrivacy?.status()).toBeLessThan(400)
		await expect(page.getByRole('heading', { name: 'Privacy Policy' }).first()).toBeVisible()
	})

	test('/status returns 200 and shows Build + Terms Version', async ({ page }) => {
		const res = await page.goto('/status')
		expect(res?.status()).toBeLessThan(400)
		await expect(page.getByRole('heading', { name: 'Current Site Status' }).first()).toBeVisible()
		// Check for build ID and terms version in the status line
		await expect(page.getByText(/Build .+ • .+ • Terms .+ • Env/).first()).toBeVisible()
	})

	test('/auth/reset renders without 404', async ({ page }) => {
		const res = await page.goto('/auth/reset')
		expect(res?.status()).toBeLessThan(400)
		
		// Page should not crash regardless of Supabase configuration
		// In public mode, shows disabled screen; otherwise shows reset form or unavailable message
		const bodyText = await page.locator('body').textContent()
		expect(bodyText).toBeTruthy()
		expect(bodyText!.length).toBeGreaterThan(0)
		
		// Check for either the disabled screen (public mode) or reset form heading
		const hasDisabledScreen = await page.getByTestId('auth-disabled').isVisible().catch(() => false)
		const hasResetHeading = await page.getByRole('heading', { name: 'Set a new password' }).first().isVisible().catch(() => false)
		expect(hasDisabledScreen || hasResetHeading).toBeTruthy()
	})
})


