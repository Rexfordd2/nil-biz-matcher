import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseServer } from '../_lib/supabaseServer'
import { friendlyMessageForProfilesError } from '../_lib/supabaseErrors'
import { isPublicModeServer } from '../_lib/publicMode'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	try {
		// Public mode: bypass auth entirely
		if (isPublicModeServer()) {
			res.setHeader('Cache-Control', 'no-store')
			return res.status(200).json({
				user: null,
				profile: null
			})
		}
		
		// Check if Supabase is configured before attempting to use it
		const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
		const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
		
		if (!supabaseUrl || !supabaseAnonKey) {
			// Supabase not configured, return stub response
			res.setHeader('Cache-Control', 'no-store')
			return res.status(503).json({ 
				error: 'Auth service not configured',
				user: null,
				profile: null
			})
		}
		
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

		if (profileErr) {
			const friendly = friendlyMessageForProfilesError(profileErr)
			if (friendly) {
				res.setHeader('Cache-Control', 'no-store')
				return res.status(200).json({
					user: {
						id: user.id,
						email: user.email,
					},
					profile: {
						display_name: (user.user_metadata as any)?.full_name ?? user.email ?? null,
						role: (user.user_metadata as any)?.role ?? null
					},
					warning: friendly
				})
			}
			if (profileErr.code !== 'PGRST116') {
				// If not found, allow null; otherwise, return error
				return res.status(500).json({ error: profileErr.message })
			}
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


