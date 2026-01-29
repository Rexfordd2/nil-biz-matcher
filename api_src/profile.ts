import type { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from './_lib/prisma.js'
import { requireUserOrBypass } from './_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const result = await requireUserOrBypass(req, res)
	if (!result) return // 401 already sent
	const { bypassed, user } = result
	
	// Public mode: return empty profile (no DB access)
	if (bypassed) {
		res.setHeader('Cache-Control', 'no-store')
		if (req.method === 'GET') {
			return res.status(200).json({ profile: {} })
		}
		if (req.method === 'POST') {
			return res.status(503).json({ error: 'Profile storage not available in public mode' })
		}
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	if (req.method === 'GET') {
		// If DB is not available, respond with an empty profile rather than erroring
		if (!prisma) {
			res.setHeader('Cache-Control', 'no-store')
			return res.status(200).json({ profile: {} })
		}
		try {
			let row = await prisma.athleteProfile.findUnique({ where: { userId: user!.id } })
			if (!row) {
				row = await prisma.athleteProfile.create({
					data: {
						userId: user!.id,
						data: '{}',
						isPublic: false
					}
				})
			}
			res.setHeader('Cache-Control', 'no-store')
			const parsed = safeParseJson(row.data)
			return res.status(200).json({ profile: parsed })
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Profile load error:', err)
			return res.status(500).json({ error: 'Failed to load profile' })
		}
	}

	if (req.method === 'POST') {
		// If DB is not available, saving is not supported in this deployment
		if (!prisma) {
			return res.status(503).json({ error: 'Profile storage not available' })
		}
		const { profile } = (req.body || {}) as { profile?: unknown }
		if (typeof profile !== 'object' || profile === null) {
			return res.status(400).json({ error: 'Invalid profile payload' })
		}
		try {
			const existing = await prisma.athleteProfile.findUnique({ where: { userId: user!.id } })
			if (!existing) {
				await prisma.athleteProfile.create({
					data: { userId: user!.id, data: JSON.stringify(profile), isPublic: false }
				})
			} else {
				await prisma.athleteProfile.update({
					where: { userId: user!.id },
					data: { data: JSON.stringify(profile) }
				})
			}
			res.setHeader('Cache-Control', 'no-store')
			return res.status(200).json({ success: true })
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Profile save error:', err)
			return res.status(500).json({ error: 'Failed to save profile' })
		}
	}

	return res.status(405).json({ error: 'Method Not Allowed' })
}

function safeParseJson(input: string | null | undefined): any {
	if (!input) return {}
	try {
		return JSON.parse(input)
	} catch {
		return {}
	}
}


