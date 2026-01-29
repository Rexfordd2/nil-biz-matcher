import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserOrBypass } from '../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	const { bypassed, user } = await getUserOrBypass(req)
	
	// Public mode: return null user (no 401)
	if (bypassed) {
		res.setHeader('Cache-Control', 'no-store')
		return res.status(200).json({ user: null })
	}
	
	// Normal mode: require auth
	if (!user) {
		return res.status(401).json({ error: 'Unauthorized' })
	}
	
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


