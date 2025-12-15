import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseServer } from '../_lib/supabaseServer.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	try {
		const supabase = supabaseServer(req, res)
		const { data: userData, error: userErr } = await supabase.auth.getUser()
		if (userErr || !userData?.user) {
			return res.status(401).json({ error: 'Unauthorized' })
		}
		const user = userData.user

		const { data: profile, error: profileErr } = await supabase
			.from('profiles')
			.select('display_name, role')
			.eq('id', user.id)
			.single()

		if (profileErr && profileErr.code !== 'PGRST116') {
			// If not found, allow null; otherwise, return error
			return res.status(500).json({ error: profileErr.message })
		}

		res.setHeader('Cache-Control', 'no-store')
		return res.status(200).json({
			user: {
				id: user.id,
				email: user.email,
			},
			profile: profile || null
		})
	} catch (err: any) {
		// eslint-disable-next-line no-console
		console.error('App home error:', err)
		return res.status(500).json({ error: 'Internal Server Error' })
	}
}


