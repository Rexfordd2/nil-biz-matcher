import { test, expect } from '@playwright/test'

/**
 * Closed-beta auth surface checks.
 *
 * Against Production (config-enabled closed beta):
 *   $env:BASE_URL="https://athlete-ledger.vercel.app"
 *   npx playwright test tests/closed-beta-auth.spec.ts
 *
 * Against a local beta build:
 *   $env:VITE_PUBLIC_MODE="true"
 *   $env:VITE_APP_MODE="beta"
 *   $env:VITE_EXISTING_USER_LOGIN_ENABLED="true"
 *   npm run build
 *   npx vite preview --host 127.0.0.1 --port 4173
 *   $env:BASE_URL="http://127.0.0.1:4173"
 *   npx playwright test tests/closed-beta-auth.spec.ts
 *
 * Does not require credentials. Does not enable workflow cloud or canary claims.
 */

test.describe('Closed beta auth surface', () => {
	test.beforeEach(async ({ context }) => {
		await context.clearCookies()
		await context.addInitScript(() => {
			localStorage.clear()
		})
	})

	test('login form is available for existing members', async ({ page }) => {
		await page.goto('/auth/login')
		await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 15000 })
		await expect(page.getByTestId('login-email')).toBeVisible()
		await expect(page.getByTestId('login-password')).toBeVisible()
		await expect(page.getByTestId('login-submit')).toBeVisible()
		await expect(page.getByTestId('auth-disabled')).toHaveCount(0)
		await expect(page.getByText(/Login disabled in public release/i)).toHaveCount(0)
		await expect(page.getByText(/Auth Debug Overlay/i)).toHaveCount(0)
	})

	test('signup remains invitation-only / disabled', async ({ page }) => {
		const signupRequests: string[] = []
		page.on('request', (req) => {
			const url = req.url()
			if (/signup|register|signUp/i.test(url) && req.method() !== 'GET') {
				signupRequests.push(`${req.method()} ${url}`)
			}
		})

		await page.goto('/auth/signup')
		await expect(page.getByTestId('auth-disabled')).toBeVisible({ timeout: 15000 })
		await expect(page.getByTestId('auth-disabled-message')).toContainText(/private beta|invitation/i)
		await expect(page.locator('form')).toHaveCount(0)
		expect(signupRequests).toEqual([])
	})

	test('unauthenticated /app routes stay behind AuthGate', async ({ page }) => {
		for (const path of [
			'/app',
			'/app/today',
			'/app/passport/profile',
			'/app/recruiting/search',
			'/app/opportunities/pipeline',
		]) {
			await page.goto(path)
			await expect(page.getByTestId('auth-gate-login')).toBeVisible({ timeout: 15000 })
			await expect(page.getByText('Welcome to NIL Roster')).toBeVisible()
			await expect(page.getByText('Business Portfolio Dashboard')).toHaveCount(0)
		}
	})

	test('beta mode redirects /demo to home', async ({ page }) => {
		await page.goto('/demo')
		await page.waitForURL((url) => !url.pathname.startsWith('/demo'), { timeout: 15000 })
		expect(new URL(page.url()).pathname).toBe('/')
	})

	test('query parameters do not enable signup or bypass auth', async ({ page }) => {
		await page.goto('/auth/signup?enableSignup=true&signup=1&public=false')
		await expect(page.getByTestId('auth-disabled')).toBeVisible({ timeout: 15000 })
		await expect(page.locator('form')).toHaveCount(0)

		await page.goto('/app?e2eBypass=true&bypassAuth=1&VITE_E2E_BYPASS_AUTH=true')
		await expect(page.getByTestId('auth-gate-login')).toBeVisible({ timeout: 15000 })
	})

	test('invalid password shows a friendly error without blanking the form', async ({ page }) => {
		await page.goto('/auth/login')
		await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 15000 })
		await page.getByTestId('login-email').fill('closed-beta-invalid@example.com')
		await page.getByTestId('login-password').fill('definitely-not-a-real-password')
		await page.getByTestId('login-submit').click()
		await expect(page.getByTestId('login-error')).not.toHaveText('', { timeout: 20000 })
		await expect(page.getByTestId('login-form')).toBeVisible()
		await expect(page).toHaveURL(/\/auth\/login/)
	})
})
