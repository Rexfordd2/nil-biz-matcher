import { test, expect } from '@playwright/test'

test.describe('Production smoke checks', () => {
	test('Home shows hero, steps, and CTAs', async ({ page }) => {
		await page.goto('/')
		await expect(page.getByRole('heading', { name: 'Athlete Ledger: Turn Your Hustle into a Real NIL Game Plan' })).toBeVisible()
		await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Create Profile' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible()
	})

	test('Create Profile CTA routes to /auth/signup', async ({ page }) => {
		await page.goto('/')
		await page.getByRole('button', { name: 'Create Profile' }).click()
		await expect(page).toHaveURL(/\/auth\/signup/)
	})

	test('Log In CTA routes to /auth/login', async ({ page }) => {
		await page.goto('/')
		// Click header "Log In"
		await page.getByRole('button', { name: 'Log In' }).first().click()
		await expect(page).toHaveURL(/\/auth\/login/)
	})

	test('Logged-out /app redirects to login with returnTo', async ({ page }) => {
		await page.goto('/app')
		await expect(page).toHaveURL(/\/auth\/login\?returnTo=/)
	})

	test('/terms and /privacy return 200 and contain headings', async ({ page }) => {
		const resTerms = await page.goto('/terms')
		expect(resTerms?.status()).toBeLessThan(400)
		await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible()

		const resPrivacy = await page.goto('/privacy')
		expect(resPrivacy?.status()).toBeLessThan(400)
		await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
	})

	test('/status returns 200 and shows Build + Terms Version', async ({ page }) => {
		const res = await page.goto('/status')
		expect(res?.status()).toBeLessThan(400)
		await expect(page.getByRole('heading', { name: 'Current Site Status' })).toBeVisible()
		await expect(page.getByText(/Build:/)).toBeVisible()
		await expect(page.getByText(/Terms/)).toBeVisible()
	})

	test('/auth/reset renders without 404', async ({ page }) => {
		const res = await page.goto('/auth/reset')
		expect(res?.status()).toBeLessThan(400)
		await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
	})
})


