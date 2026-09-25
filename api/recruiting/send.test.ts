import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	sendMail: vi.fn(async () => ({ messageId: 'mid-1' })),
	getEmailTransporter: vi.fn(),
	getAuthenticatedSupabaseUser: vi.fn(),
	usersByToken: {} as Record<string, unknown>,
}))

vi.mock('../_lib/prisma', () => ({ prisma: null }))
vi.mock('../_lib/email', () => ({ sendMail: mocks.sendMail, getEmailTransporter: mocks.getEmailTransporter }))
vi.mock('../_lib/getAuthenticatedSupabaseUser', () => ({
	getAuthenticatedSupabaseUser: mocks.getAuthenticatedSupabaseUser,
}))
vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		auth: {
			getUser: async (token: string) => {
				const user = mocks.usersByToken[token]
				return user ? { data: { user }, error: null } : { data: { user: null }, error: new Error('bad token') }
			},
		},
	}),
}))

import handler from './send'

type MockRes = {
	statusCode: number
	body: any
	headers: Record<string, unknown>
	status: (c: number) => MockRes
	json: (b: unknown) => MockRes
	setHeader: (k: string, v: unknown) => void
	getHeader: (k: string) => unknown
}

function mockRes(): MockRes {
	const res: MockRes = {
		statusCode: 200,
		body: undefined,
		headers: {},
		status(c) {
			res.statusCode = c
			return res
		},
		json(b) {
			res.body = b
			return res
		},
		setHeader(k, v) {
			res.headers[k] = v
		},
		getHeader(k) {
			return res.headers[k]
		},
	}
	return res
}

async function call(method: string, body?: unknown, token?: string) {
	const req = { method, body, headers: token ? { authorization: `Bearer ${token}` } : {} }
	const res = mockRes()
	await handler(req as any, res as any)
	return res
}

const minor = {
	id: 'minor-1',
	email: 'minor@x.test',
	app_metadata: { recruiting_email_send: 'adult_verified' },
	user_metadata: { role: 'athlete_under_18', guardianRequired: true },
}
const adult = { id: 'adult-1', email: 'adult@x.test', app_metadata: { recruiting_email_send: 'adult_verified' }, user_metadata: { role: 'athlete_18_plus' } }
const unclaimedAdult = { id: 'adult-2', email: 'adult2@x.test', app_metadata: {}, user_metadata: { role: 'athlete_18_plus' } }

const oneCoach = {
	athlete: { fullName: 'Jordan Lee', email: 'spoof@evil.test' },
	clipUrl: 'https://video.test/clip',
	coach: { name: 'Coach K', email: 'k@school.edu' },
	confirmRecipientEmail: 'k@school.edu',
	subject: 'Hello',
	body: 'Hi <b>Coach</b>',
}

describe('/api/recruiting/send', () => {
	const originalEnv = { ...process.env }

	beforeEach(() => {
		mocks.sendMail.mockClear()
		mocks.getAuthenticatedSupabaseUser.mockReset()
		mocks.getAuthenticatedSupabaseUser.mockResolvedValue({ bypassed: false, user: null })
		mocks.usersByToken = { 'tok-minor': minor, 'tok-adult': adult, 'tok-unclaimed': unclaimedAdult }
		process.env.VITE_SUPABASE_URL = 'https://supabase.test'
		process.env.VITE_SUPABASE_ANON_KEY = 'anon'
		process.env.APP_URL = 'https://nilroster.test'
		process.env.RECRUITING_EMAIL_SEND_ENABLED = 'true'
		vi.spyOn(console, 'info').mockImplementation(() => {})
	})

	afterEach(() => {
		process.env = { ...originalEnv }
		vi.restoreAllMocks()
	})

	it('capability is disabled when the server flag is off, without authenticating', async () => {
		delete process.env.RECRUITING_EMAIL_SEND_ENABLED
		const res = await call('GET')
		expect(res.body).toEqual({ sendEnabled: false, reason: 'flag_off' })
		expect(mocks.getAuthenticatedSupabaseUser).not.toHaveBeenCalled()
	})

	it('capability is disabled for a minor even with the flag on', async () => {
		const res = await call('GET', undefined, 'tok-minor')
		expect(res.body).toEqual({ sendEnabled: false, reason: 'minor_account' })
	})

	it('rejects unauthenticated sends (401) and public-mode bypass never sends', async () => {
		expect((await call('POST', oneCoach)).statusCode).toBe(401)
		mocks.getAuthenticatedSupabaseUser.mockResolvedValue({ bypassed: true, user: null })
		expect((await call('POST', oneCoach)).statusCode).toBe(401)
		expect(mocks.sendMail).not.toHaveBeenCalled()
	})

	it('minor cannot send coach email, single or bulk, and the denial is audited', async () => {
		const single = await call('POST', oneCoach, 'tok-minor')
		expect(single.statusCode).toBe(403)
		expect(single.body.reason).toBe('minor_account')
		expect(single.body.audit).toMatchObject({ userId: 'minor-1', outcome: 'denied' })

		const bulk = await call(
			'POST',
			{ ...oneCoach, coach: undefined, coaches: [{ email: 'a@s.edu' }, { email: 'b@s.edu' }] },
			'tok-minor'
		)
		expect(bulk.statusCode).toBe(403)
		expect(mocks.sendMail).not.toHaveBeenCalled()
	})

	it('flag off denies even a permitted adult', async () => {
		delete process.env.RECRUITING_EMAIL_SEND_ENABLED
		const res = await call('POST', oneCoach, 'tok-adult')
		expect(res.statusCode).toBe(403)
		expect(res.body.reason).toBe('flag_off')
		expect(mocks.sendMail).not.toHaveBeenCalled()
	})

	it('adult without the operator-granted claim cannot send', async () => {
		const res = await call('POST', oneCoach, 'tok-unclaimed')
		expect(res.statusCode).toBe(403)
		expect(res.body.reason).toBe('not_permitted')
	})

	it('permitted adult still cannot bulk-send or skip per-recipient confirmation', async () => {
		const bulk = await call(
			'POST',
			{ ...oneCoach, coach: undefined, coaches: [{ email: 'a@s.edu' }, { email: 'b@s.edu' }], confirmRecipientEmail: 'a@s.edu' },
			'tok-adult'
		)
		expect(bulk.statusCode).toBe(400)
		const unconfirmed = await call('POST', { ...oneCoach, confirmRecipientEmail: undefined }, 'tok-adult')
		expect(unconfirmed.statusCode).toBe(400)
		expect(mocks.sendMail).not.toHaveBeenCalled()
	})

	it('permitted adult sends exactly one confirmed email with an audit record and no spoofed sender', async () => {
		const res = await call('POST', oneCoach, 'tok-adult')
		expect(res.statusCode).toBe(200)
		expect(res.body).toMatchObject({ success: true, sent: 1, audit: { userId: 'adult-1', outcome: 'sent', messageId: 'mid-1' } })
		expect(mocks.sendMail).toHaveBeenCalledTimes(1)
		const args = (mocks.sendMail.mock.calls[0] as unknown as [any])[0]
		expect(args.to).toBe('k@school.edu')
		expect(args.from).toBeUndefined()
		expect(args.replyTo).toContain('adult@x.test')
		expect(JSON.stringify(args)).not.toContain('spoof@evil.test')
		expect(args.html).toContain('&lt;b&gt;Coach&lt;/b&gt;')
	})
})
