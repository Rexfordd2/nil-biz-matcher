import type { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'node:fs'
import path from 'node:path'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	try {
		const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
		const entry = {
			...body,
			timestamp: Date.now(),
		}
		const logPath = 'c:\\Users\\13109\\Desktop\\Monster Collective\\.cursor\\debug.log'
		try {
			fs.mkdirSync(path.dirname(logPath), { recursive: true })
		} catch {}
		fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', { encoding: 'utf8' })
		return res.status(204).end()
	} catch {
		return res.status(400).json({ error: 'Invalid payload' })
	}
}

