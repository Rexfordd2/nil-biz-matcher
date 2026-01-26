import type { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../_lib/prisma'
import { setSessionCookie, signSession } from '../_lib/auth'
import fs from 'node:fs'
import path from 'node:path'

function isValidEmail(email: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	const { email } = (req.body || {}) as { email?: string; password?: string }
	const normalizedEmail = (email || '').trim().toLowerCase()
	if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/f93d76cb-ddaa-401d-972f-239de3ada967', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId: 'debug-session',
				runId: 'initial',
				hypothesisId: 'D',
				location: 'api/auth/login.ts:validation',
				message: 'Login validation failed',
				data: { emailPresent: Boolean(email) },
				timestamp: Date.now()
			})
		}).catch(() => {})
		// #endregion
		// #region agent log (fs fallback)
		try {
			const logPath = 'c:\\Users\\13109\\Desktop\\Monster Collective\\.cursor\\debug.log'
			try {
				fs.mkdirSync(path.dirname(logPath), { recursive: true })
			} catch {}
			fs.appendFileSync(logPath, JSON.stringify({
				sessionId: 'debug-session',
				runId: 'initial',
				hypothesisId: 'D',
				location: 'api/auth/login.ts:validation',
				message: 'Login validation failed (fs)',
				data: { emailPresent: Boolean(email) },
				timestamp: Date.now()
			}) + '\n', { encoding: 'utf8' })
		} catch {}
		// #endregion
		return res.status(400).json({ error: 'Invalid email' })
	}
	try {
		if (!prisma) {
			return res.status(503).json({ error: 'Database not available' })
		}
		const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
		if (!user) {
			return res.status(404).json({ error: 'User not found' })
		}
		const token = signSession(user.id)
		setSessionCookie(res, token)
		res.setHeader('Cache-Control', 'no-store')
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/f93d76cb-ddaa-401d-972f-239de3ada967', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId: 'debug-session',
				runId: 'initial',
				hypothesisId: 'D',
				location: 'api/auth/login.ts:success',
				message: 'Login success; session cookie set',
				data: { userIdPresent: Boolean(user.id) },
				timestamp: Date.now()
			})
		}).catch(() => {})
		// #endregion
		// #region agent log (fs fallback)
		try {
			const logPath = 'c:\\Users\\13109\\Desktop\\Monster Collective\\.cursor\\debug.log'
			try {
				fs.mkdirSync(path.dirname(logPath), { recursive: true })
			} catch {}
			fs.appendFileSync(logPath, JSON.stringify({
				sessionId: 'debug-session',
				runId: 'initial',
				hypothesisId: 'D',
				location: 'api/auth/login.ts:success',
				message: 'Login success; session cookie set (fs)',
				data: { userIdPresent: Boolean(user.id) },
				timestamp: Date.now()
			}) + '\n', { encoding: 'utf8' })
		} catch {}
		// #endregion
		return res.status(200).json({
			user: {
				id: user.id,
				email: user.email,
				fullName: user.fullName,
				phone: user.phone,
				role: user.role
			}
		})
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Login error:', err)
		return res.status(500).json({ error: 'Login failed' })
	}
}


