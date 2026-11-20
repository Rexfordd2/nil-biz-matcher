import type { VercelResponse } from '@vercel/node'

/**
 * The email-only legacy account endpoints are permanently disabled. Accounts,
 * sessions and sign-out are handled by Supabase Auth in the browser. There is
 * deliberately no environment switch to re-enable these handlers.
 */
export function respondLegacyAuthDisabled(res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')
	return res.status(410).json({
		error: 'Legacy authentication is disabled. Sign in with your NIL Roster account.',
		code: 'LEGACY_AUTH_DISABLED'
	})
}
