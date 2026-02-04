import { test, expect } from '@playwright/test'

/**
 * Auth Gate Acceptance Tests
 * 
 * These tests verify that the Auth Gate provides clear navigation options
 * and eliminates dead ends after logout or declining sign-in.
 */

test.describe('Auth Gate', () => {
	test.beforeEach(async ({ context }) => {
		// Clear all storage to simulate logged-out state
		await context.clearCookies()
		await context.clearPermissions()
		await context.addInitScript(() => {
			localStorage.clear()
		})
	})

	test('Auth Gate renders on /app when logged out', async ({ page }) => {
		// Navigate to /app without authentication
		await page.goto('/app')
		
		// URL should stay at /app (no redirect)
		await expect(page).toHaveURL(/\/app/)
		
		// Auth Gate should be visible with all required buttons
		await expect(page.getByTestId('auth-gate-login')).toBeVisible()
		await expect(page.getByTestId('auth-gate-signup')).toBeVisible()
		await expect(page.getByTestId('auth-gate-waitlist')).toBeVisible()
		await expect(page.getByTestId('auth-gate-back-home')).toBeVisible()
		
		// Should show welcome message
		await expect(page.getByText('Welcome to Athlete Ledger')).toBeVisible()
	})

	test('Auth Gate Login button navigates to login page', async ({ page }) => {
		await page.goto('/app')
		
		// Click Login button
		const loginButton = page.getByTestId('auth-gate-login')
		await loginButton.click()
		
		// Should navigate to login page with returnTo parameter
		await expect(page).toHaveURL(/\/auth\/login/)
		const url = page.url()
		expect(url).toContain('returnTo')
	})

	test('Auth Gate Sign Up button navigates to signup page', async ({ page }) => {
		await page.goto('/app')
		
		// Click Sign Up button
		const signupButton = page.getByTestId('auth-gate-signup')
		await signupButton.click()
		
		// Should navigate to signup page with returnTo parameter
		await expect(page).toHaveURL(/\/auth\/signup/)
		const url = page.url()
		expect(url).toContain('returnTo')
	})

	test('Auth Gate Join Waitlist button navigates to waitlist page', async ({ page }) => {
		await page.goto('/app')
		
		// Click Join Waitlist button
		const waitlistButton = page.getByTestId('auth-gate-waitlist')
		await waitlistButton.click()
		
		// Should navigate to waitlist page
		await expect(page).toHaveURL(/\/waitlist/)
	})

	test('Auth Gate Back Home button navigates to home', async ({ page }) => {
		await page.goto('/app')
		
		// Click Back Home button
		const backButton = page.getByTestId('auth-gate-back-home')
		await backButton.click()
		
		// Should navigate to home page (or demo in demo mode)
		const url = page.url()
		expect(url.endsWith('/') || url.endsWith('/demo')).toBeTruthy()
	})

	test('Login page has Back navigation options', async ({ page }) => {
		await page.goto('/auth/login')
		
		// Should have back to gate button
		await expect(page.getByTestId('login-back-to-gate')).toBeVisible()
		
		// Should have back home button
		await expect(page.getByTestId('login-back-home')).toBeVisible()
		
		// Click back to gate - should go to /app
		await page.getByTestId('login-back-to-gate').click()
		await expect(page).toHaveURL(/\/app/)
		
		// Should show Auth Gate
		await expect(page.getByTestId('auth-gate-login')).toBeVisible()
	})

	test('Signup page has Back navigation options', async ({ page }) => {
		await page.goto('/auth/signup')
		
		// Should have back to gate button
		await expect(page.getByTestId('signup-back-to-gate')).toBeVisible()
		
		// Should have back home button
		await expect(page.getByTestId('signup-back-home')).toBeVisible()
		
		// Click back to gate - should go to /app
		await page.getByTestId('signup-back-to-gate').click()
		await expect(page).toHaveURL(/\/app/)
		
		// Should show Auth Gate
		await expect(page.getByTestId('auth-gate-login')).toBeVisible()
	})

	test('Auth Gate appears after simulated logout', async ({ page }) => {
		// This test simulates the logout flow by going to /app
		// (In real usage, logout navigates to /app which shows the gate)
		
		await page.goto('/app')
		
		// Should show Auth Gate (as if logged out)
		await expect(page.getByTestId('auth-gate-login')).toBeVisible()
		await expect(page.getByText('Welcome to Athlete Ledger')).toBeVisible()
		
		// No dead end - all navigation options are available
		await expect(page.getByTestId('auth-gate-back-home')).toBeVisible()
	})
})
