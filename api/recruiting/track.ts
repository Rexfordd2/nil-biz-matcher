import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma.js'

// 1x1 transparent GIF
const PIXEL_GIF = Buffer.from(
	'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
	'base64'
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const type = String(req.query.type || '')
	const token = String(req.query.token || '')
	const url = req.query.url ? String(req.query.url) : ''

	// If Prisma is configured, persist counts
	try {
		if (prisma && token) {
			const outreach = await prisma.outreach.findUnique({ where: { trackToken: token } })
			if (outreach) {
				if (type === 'open') {
					await prisma.outreach.update({
						where: { id: outreach.id },
						data: { openCount: { increment: 1 }, status: 'opened' }
					})
				} else if (type === 'click') {
					await prisma.outreach.update({
						where: { id: outreach.id },
						data: { clickCount: { increment: 1 }, status: 'clicked' }
					})
				}
			}
		}
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Track persist error:', err)
		// continue to pixel/redirect even if persistence fails
	}

	if (type === 'open') {
		res.setHeader('Content-Type', 'image/gif')
		res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
		return res.status(200).send(PIXEL_GIF)
	}

	if (type === 'click') {
		// Very basic allowlist: only allow http(s) destinations
		if (!/^https?:\/\//i.test(url)) {
			return res.status(400).send('Invalid redirect')
		}
		// Optionally log token+url
		res.setHeader('Cache-Control', 'no-store')
		return res.redirect(url)
	}

	return res.status(400).json({ error: 'Invalid tracking type' })
}


