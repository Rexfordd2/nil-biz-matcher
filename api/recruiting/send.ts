import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Coach outreach email is disabled until authenticated sending and recipient
 * authorization are independently verified. This handler never authenticates,
 * reads configuration, or sends mail, and has no environment switch.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	res.setHeader('Cache-Control', 'no-store')
	return res.status(503).json({
		error: 'Outreach email is disabled. Copy your message and send it from your own email.',
		code: 'OUTREACH_DISABLED'
	})
}
