import { test, expect } from '@playwright/test'

/**
 * Public auth surface checks.
 *
 * Production contract:
 *   VITE_PUBLIC_MODE=false
 *   VITE_APP_MODE=beta
 *
 * Against Production:
 *   $env:BASE_URL="https://athlete-ledger.vercel.app"
 *   npx playwright test tests/public-auth.spec.ts
 *
 * Against a local beta build:
 *   $env:VITE_PUBLIC_MODE="false"
 *   $env:VITE_APP_MODE="beta"
 *   npm run build
 *   npx vite preview --host 127.0.0.1 --port 4173
 *   $env:BASE_URL="http://127.0.0.1:4173"
 *   npx playwright test tests/public-auth.spec.ts
 */

test.describe('Public auth surface', () => {
	test.beforeEach(async ({ context }) => {
		await context.clearCookies()
		await context.addInitScript(() => {
			localStorage.clear()
		})
	})

	test('signup form is publicly available', async ({ page }) => {
		await page.goto('/auth/signup')
		await expect(page.getByTestId('auth-disabled')).toHaveCount(0)
		await expect(page.getByText(/private beta|invitation only|invite-only/i)).toHaveCount(0)

		const signupForm = page.getByTestId('signup-form')
		const unavailable = page.getByTestId('auth-unavailable')
		await expect(signupForm.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(true, 'Supabase env not baked into this build')
		}
		await expect(signupForm).toBeVisible()
		await expect(page.getByTestId('signup-display-name')).toBeVisible()
		await expect(page.getByTestId('signup-role')).toBeVisible()
		await expect(page.getByTestId('signup-email')).toBeVisible()
		await expect(page.getByTestId('signup-password')).toBeVisible()
		await expect(page.getByTestId('signup-password-confirm')).toBeVisible()
		await expect(page.getByTestId('signup-terms')).toBeVisible()
		await expect(page.getByTestId('signup-submit')).toBeVisible()
		await expect(page.getByTestId('signup-login-link')).toBeVisible()
	})

	test('signup client validation: terms, short password, mismatch', async ({ page }) => {
		await page.goto('/auth/signup')
		const signupForm = page.getByTestId('signup-form')
		const unavailable = page.getByTestId('auth-unavailable')
		await expect(signupForm.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(true, 'Supabase env not baked into this build')
		}

		await page.getByTestId('signup-display-name').fill('Public Auth Tester')
		await page.getByTestId('signup-email').fill('public-auth-validation@example.com')
		await page.getByTestId('signup-password').fill('short')
		await page.getByTestId('signup-password-confirm').fill('short')
		await page.getByTestId('signup-submit').click()
		await expect(page.getByTestId('signup-error')).toContainText(/Terms|Privacy/i)

		await page.getByTestId('signup-terms').check()
		await page.getByTestId('signup-submit').click()
		await expect(page.getByTestId('signup-error')).toContainText(/at least 8/i)

		await page.getByTestId('signup-password').fill('longenough1')
		await page.getByTestId('signup-password-confirm').fill('longenough2')
		await page.getByTestId('signup-submit').click()
		await expect(page.getByTestId('signup-error')).toContainText(/do not match/i)
	})

	test('login form is publicly available', async ({ page }) => {
		await page.goto('/auth/login')
		await expect(page.getByTestId('auth-disabled')).toHaveCount(0)
		const loginForm = page.getByTestId('login-form')
		const unavailable = page.getByTestId('auth-unavailable')
		await expect(loginForm.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(true, 'Supabase env not baked into this build')
		}
		await expect(loginForm).toBeVisible()
		await expect(page.getByTestId('login-forgot-password')).toBeVisible()
		await expect(page.getByTestId('login-need-account')).toBeVisible()
	})

	test('unauthenticated /app routes stay behind AuthGate', async ({ page }) => {
		for (const path of [
			'/app',
			'/app/today',
			'/app/passport/profile',
			'/app/recruiting/search',
			'/app/opportunities/pipeline',
			'/app/settings',
		]) {
			await page.goto(path)
			await expect(page.getByTestId('auth-gate-login')).toBeVisible({ timeout: 15000 })
			await expect(page.getByTestId('auth-gate-signup')).toBeVisible()
			await expect(page.getByText('Business Portfolio Dashboard')).toHaveCount(0)
		}
	})

	test('beta mode redirects /demo to home', async ({ page }) => {
		await page.goto('/demo')
		await page.waitForURL((url) => !url.pathname.startsWith('/demo'), { timeout: 15000 })
		expect(new URL(page.url()).pathname).toBe('/')
	})

	test('query parameters do not bypass auth gate', async ({ page }) => {
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
	})

	test('invalid password shows a friendly error without blanking the form', async ({ page }) => {
		await page.goto('/auth/login')
		const loginForm = page.getByTestId('login-form')
		const unavailable = page.getByTestId('auth-unavailable')
		await expect(loginForm.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(true, 'Supabase env not baked into this build')
		}
		await page.getByTestId('login-email').fill('public-auth-invalid@example.com')
		await page.getByTestId('login-password').fill('definitely-not-a-real-password')
		await page.getByTestId('login-submit').click()
		await expect(page.getByTestId('login-error')).not.toHaveText('', { timeout: 20000 })
		await expect(page.getByTestId('login-form')).toBeVisible()
		await expect(page).toHaveURL(/\/auth\/login/)
	})

	test('home exposes Create Account and Log In CTAs', async ({ page }) => {
		await page.goto('/')
		await expect(page.getByTestId('get-started-button')).toBeVisible({ timeout: 15000 })
		await expect(page.getByTestId('get-started-button')).toContainText(/Create Account/i)
		await expect(page.getByTestId('login-button')).toBeVisible()
	})
})
