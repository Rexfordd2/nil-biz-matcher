import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getCurrentUser } from '../_lib/auth.js'
import fs from 'node:fs'
import path from 'node:path'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	const user = await getCurrentUser(req)
	// #region agent log
	fetch('http://127.0.0.1:7242/ingest/f93d76cb-ddaa-401d-972f-239de3ada967', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'E',
			location: 'api/auth/me.ts:afterGetCurrentUser',
			message: 'Auth/me check',
			data: { authorized: Boolean(user) },
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
			hypothesisId: 'E',
			location: 'api/auth/me.ts:afterGetCurrentUser',
			message: 'Auth/me check (fs)',
			data: { authorized: Boolean(user) },
			timestamp: Date.now()
		}) + '\n', { encoding: 'utf8' })
	} catch {}
	// #endregion
	if (!user) return res.status(401).json({ error: 'Unauthorized' })
	res.setHeader('Cache-Control', 'no-store')
	return res.status(200).json({
		user: {
			id: user.id,
			email: user.email,
			fullName: user.fullName,
			phone: user.phone,
			role: user.role,
			marketingConsent: user.marketingConsent
		}
	})
}


