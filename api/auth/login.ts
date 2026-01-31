import type { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../_lib/prisma'
import { setSessionCookie, signSession } from '../_lib/auth'

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

