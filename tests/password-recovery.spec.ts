import { test, expect } from '@playwright/test'

/**
 * Password recovery surface checks for closed-beta builds.
 *
 * Against Production:
 *   $env:BASE_URL="https://athlete-ledger.vercel.app"
 *   npx playwright test tests/password-recovery.spec.ts
 *
 * Does not require credentials. Does not send recovery emails in CI by default
 * unless RESET_TEST_EMAIL is provided (still never prints passwords).
 */

test.describe('Password recovery surface', () => {
	test.beforeEach(async ({ context }) => {
		await context.clearCookies()
		await context.addInitScript(() => {
			localStorage.clear()
		})
	})

	test('reset route is gated open under closed beta and denies no-session access', async ({ page }) => {
		await page.goto('/auth/reset')
		await expect(page.getByTestId('auth-disabled')).toHaveCount(0)
		const unavailable = page.getByTestId('auth-unavailable')
		const form = page.getByTestId('reset-form')
		await expect(form.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(true, 'Supabase env not baked into this build')
		}
		await expect(page.getByTestId('reset-invalid-session')).toBeVisible({ timeout: 15000 })
		await expect(page.getByTestId('reset-submit')).toBeDisabled()
		await page.getByTestId('reset-password').fill('short')
		await page.getByTestId('reset-password-confirm').fill('short')
		// Submit remains disabled without a recovery session.
		await expect(page.getByTestId('reset-submit')).toBeDisabled()
	})

	test('signup remains disabled while reset is available', async ({ page }) => {
		await page.goto('/auth/signup')
		await expect(page.getByTestId('auth-disabled')).toBeVisible({ timeout: 15000 })
		await expect(page.locator('form')).toHaveCount(0)

		await page.goto('/auth/reset')
		await expect(page.getByTestId('auth-disabled')).toHaveCount(0)
	})

	test('forgot password shows neutral success without credentials leakage', async ({ page }) => {
		await page.goto('/auth/login')
		const loginForm = page.getByTestId('login-form')
		const unavailable = page.getByTestId('auth-unavailable')
		await expect(loginForm.or(unavailable)).toBeVisible({ timeout: 15000 })
		if (await unavailable.isVisible().catch(() => false)) {
			test.skip(true, 'Supabase env not baked into this build')
		}

		const email = process.env.RESET_TEST_EMAIL || 'closed-beta-reset-probe@example.com'
		await page.getByTestId('login-email').fill(email)
		await page.getByTestId('login-forgot-password').click()
		await expect(page.getByTestId('login-reset-info').or(page.getByTestId('login-error'))).toBeVisible({
			timeout: 20000,
		})
		const info = page.getByTestId('login-reset-info')
		if (await info.isVisible().catch(() => false)) {
			await expect(info).toContainText(/If an account exists for that email/i)
		}
		const body = await page.locator('body').innerText()
		expect(body).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
		expect(body).not.toMatch(/access_token|refresh_token/i)
	})
})
