import { test, expect } from '@playwright/test'

/**
 * PR-2: URL-backed NIL Roster destination navigation.
 *
 * Run against an app-capable (non-demo) build with local-only auth bypass:
 *
 *   PowerShell:
 *   $env:VITE_APP_MODE="beta"
 *   $env:VITE_E2E_BYPASS_AUTH="true"
 *   $env:VITE_PUBLIC_MODE="true"
 *   npm run build
 *   npx vite preview --host 127.0.0.1 --port 4173
 *   $env:BASE_URL="http://127.0.0.1:4173"
 *   npx playwright test tests/nil-roster-navigation.spec.ts
 *
 * Bypass activates only when VITE_E2E_BYPASS_AUTH=true AND hostname is
 * localhost / 127.0.0.1 / ::1 (never on deployed hosts).
 *
 * Do not use VITE_APP_MODE=demo for this file (/app redirects to /demo).
 */

test.describe('NIL Roster PR-2 destination navigation', () => {
	test.beforeEach(async ({ context }) => {
		await context.clearCookies()
		await context.addInitScript(() => {
			localStorage.clear()
		})
	})

	test('/app redirects or replaces to /app/today', async ({ page }) => {
		await page.goto('/app')
		await page.waitForURL(/\/app\/today/, { timeout: 15000 })
		await expect(page).toHaveURL(/\/app\/today/)
		await expect(page.getByText('Business Portfolio Dashboard')).toBeVisible({ timeout: 15000 })
	})

	test('primary destinations render expected surfaces', async ({ page }) => {
		const cases: Array<{ path: string; assert: () => Promise<void> }> = [
			{
				path: '/app/today',
				assert: async () => {
					await expect(page.getByText('Business Portfolio Dashboard')).toBeVisible()
				},
			},
			{
				path: '/app/passport',
				assert: async () => {
					await page.waitForURL(/\/app\/passport\/profile/)
					await expect(page.getByText('Athlete Profile Builder')).toBeVisible()
				},
			},
			{
				path: '/app/recruiting',
				assert: async () => {
					await page.waitForURL(/\/app\/recruiting\/search/)
					await expect(page.getByRole('heading', { name: 'Recruiting' })).toBeVisible()
				},
			},
			{
				path: '/app/network',
				assert: async () => {
					await expect(page.getByTestId('network-foundation')).toBeVisible()
					await expect(page.getByRole('heading', { name: 'Your Network' })).toBeVisible()
				},
			},
			{
				path: '/app/opportunities',
				assert: async () => {
					await page.waitForURL(/\/app\/opportunities\/pipeline/)
					await expect(page.getByTestId('opportunities-subnav')).toBeVisible()
					await expect(page.getByText('Opportunities').first()).toBeVisible()
				},
			},
			{
				path: '/app/career',
				assert: async () => {
					await expect(page.getByTestId('career-studio-foundation')).toBeVisible()
					await expect(page.getByRole('heading', { name: 'Career Studio' })).toBeVisible()
				},
			},
		]

		for (const c of cases) {
			await page.goto(c.path)
			await c.assert()
		}
	})

	test('deep links render correct child surfaces', async ({ page }) => {
		await page.goto('/app/passport/public')
		await expect(page.getByText('Profile').first()).toBeVisible()

		await page.goto('/app/recruiting/board')
		await expect(page.getByText('To Contact')).toBeVisible()

		await page.goto('/app/recruiting/blast')
		await expect(page.getByText('Recipients (from My Targets)')).toBeVisible()

		await page.goto('/app/opportunities/deals')
		await expect(page.getByText('NIL Deals')).toBeVisible()
		await expect(page.getByTestId('opportunities-subnav-deals')).toHaveAttribute('aria-current', 'page')

		await page.goto('/app/opportunities/events')
		await expect(page.getByRole('heading', { name: 'Events & Camps' })).toBeVisible()

		await page.goto('/app/learn/guidelines')
		await expect(page.getByText('NIL Rules & Guidelines')).toBeVisible()
	})

	test('global navigation updates URL without reload; back/forward work', async ({ page }) => {
		await page.goto('/app/today')
		await expect(page.getByText('Business Portfolio Dashboard')).toBeVisible()

		let reloaded = false
		page.on('load', () => {
			reloaded = true
		})

		await page.getByTestId('nav-recruiting').click()
		await page.waitForURL(/\/app\/recruiting\/search/)
		await expect(page.getByRole('heading', { name: 'Recruiting' })).toBeVisible()
		expect(reloaded).toBe(false)

		await page.getByTestId('nav-opportunities').click()
		await page.waitForURL(/\/app\/opportunities\/pipeline/)
		expect(reloaded).toBe(false)

		await page.goBack()
		await page.waitForURL(/\/app\/recruiting\/search/)
		await expect(page.getByRole('heading', { name: 'Recruiting' })).toBeVisible()

		await page.goForward()
		await page.waitForURL(/\/app\/opportunities\/pipeline/)
		await expect(page.getByTestId('opportunities-subnav')).toBeVisible()
	})

	test('refresh on deep link preserves destination', async ({ page }) => {
		await page.goto('/app/opportunities/events')
		await expect(page.getByRole('heading', { name: 'Events & Camps' })).toBeVisible()
		await page.reload()
		await expect(page).toHaveURL(/\/app\/opportunities\/events/)
		await expect(page.getByRole('heading', { name: 'Events & Camps' })).toBeVisible()
	})

	test('parent nav highlights on child routes', async ({ page }) => {
		await page.goto('/app/recruiting/board')
		await expect(page.getByTestId('nav-recruiting')).toHaveAttribute('aria-current', 'page')

		await page.goto('/app/opportunities/deals')
		await expect(page.getByTestId('nav-opportunities')).toHaveAttribute('aria-current', 'page')

		await page.goto('/app/passport/public')
		await expect(page.getByTestId('nav-passport')).toHaveAttribute('aria-current', 'page')

		await page.goto('/app/learn/vendors')
		await expect(page.getByTestId('nav-learn')).toHaveAttribute('aria-current', 'page')
	})

	test('unknown /app route resolves to Today', async ({ page }) => {
		await page.goto('/app/not-a-real-destination')
		await page.waitForURL(/\/app\/today/)
		await expect(page.getByText('Business Portfolio Dashboard')).toBeVisible()
	})

	test('/recruiting and /recruiting/legacy still resolve', async ({ page }) => {
		await page.goto('/recruiting')
		await expect(page).toHaveURL(/\/recruiting/)
		await expect(page.getByRole('heading', { name: 'Recruiting' })).toBeVisible({ timeout: 15000 })

		await page.goto('/recruiting/legacy')
		await expect(page).toHaveURL(/\/recruiting\/legacy/)
		const body = await page.locator('body').textContent()
		expect(body && body.length).toBeGreaterThan(0)
	})

	test('Network and Career Studio are honest foundation screens', async ({ page }) => {
		await page.goto('/app/network')
		await expect(page.getByTestId('network-foundation-disclosure')).toContainText('relationship CRM will be built')
		// Counts only — no contact PII surfaces (names/emails/phones from passport contacts)
		await expect(page.getByTestId('network-support-count')).toBeVisible()
		await expect(page.getByTestId('network-trusted-count')).toBeVisible()
		await expect(page.getByTestId('network-foundation')).not.toContainText('@')
		const networkText = (await page.getByTestId('network-foundation').textContent()) || ''
		expect(networkText).not.toMatch(/\b\d{3}[-.)]\d{3}[-.)]\d{4}\b/)

		await page.goto('/app/career')
		await expect(page.getByTestId('career-studio-disclosure')).toContainText('later phases')
		await expect(page.getByTestId('career-studio-disclosure')).toContainText('Career pathways')
		const careerText = (await page.getByTestId('career-studio-foundation').textContent()) || ''
		expect(careerText.toLowerCase()).not.toContain('portfolio generation is active')
	})
})
