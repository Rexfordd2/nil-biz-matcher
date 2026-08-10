import { test, expect } from '@playwright/test'

/**
 * Compatibility suite retained for older CI wiring.
 * Canonical public-auth coverage lives in tests/public-auth.spec.ts.
 *
 * Expects Production contract:
 *   VITE_PUBLIC_MODE=false
 *   VITE_APP_MODE=beta
 */

test.describe('Public auth surface (compat)', () => {
	test.beforeEach(async ({ context }) => {
		await context.clearCookies()
		await context.addInitScript(() => {
			localStorage.clear()
		})
	})

	test('login form is available', async ({ page }) => {
		await page.goto('/auth/login')
		await expect(page.getByTestId('auth-disabled')).toHaveCount(0)
		await expect(page.getByText(/Login disabled in public release/i)).toHaveCount(0)
		await expect(page.getByText(/Auth Debug Overlay/i)).toHaveCount(0)

		const loginForm = page.getByTestId('login-form')
		const unavailable = page.getByTestId('auth-unavailable')
		await expect(loginForm.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(
				true,
				'Supabase env not baked into this build; run against Production or a Supabase-configured preview',
			)
		}
		await expect(loginForm).toBeVisible()
		await expect(page.getByTestId('login-email')).toBeVisible()
		await expect(page.getByTestId('login-password')).toBeVisible()
		await expect(page.getByTestId('login-submit')).toBeVisible()
	})

	test('signup is publicly available', async ({ page }) => {
		await page.goto('/auth/signup')
		await expect(page.getByTestId('auth-disabled')).toHaveCount(0)
		await expect(page.getByText(/private beta|invitation/i)).toHaveCount(0)
		const signupForm = page.getByTestId('signup-form')
		const unavailable = page.getByTestId('auth-unavailable')
		await expect(signupForm.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(true, 'Supabase env not baked into this build')
		}
		await expect(signupForm).toBeVisible()
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

	test('query parameters do not bypass auth', async ({ page }) => {
		await page.goto('/app?e2eBypass=true&bypassAuth=1&VITE_E2E_BYPASS_AUTH=true')
		await expect(page.getByTestId('auth-gate-login')).toBeVisible({ timeout: 15000 })
	})

	test('password reset route is available and rejects missing recovery session', async ({ page }) => {
		await page.goto('/auth/reset')
		await expect(page.getByTestId('auth-disabled')).toHaveCount(0)
		const unavailable = page.getByTestId('auth-unavailable')
		const form = page.getByTestId('reset-form')
		await expect(form.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(true, 'Supabase env not baked into this build')
		}
		await expect(form).toBeVisible()
		await expect(page.getByTestId('reset-invalid-session')).toBeVisible({ timeout: 15000 })
		await expect(page.getByTestId('reset-submit')).toBeDisabled()
		await expect(page.locator('form')).toHaveCount(1)
	})

	test('forgot-password control is present on login', async ({ page }) => {
		await page.goto('/auth/login')
		const loginForm = page.getByTestId('login-form')
		const unavailable = page.getByTestId('auth-unavailable')
		await expect(loginForm.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(true, 'Supabase env not baked into this build')
		}
		await expect(page.getByTestId('login-forgot-password')).toBeVisible()
	})

	test('invalid password shows a friendly error without blanking the form', async ({ page }) => {
		await page.goto('/auth/login')
		const loginForm = page.getByTestId('login-form')
		const unavailable = page.getByTestId('auth-unavailable')
		await expect(loginForm.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(true, 'Supabase env not baked into this build')
		}
		await expect(loginForm).toBeVisible()
		await page.getByTestId('login-email').fill('closed-beta-invalid@example.com')
		await page.getByTestId('login-password').fill('definitely-not-a-real-password')
		await page.getByTestId('login-submit').click()
		await expect(page.getByTestId('login-error')).not.toHaveText('', { timeout: 20000 })
		await expect(page.getByTestId('login-form')).toBeVisible()
		await expect(page).toHaveURL(/\/auth\/login/)
	})
})
