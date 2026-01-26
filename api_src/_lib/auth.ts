import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import prisma from './prisma'

const COOKIE_NAME = 'al_session'
const TOKEN_VERSION = 'v1'
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

function getSecret(): string {
	const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET
	return secret && secret.trim().length > 0 ? secret : 'dev-secret-change-me'
}

function base64url(input: Buffer | string): string {
	const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
	return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function signSession(userId: string, ttlMs: number = DEFAULT_TTL_MS): string {
	const exp = Date.now() + ttlMs
	const payload = `${TOKEN_VERSION}.${userId}.${exp}`
	const signature = crypto.createHmac('sha256', getSecret()).update(payload).digest()
	return `${payload}.${base64url(signature)}`
}

export function verifySession(token: string): { userId: string } | null {
	try {
		const [version, userId, expStr, sig] = token.split('.')
		if (!version || !userId || !expStr || !sig) return null
		if (version !== TOKEN_VERSION) return null
		const exp = Number(expStr)
		if (!Number.isFinite(exp) || Date.now() > exp) return null
		const payload = `${version}.${userId}.${expStr}`
		const expected = base64url(crypto.createHmac('sha256', getSecret()).update(payload).digest())
		if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
		return { userId }
	} catch {
		return null
	}
}

export function setSessionCookie(res: VercelResponse, token: string) {
	const isProd = process.env.NODE_ENV === 'production'
	const maxAge = 60 * 60 * 24 * 30 // 30d
	const cookie = [
		`${COOKIE_NAME}=${token}`,
		`Path=/`,
		`HttpOnly`,
		`SameSite=Lax`,
		`Max-Age=${maxAge}`,
		isProd ? 'Secure' : ''
	].filter(Boolean).join('; ')
	res.setHeader('Set-Cookie', cookie)
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

function getTokenFromRequest(req: VercelRequest): string | null {
	const cookieHeader = req.headers.cookie || ''
	const match = cookieHeader
		.split(';')
		.map((s: string) => s.trim())
		.find((kv: string) => kv.startsWith(`${COOKIE_NAME}=`))
	if (match) {
		return match.split('=')[1] || null
	}
	const auth = req.headers.authorization || ''
	const parts = auth.split(' ')
	if (parts[0] === 'Bearer' && parts[1]) return parts[1]
	return null
}

export async function getCurrentUser(req: VercelRequest) {
	const token = getTokenFromRequest(req)
	if (!token) return null
	const parsed = verifySession(token)
	if (!parsed) return null
	try {
		if (!prisma) return null
		const user = await prisma.user.findUnique({ where: { id: parsed.userId } })
		return user
	} catch {
		return null
	}
}

export function requireUser(user: any, res: VercelResponse) {
	if (!user) {
		res.setHeader('Cache-Control', 'no-store')
		res.status(401).json({ error: 'Unauthorized' })
		return false
	}
	return true
}


