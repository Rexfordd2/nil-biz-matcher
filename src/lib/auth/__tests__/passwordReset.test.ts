import { describe, expect, it, vi } from 'vitest'
import { validateNewPassword } from '../passwordReset'
import { friendlyAuthErrorMessage } from '../../supabaseErrors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

describe('validateNewPassword', () => {
	it('rejects passwords under 8 characters', () => {
		expect(validateNewPassword('short', 'short')).toBe('Password must be at least 8 characters')
	})

	it('rejects mismatched passwords', () => {
		expect(validateNewPassword('longenough', 'different1')).toBe('Passwords do not match')
	})

	it('accepts matching passwords of sufficient length', () => {
		expect(validateNewPassword('longenough', 'longenough')).toBeNull()
	})
})

describe('password recovery source contracts', () => {
	it('reset route follows existing-user-login gate, not PUBLIC_MODE alone', () => {
		const reset = fs.readFileSync(path.join(root, 'src/pages/auth/ResetRoute.tsx'), 'utf8')
		expect(reset).toContain('isExistingUserLoginEnabled')
		expect(reset).toContain('PUBLIC_MODE && !isExistingUserLoginEnabled()')
		expect(reset).not.toMatch(/if\s*\(\s*PUBLIC_MODE\s*\)\s*\{\s*return\s*<PublicAuthDisabled kind="reset"/)
	})

	it('forgot-password captures Supabase error and shows neutral success copy', () => {
		const login = fs.readFileSync(path.join(root, 'src/components/auth/LoginSupabase.tsx'), 'utf8')
		expect(login).toContain('resetPasswordForEmail')
		expect(login).toContain('const { error }')
		expect(login).toContain('If an account exists for that email, a password reset link has been sent.')
		expect(login).toContain('login-reset-info')
		expect(login).toContain('/auth/reset')
	})

	it('successful password update routes to login with notice, not signup', () => {
		const reset = fs.readFileSync(path.join(root, 'src/pages/auth/ResetRoute.tsx'), 'utf8')
		expect(reset).toContain("navigate('/auth/login?passwordUpdated=1'")
		expect(reset).toContain('updateUser({ password })')
		expect(reset).not.toContain('/auth/signup')
	})

	it('signup remains PUBLIC_MODE gated and independent of reset enablement', () => {
		const signup = fs.readFileSync(path.join(root, 'src/pages/auth/SignupRoute.tsx'), 'utf8')
		expect(signup).toMatch(/if\s*\(\s*PUBLIC_MODE\s*\)/)
		expect(signup).not.toContain('isExistingUserLoginEnabled')
	})
})

describe('forgot-password / reset error messaging', () => {
	it('surfaces sanitized reset errors without dumping provider payloads', () => {
		const msg = friendlyAuthErrorMessage({ message: 'Auth session missing', status: 401 }, { context: 'reset' })
		expect(msg).toMatch(/invalid or expired/i)
		expect(msg).not.toMatch(/Auth session missing/)
	})

	it('uses a safe default for unclassified reset failures', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const msg = friendlyAuthErrorMessage({ message: 'something obscure', status: 500 }, { context: 'reset' })
		expect(msg).toMatch(/could not update your password/i)
		warn.mockRestore()
	})
})

describe('updateUser call contract', () => {
	it('calls updateUser once with password when validation passes', async () => {
		const updateUser = vi.fn(async (_args: { password: string }) => ({ data: { user: {} }, error: null }))
		const password = 'longenough'
		const confirm = 'longenough'
		expect(validateNewPassword(password, confirm)).toBeNull()
		await updateUser({ password })
		expect(updateUser).toHaveBeenCalledTimes(1)
		expect(updateUser).toHaveBeenCalledWith({ password })
	})
})
