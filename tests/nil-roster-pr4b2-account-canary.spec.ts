import { test, expect } from '@playwright/test'

/**
 * PR-4B2 account-canary browser matrix (local preview).
 *
 * Expects a flag-off / login-disabled public beta build by default, OR env-driven
 * builds documented in the PR-4B2 validation section.
 *
 *   PowerShell (flag-off + login disabled — Production-shaped):
 *   $env:VITE_APP_MODE="beta"
 *   $env:VITE_E2E_BYPASS_AUTH="true"
 *   $env:VITE_PUBLIC_MODE="true"
 *   $env:VITE_ALLOW_MISSING_GOOGLE_MAPS_KEY="true"
 *   $env:VITE_WORKFLOW_CLOUD_PERSISTENCE="false"
 *   $env:VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE="off"
 *   $env:VITE_EXISTING_USER_LOGIN_ENABLED="false"
 *   npm run build
 *   npx vite preview --host 127.0.0.1 --port 4173
 *   $env:BASE_URL="http://127.0.0.1:4173"
 *   npx playwright test tests/nil-roster-pr4b2-account-canary.spec.ts --workers=1
 */

async function assertNoCloudUi(page) {
	const body = (await page.locator('body').textContent()) || ''
	expect(body).not.toContain('Checking secure storage')
	expect(body).not.toContain('Saved to NIL Roster')
	expect(body).not.toContain('Save your existing records to NIL Roster')
	expect(body).not.toContain('Records need review')
	expect(body).not.toContain('Cloud saving is temporarily unavailable')
	expect(body).not.toContain('Continue with cloud')
}

test.describe('NIL Roster PR-4B2 account canary (flag-off / login gates)', () => {
	test.beforeEach(async ({ context }) => {
		await context.clearCookies()
		await context.addInitScript(() => {
			localStorage.clear()
		})
	})

	test('signed out / master off: opportunities/deals/events stay local', async ({ page }) => {
		await page.goto('/app/opportunities/pipeline')
		await expect(page.getByTestId('opportunities-subnav')).toBeVisible({ timeout: 15000 })
		await assertNoCloudUi(page)

		await page.goto('/app/opportunities/deals')
		await expect(page.getByText('NIL Deals')).toBeVisible({ timeout: 15000 })
		await assertNoCloudUi(page)

		await page.goto('/app/opportunities/events')
		await expect(page.getByText('Events & Camps').first()).toBeVisible({ timeout: 15000 })
		await assertNoCloudUi(page)
	})

	test('existing-user login disabled under public mode', async ({ page }) => {
		await page.goto('/auth/login')
		await expect(page.getByTestId('auth-disabled')).toBeVisible({ timeout: 15000 })
		await expect(page.getByTestId('auth-disabled-message')).toContainText(/not enabled|unavailable|demo surface/i)
	})

	test('signup remains disabled under public mode', async ({ page }) => {
		await page.goto('/auth/signup')
		await expect(page.getByTestId('auth-disabled')).toBeVisible({ timeout: 15000 })
		await expect(page.getByTestId('auth-disabled-message')).toContainText(/not available|demo surface|unavailable/i)
	})

	test('query parameters do not enable login', async ({ page }) => {
		await page.goto('/auth/login?existingUserLogin=true&canary=true&workflow_cloud_persistence_canary=true')
		await expect(page.getByTestId('auth-disabled')).toBeVisible({ timeout: 15000 })
	})
})
