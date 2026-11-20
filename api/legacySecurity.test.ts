import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const prismaMock = vi.hoisted(() => ({
	user: { findUnique: vi.fn(), create: vi.fn() },
	outreach: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
	coach: { findMany: vi.fn() },
	highlightClip: { findUnique: vi.fn() },
}))
const mailMock = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }))

vi.mock('./_lib/prisma.js', () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock('./_lib/prisma', () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock('nodemailer', () => {
	mailMock.createTransport.mockReturnValue({ sendMail: mailMock.sendMail })
	return { default: { createTransport: mailMock.createTransport }, createTransport: mailMock.createTransport }
})

import login from './auth/login.js'
import register from './auth/register.js'
import me from './auth/me.js'
import logout from './auth/logout.js'
import send from './recruiting/send.js'
import track from './recruiting/track.js'
import { signSession, verifySession } from './_lib/auth.js'

const STRONG_SECRET = 'synthetic-secret-0123456789abcdef-0123456789'

// Production-like configuration with every variable that could previously
// enable a legacy session, the mail relay, or the public-mode bypass.
const PRODUCTION_LIKE: Record<string, string> = {
	NODE_ENV: 'production',
	VERCEL_ENV: 'production',
	DATABASE_URL: 'file:/tmp/synthetic-legacy.db',
	AUTH_SECRET: STRONG_SECRET,
	JWT_SECRET: STRONG_SECRET,
	VITE_PUBLIC_MODE: 'true',
	NEXT_PUBLIC_PUBLIC_MODE: 'true',
	PUBLIC_MODE: 'true',
	APP_URL: 'https://synthetic.example.invalid',
	SMTP_HOST: 'smtp.example.invalid',
	SMTP_PORT: '587',
	SMTP_USER: 'synthetic',
	SMTP_PASS: 'synthetic',
	SMTP_FROM: 'noreply@example.invalid',
	VITE_SUPABASE_URL: 'https://synthetic.supabase.invalid',
	VITE_SUPABASE_ANON_KEY: 'synthetic-anon-key',
}
const saved: Record<string, string | undefined> = {}

function response() {
	const res = {
		statusCode: 0,
		headers: {} as Record<string, string>,
		body: undefined as unknown,
		redirectedTo: undefined as string | undefined,
		status(code: number) { res.statusCode = code; return res },
		json(body: unknown) { res.body = body; return res },
		send(body: unknown) { res.body = body; return res },
		setHeader(name: string, value: string) { res.headers[name.toLowerCase()] = value; return res },
		redirect(...args: unknown[]) { res.redirectedTo = String(args[args.length - 1]); res.statusCode = 302; return res },
	}
	return res
}

function request(init: Partial<VercelRequest>): VercelRequest {
	return { method: 'POST', headers: {}, query: {}, body: {}, ...init } as VercelRequest
}

function forgedToken(secret: string, userId = 'legacy-user-1') {
	const payload = `v1.${userId}.${Date.now() + 60_000}`
	const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64')
		.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
	return `${payload}.${sig}`
}

function expectNoBackendEffects() {
	for (const model of Object.values(prismaMock)) {
		for (const fn of Object.values(model)) expect(fn).not.toHaveBeenCalled()
	}
	expect(mailMock.createTransport).not.toHaveBeenCalled()
	expect(mailMock.sendMail).not.toHaveBeenCalled()
}

beforeEach(() => {
	for (const key of Object.keys(PRODUCTION_LIKE)) saved[key] = process.env[key]
	Object.assign(process.env, PRODUCTION_LIKE)
	prismaMock.user.findUnique.mockResolvedValue({ id: 'legacy-user-1', email: 'known@example.invalid' })
	prismaMock.outreach.findUnique.mockResolvedValue(null)
})

afterEach(() => {
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) delete process.env[key]
		else process.env[key] = value
	}
	vi.clearAllMocks()
})

