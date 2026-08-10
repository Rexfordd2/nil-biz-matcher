import { describe, expect, it, vi, beforeEach } from 'vitest'

const signUpMock = vi.fn()
const resendMock = vi.fn()

vi.mock('../../supabaseClient', () => ({
	supabase: {
		auth: {
			signUp: (...args: unknown[]) => signUpMock(...args),
			resend: (...args: unknown[]) => resendMock(...args),
		},
	},
}))

describe('signUp result semantics', () => {
	beforeEach(() => {
		signUpMock.mockReset()
		resendMock.mockReset()
	})

	it('returns requiresEmailConfirmation when user exists without session', async () => {
		signUpMock.mockResolvedValue({
			data: { user: { id: 'u1', email: 'a@example.com' }, session: null },
			error: null,
		})
		const { signUp } = await import('../../authSupabase')
		const result = await signUp({
			email: 'a@example.com',
			password: 'password123',
			fullName: 'A',
			metadata: { role: 'athlete' },
		})
		expect(result.error).toBeNull()
		expect(result.user?.id).toBe('u1')
		expect(result.session).toBeNull()
		expect(result.requiresEmailConfirmation).toBe(true)
	})

	it('returns session when Supabase issues one immediately', async () => {
		signUpMock.mockResolvedValue({
			data: {
				user: { id: 'u2', email: 'b@example.com' },
				session: { access_token: 'tok' },
			},
			error: null,
		})
		const { signUp } = await import('../../authSupabase')
		const result = await signUp({
			email: 'b@example.com',
			password: 'password123',
		})
		expect(result.requiresEmailConfirmation).toBe(false)
		expect(result.session).toBeTruthy()
	})
})
