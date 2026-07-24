import { test, expect } from '@playwright/test'

/**
 * PR-3: dead-surface cleanup, NIL Money Readiness checklist, Dashboard source-of-truth.
 *
 *   PowerShell:
 *   $env:VITE_APP_MODE="beta"
 *   $env:VITE_E2E_BYPASS_AUTH="true"
 *   $env:VITE_PUBLIC_MODE="true"
 *   $env:VITE_ALLOW_MISSING_GOOGLE_MAPS_KEY="true"
 *   npm run build
 *   npx vite preview --host 127.0.0.1 --port 4173
 *   $env:BASE_URL="http://127.0.0.1:4173"
 *   npx playwright test tests/nil-roster-pr3.spec.ts --workers=1
 */

test.describe('NIL Roster PR-3 cleanup and dashboard summary', () => {
	test.beforeEach(async ({ context }) => {
		await context.clearCookies()
		await context.addInitScript(() => {
			localStorage.clear()
		})
	})

	test('/app/today renders without deleted dead surfaces', async ({ page }) => {
		await page.goto('/app/today')
		await page.waitForURL(/\/app\/today/, { timeout: 15000 })
		await expect(page.getByText('Business Portfolio Dashboard')).toBeVisible({ timeout: 15000 })
		await expect(page.getByTestId('recruiting-board-summary')).toBeVisible()
		const body = (await page.locator('body').textContent()) || ''
		expect(body).not.toContain('Programs marked "Pursue"')
		expect(body).not.toMatch(/RecruitingFinder|BusinessSwipeDeck|ProgramSwipeDeck|AppHome/)
	})

	test('/app/learn/nil-hub checklist toggles and survives refresh via finance.checklist', async ({
		browser,
	}) => {
		// Use a dedicated context so beforeEach's clear-on-every-load init script
		// does not wipe finance.checklist during the persistence reload.
		const context = await browser.newContext()
		const page = await context.newPage()
		await page.goto('/app/learn/nil-hub')
		await page.evaluate(() => localStorage.clear())
		await page.reload()

		await expect(page.getByTestId('nil-money-readiness')).toBeVisible({ timeout: 15000 })
		await expect(page.getByRole('heading', { name: 'NIL Money Readiness' })).toBeVisible()

		const exportBox = page.getByTestId('finance-check-export_log')
		await expect(exportBox).not.toBeChecked()
		await exportBox.check()
		await expect(exportBox).toBeChecked()

		const stored = await page.evaluate(() => localStorage.getItem('finance.checklist'))
		expect(stored).toBeTruthy()
		const parsed = JSON.parse(stored!)
		expect(parsed.export_log).toBe(true)

		await page.reload()
		await expect(page.getByTestId('nil-money-readiness')).toBeVisible({ timeout: 15000 })
		await expect(page.getByTestId('finance-check-export_log')).toBeChecked()
		await context.close()
	})

	test('recruiting and opportunity routes still resolve', async ({ page }) => {
		await page.goto('/app/recruiting/search')
		await expect(page.getByRole('heading', { name: 'Recruiting' })).toBeVisible({ timeout: 15000 })

		await page.goto('/app/recruiting/board')
		await expect(page.getByText('To Contact')).toBeVisible()

		await page.goto('/app/recruiting/blast')
		await expect(page.getByText('Recipients (from My Targets)')).toBeVisible()

		await page.goto('/app/opportunities/pipeline')
		await expect(page.getByTestId('opportunities-subnav')).toBeVisible()

		await page.goto('/app/opportunities/deals')
		await expect(page.getByText('NIL Deals')).toBeVisible()

		await page.goto('/app/opportunities/events')
		await expect(page.getByRole('heading', { name: 'Events & Camps' })).toBeVisible()
	})

	test('Network and Career Studio foundation screens still resolve', async ({ page }) => {
		await page.goto('/app/network')
		await expect(page.getByTestId('network-foundation')).toBeVisible({ timeout: 15000 })

		await page.goto('/app/career')
		await expect(page.getByTestId('career-studio-foundation')).toBeVisible()
	})

	test('PR-1 privacy containment remains intact on public landing', async ({ page }) => {
		await page.goto('/')
		const skipButton = page.getByTestId('skip-waitlist-button')
		if (await skipButton.isVisible().catch(() => false)) {
			await skipButton.click()
		}
		const bodyText = (await page.locator('body').textContent()) || ''
		expect(bodyText).toContain('NIL Roster')
		expect(bodyText).not.toContain('Athlete Ledger')
		expect(bodyText).not.toContain('support@athlete-ledger.com')
	})

	test('PR-2 Back/Forward routing remains intact', async ({ page }) => {
		await page.goto('/app/today')
		await expect(page.getByText('Business Portfolio Dashboard')).toBeVisible({ timeout: 15000 })

		await page.getByTestId('nav-recruiting').click()
		await page.waitForURL(/\/app\/recruiting\/search/)
		await expect(page.getByRole('heading', { name: 'Recruiting' })).toBeVisible()

		await page.goBack()
		await page.waitForURL(/\/app\/today/)
		await expect(page.getByText('Business Portfolio Dashboard')).toBeVisible()

		await page.goForward()
		await page.waitForURL(/\/app\/recruiting\/search/)
		await expect(page.getByRole('heading', { name: 'Recruiting' })).toBeVisible()
	})
})