describe('legacy authentication is disabled', () => {
	it('login never issues a session, even for a known synthetic email', async () => {
		const res = response()
		await login(request({ body: { email: 'known@example.invalid', password: 'anything' } }), res as unknown as VercelResponse)
		expect(res.statusCode).toBe(410)
		expect(res.body).toMatchObject({ code: 'LEGACY_AUTH_DISABLED' })
		expect(res.headers['set-cookie']).toBeUndefined()
		expectNoBackendEffects()
	})

	it('register never creates an account or a session', async () => {
		const res = response()
		await register(request({ body: { email: 'new@example.invalid', fullName: 'Synthetic New' } }), res as unknown as VercelResponse)
		expect(res.statusCode).toBe(410)
		expect(res.headers['set-cookie']).toBeUndefined()
		expectNoBackendEffects()
	})

	it('session introspection rejects valid-looking tokens and ignores public mode', async () => {
		for (const token of [forgedToken(STRONG_SECRET), forgedToken('dev-secret-change-me')]) {
			const res = response()
			await me(request({ method: 'GET', headers: { cookie: `al_session=${token}`, authorization: `Bearer ${token}` } }),
				res as unknown as VercelResponse)
			expect(res.statusCode).toBe(410)
			expect(res.body).not.toHaveProperty('user')
		}
		expectNoBackendEffects()
	})

	it('wrong methods are rejected before anything else', async () => {
		for (const [handler, method] of [[login, 'GET'], [register, 'GET'], [me, 'POST']] as const) {
			const res = response()
			await handler(request({ method }), res as unknown as VercelResponse)
			expect(res.statusCode).toBe(405)
		}
	})

	it('logout only clears the legacy cookie', async () => {
		const res = response()
		await logout(request({ method: 'POST' }), res as unknown as VercelResponse)
		expect(res.statusCode).toBe(200)
		expect(res.headers['set-cookie']).toMatch(/^al_session=;.*Max-Age=0/)
		expectNoBackendEffects()
	})
})

describe('legacy session signing fails closed', () => {
	it.each([
		['unset', undefined],
		['empty', ''],
		['whitespace', '    '],
		['the old default', 'dev-secret-change-me'],
		['too short', 'short-secret'],
	])('refuses to sign or verify when the secret is %s', (_label, value) => {
		for (const key of ['AUTH_SECRET', 'JWT_SECRET']) {
			if (value === undefined) delete process.env[key]
			else process.env[key] = value
		}
		expect(() => signSession('legacy-user-1')).toThrow(/no secure secret/)
		expect(verifySession(forgedToken('dev-secret-change-me'))).toBeNull()
		expect(verifySession(forgedToken(value || 'x'))).toBeNull()
	})

	it('with a strong secret, rejects tokens signed with the old default', () => {
		expect(verifySession(forgedToken('dev-secret-change-me'))).toBeNull()
		expect(verifySession(signSession('legacy-user-1'))).toEqual({ userId: 'legacy-user-1' })
		expect(verifySession(`${signSession('legacy-user-1')}x`)).toBeNull()
	})
})

describe('coach outreach email is disabled', () => {
	const payload = {
		athlete: { fullName: 'Synthetic Athlete', email: 'spoofed-sender@example.invalid', id: 'legacy-user-1' },
		clipUrl: 'https://clips.example.invalid/1',
		coaches: [{ name: 'Any Recipient', email: 'arbitrary@example.invalid' }],
		coachIds: ['coach-1'],
		clipId: 'clip-1',
		subject: 'Synthetic',
		body: '<script>alert(1)</script>',
	}

	it('unauthenticated requests cannot send, even in public mode with SMTP configured', async () => {
		const res = response()
		await send(request({ body: payload }), res as unknown as VercelResponse)
		expect(res.statusCode).toBe(503)
		expect(res.body).toMatchObject({ code: 'OUTREACH_DISABLED' })
		expectNoBackendEffects()
	})

	it('requests carrying Supabase cookies or bearer tokens cannot send either', async () => {
		const res = response()
		await send(request({
			body: payload,
			headers: { authorization: 'Bearer synthetic-token', cookie: 'sb-synthetic-auth-token=synthetic' },
		}), res as unknown as VercelResponse)
		expect(res.statusCode).toBe(503)
		expectNoBackendEffects()
	})

	it('non-POST is rejected', async () => {
		const res = response()
		await send(request({ method: 'GET' }), res as unknown as VercelResponse)
		expect(res.statusCode).toBe(405)
	})
})

describe('tracking links never redirect', () => {
	it.each([
		'https://evil.example.invalid/phish',
		'http://evil.example.invalid',
		'//evil.example.invalid',
		'javascript:alert(1)',
		'',
	])('click with url=%s returns a fixed response and no redirect', async url => {
		const res = response()
		await track(request({ method: 'GET', query: { type: 'click', token: 'synthetic-token', url } }), res as unknown as VercelResponse)
		expect(res.statusCode).toBe(410)
		expect(res.redirectedTo).toBeUndefined()
		expect(res.headers.location).toBeUndefined()
		expect(String(res.body)).not.toContain('evil')
	})

	it('open pixel still returns the 1x1 GIF', async () => {
		const res = response()
		await track(request({ method: 'GET', query: { type: 'open', token: 'synthetic-token' } }), res as unknown as VercelResponse)
		expect(res.statusCode).toBe(200)
		expect(res.headers['content-type']).toBe('image/gif')
	})
})
