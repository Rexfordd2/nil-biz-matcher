import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearSessionCookie } from '../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST' && req.method !== 'GET') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	clearSessionCookie(res)
	res.setHeader('Cache-Control', 'no-store')
	return res.status(200).json({ ok: true })
}


