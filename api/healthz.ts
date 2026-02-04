import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function deriveBuildId(): string {
	const raw =
		process.env.VERCEL_GIT_COMMIT_SHA ||
		process.env.VITE_BUILD_ID ||
		process.env.GIT_COMMIT_SHA ||
		process.env.COMMIT_REF ||
		''
	// If it looks like a git SHA, shorten to 7 chars; else return as-is or 'unknown'
	if (/^[a-f0-9]{7,40}$/i.test(raw)) return raw.slice(0, 7)
	return raw || 'unknown'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method Not Allowed' })
	}
	const buildId = deriveBuildId()
	const appInstance = process.env.VITE_APP_INSTANCE || process.env.APP_INSTANCE || 'unknown'
	
	// Environment variable presence checks (booleans only, no secrets)
	// Note: VITE_* variables are typically client-side only, but may be set as regular env vars
	// Check for both VITE_* and non-VITE_* versions where applicable
	const configPresence = {
		// Client-side config (VITE_* variables)
		// These may be available server-side if set as regular environment variables
		hasViteSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
		hasViteSupabaseAnonKey: Boolean(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
		hasViteGoogleMapsApiKey: Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
		hasCseKey: Boolean(process.env.VITE_GOOGLE_CSE_API_KEY || process.env.GOOGLE_CSE_API_KEY),
		hasCseCx: Boolean(process.env.VITE_GOOGLE_CSE_CX || process.env.GOOGLE_CSE_CX),
		// Server-side config
		hasGoogleMapsServerKey: Boolean(process.env.GOOGLE_MAPS_API_KEY),
		hasVercelGitCommitSha: Boolean(process.env.VERCEL_GIT_COMMIT_SHA),
	}
	
	// Supabase connection test using anon key (safe & fast)
	let supabaseHealth: any = { configured: false }
	if (configPresence.hasViteSupabaseUrl && configPresence.hasViteSupabaseAnonKey) {
		try {
			// Use anon key for a harmless auth check
			const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
			const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
			
			const sb = createClient(supabaseUrl, supabaseAnonKey)
			
			// Attempt a harmless request - auth.getSession() is safe and fast
			const { error } = await sb.auth.getSession()
			
			supabaseHealth = {
				configured: true,
				connected: !error,
				error: error ? (error.message.slice(0, 100) || 'Unknown error') : null
			}
		} catch (err: any) {
			const errorMsg = err?.message || 'Connection failed'
			supabaseHealth = {
				configured: true,
				connected: false,
				error: errorMsg.slice(0, 100) // Trim error messages
			}
		}
	}
	
	const payload = {
		buildId,
		appInstance,
		timestamp: new Date().toISOString(),
		configPresence,
		supabase: supabaseHealth
	}
	
	// Cache-busting headers
	res.setHeader('Cache-Control', 'no-store')
	res.setHeader('Pragma', 'no-cache')
	res.setHeader('Expires', '0')
	res.setHeader('CDN-Cache-Control', 'no-store')
	
	return res.status(200).json(payload)
}

