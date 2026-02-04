import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseServer } from './supabaseServer'
import { PUBLIC_MODE_SERVER } from './publicMode'

type AuthResult =
	| { bypassed: true; user: null }
	| { bypassed: false; user: { id: string; email?: string } }
	| { bypassed: false; user: null }

/**
 * Get authenticated Supabase user from request
 * 
 * Returns:
 * - { bypassed: true, user: null } if PUBLIC_MODE_SERVER is enabled (no auth required)
 * - { bypassed: false, user: { id, email } } if authenticated
 * - { bypassed: false, user: null } if not authenticated
 * 
 * Usage:
 * ```
 * const { bypassed, user } = await getAuthenticatedSupabaseUser(req, res)
 * if (bypassed) {
 *   // Public mode - allow access without auth
 *   return handleRequest({ userId: null })
 * }
 * if (!user) {
 *   return res.status(401).json({ error: 'Unauthorized' })
 * }
 * // Proceed with authenticated user
 * ```
 */
export async function getAuthenticatedSupabaseUser(
	req: VercelRequest,
	res: VercelResponse
): Promise<AuthResult> {
	// In public mode, bypass auth checks
	if (PUBLIC_MODE_SERVER) {
		return { bypassed: true, user: null }
	}

	try {
		const sb = supabaseServer(req, res)
		const { data, error } = await sb.auth.getUser()

		if (error || !data.user) {
			return { bypassed: false, user: null }
		}

		return {
			bypassed: false,
			user: {
				id: data.user.id,
				email: data.user.email
			}
		}
	} catch (err) {
		// Auth check failed - treat as unauthenticated
		return { bypassed: false, user: null }
	}
}
