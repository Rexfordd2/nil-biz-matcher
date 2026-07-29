import { test, expect } from '@playwright/test'

/**
 * PR-4B1 local-mode regression (flag false / default).
 *
 *   PowerShell:
 *   $env:VITE_APP_MODE="beta"
 *   $env:VITE_E2E_BYPASS_AUTH="true"
 *   $env:VITE_PUBLIC_MODE="true"
 *   $env:VITE_ALLOW_MISSING_GOOGLE_MAPS_KEY="true"
 *   $env:VITE_WORKFLOW_CLOUD_PERSISTENCE="false"
 *   npm run build
 *   npx vite preview --host 127.0.0.1 --port 4173
 *   $env:BASE_URL="http://127.0.0.1:4173"
 *   npx playwright test tests/nil-roster-pr4b1-local-mode.spec.ts --workers=1
 */

test.describe('NIL Roster PR-4B1 local-mode (flag false)', () => {
	test.beforeEach(async ({ context }) => {
		await context.clearCookies()
		await context.addInitScript(() => {
			localStorage.clear()
		})
	})

	test('opportunities/deals/events stay local with no cloud gate copy', async ({ page }) => {
		await page.goto('/app/opportunities/pipeline')
		await expect(page.getByTestId('opportunities-subnav')).toBeVisible({ timeout: 15000 })
		await expect(page.getByText('Opportunities').first()).toBeVisible()

		const bodyPipeline = (await page.locator('body').textContent()) || ''
		expect(bodyPipeline).not.toContain('Checking secure storage')
		expect(bodyPipeline).not.toContain('Saved to NIL Roster')
		expect(bodyPipeline).not.toContain('Save your existing records to NIL Roster')
		expect(bodyPipeline).not.toContain('Records need review')
		expect(bodyPipeline).not.toContain('Cloud saving is temporarily unavailable')
		expect(bodyPipeline).not.toContain('Continue with cloud')

		await page.goto('/app/opportunities/deals')
		await expect(page.getByText('NIL Deals')).toBeVisible({ timeout: 15000 })
		await expect(page.getByRole('button', { name: 'Add Deal' })).toBeEnabled()
		const bodyDeals = (await page.locator('body').textContent()) || ''
		expect(bodyDeals).not.toContain('Checking secure storage')
		expect(bodyDeals).not.toContain('Saved to NIL Roster')

		await page.goto('/app/opportunities/events')
		await expect(page.getByText('Events & Camps').first()).toBeVisible({ timeout: 15000 })
		await expect(page.getByRole('button', { name: 'New' })).toBeEnabled()
		const bodyEvents = (await page.locator('body').textContent()) || ''
		expect(bodyEvents).not.toContain('Checking secure storage')
		expect(bodyEvents).not.toContain('Keep using this device for now')
	})
})
