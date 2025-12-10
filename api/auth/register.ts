import type { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../_lib/prisma.js'
import { setSessionCookie, signSession } from '../_lib/auth.js'

function isValidEmail(email: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
function isValidPhone(phone: string) {
	// allow digits, spaces, +, -, (), length 7-20 chars
	return /^[\d\s+\-()]{7,20}$/.test(phone)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	const { email, fullName, phone, marketingConsent } = (req.body || {}) as {
		email?: string
		fullName?: string
		phone?: string
		marketingConsent?: boolean
	}
	const normalizedEmail = (email || '').trim().toLowerCase()
	const normalizedName = (fullName || '').trim()

	if (!normalizedEmail || !normalizedName) {
		return res.status(400).json({ error: 'Missing email or fullName' })
	}
	if (!isValidEmail(normalizedEmail)) {
		return res.status(400).json({ error: 'Invalid email format' })
	}
	if (phone && !isValidPhone(String(phone))) {
		return res.status(400).json({ error: 'Invalid phone format' })
	}

	try {
		let user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
		if (!user) {
			user = await prisma.user.create({
				data: {
					email: normalizedEmail,
					fullName: normalizedName,
					phone: phone || null,
					marketingConsent: !!marketingConsent
				}
			})
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
				role: user.role,
				marketingConsent: user.marketingConsent
			}
		})
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Register error:', err)
		return res.status(500).json({ error: 'Registration failed' })
	}
}


