import type { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'node:fs'
import path from 'node:path'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
	try {
		const logPath = 'c:\\Users\\13109\\Desktop\\Monster Collective\\.cursor\\debug.log'
		try {
			fs.mkdirSync(path.dirname(logPath), { recursive: true })
		} catch {}
		fs.appendFileSync(logPath, JSON.stringify({
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'Z',
			location: 'api/debug/ping.ts',
			message: 'Ping',
			data: {},
			timestamp: Date.now()
		}) + '\n', { encoding: 'utf8' })
	} catch {}
	return res.status(200).json({ ok: true })
}

