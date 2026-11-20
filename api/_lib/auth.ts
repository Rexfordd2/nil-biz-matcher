import type { VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const COOKIE_NAME = 'al_session'
const TOKEN_VERSION = 'v1'
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
const MIN_SECRET_LENGTH = 32

/** Legacy session signing has no fallback secret: without a strong one it is unavailable. */
function getSecret(): string | null {
	const secret = (process.env.AUTH_SECRET || process.env.JWT_SECRET || '').trim()
	return secret.length >= MIN_SECRET_LENGTH ? secret : null
}

function base64url(input: Buffer | string): string {
	const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
	return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function signSession(userId: string, ttlMs: number = DEFAULT_TTL_MS): string {
	const secret = getSecret()
	if (!secret) {
		throw new Error('Legacy session signing is unavailable: no secure secret configured')
	}
	const exp = Date.now() + ttlMs
	const payload = `${TOKEN_VERSION}.${userId}.${exp}`
	const signature = crypto.createHmac('sha256', secret).update(payload).digest()
	return `${payload}.${base64url(signature)}`
}

export function verifySession(token: string): { userId: string } | null {
	const secret = getSecret()
	if (!secret) return null
	try {
		const [version, userId, expStr, sig] = token.split('.')
		if (!version || !userId || !expStr || !sig) return null
		if (version !== TOKEN_VERSION) return null
		const exp = Number(expStr)
		if (!Number.isFinite(exp) || Date.now() > exp) return null
		const payload = `${version}.${userId}.${expStr}`
		const expected = base64url(crypto.createHmac('sha256', secret).update(payload).digest())
		if (sig.length !== expected.length) return null
		if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
		return { userId }
	} catch {
		return null
	}
}

export function clearSessionCookie(res: VercelResponse) {
	const isProd = process.env.NODE_ENV === 'production'
	const cookie = [
		`${COOKIE_NAME}=`,
		`Path=/`,
		`HttpOnly`,
		`SameSite=Lax`,
		`Max-Age=0`,
		isProd ? 'Secure' : ''
	].filter(Boolean).join('; ')
	res.setHeader('Set-Cookie', cookie)
}
