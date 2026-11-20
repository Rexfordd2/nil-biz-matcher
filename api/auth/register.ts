import type { VercelRequest, VercelResponse } from '@vercel/node'
import { respondLegacyAuthDisabled } from '../_lib/legacyAuthDisabled.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	return respondLegacyAuthDisabled(res)
}
