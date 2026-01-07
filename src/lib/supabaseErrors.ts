export const MISSING_PROFILES_TABLE_MESSAGE = 'Profiles table is not set up in Supabase yet.'

export function isMissingProfilesTableError(err: any): boolean {
	const message: string = String(err?.message ?? err?.toString?.() ?? '')
	// PostgREST error typically: "Could not find the table 'public.profiles' in the schema cache"
	return /schema cache/i.test(message) && /profiles/i.test(message)
}

export function friendlyMessageForProfilesError(err: any): string | null {
	return isMissingProfilesTableError(err) ? MISSING_PROFILES_TABLE_MESSAGE : null
}

export type SupabaseLikeError = {
	status?: number
	message?: string
	code?: string
	name?: string
}

type FriendlyAuthOptions = {
	context?: 'signup' | 'login'
}

export function friendlyAuthErrorMessage(err: SupabaseLikeError | string | null | undefined, opts?: FriendlyAuthOptions): string {
	const context: 'signup' | 'login' = opts?.context ?? 'login'
	const defaultSignup = "We couldn't create your account. Please try again shortly."
	const defaultLogin = 'We could not sign you in. Please try again.'
	const defaultMessage = context === 'signup' ? defaultSignup : defaultLogin

	const rawMessage = typeof err === 'string' ? err : err?.message || ''
	const status = typeof err === 'object' ? err?.status : undefined
	const messageLc = (rawMessage || '').toLowerCase()

	if (status === 429 || messageLc.includes('rate limit')) {
		return 'Too many attempts. Please wait a few minutes and try again.'
	}
	if (messageLc.includes('database error saving new user') || messageLc.includes('new row violates row-level security')) {
		// Intermittent Supabase/DB errors during signup creation
		return context === 'signup' ? defaultSignup : defaultLogin
	}
	if (messageLc.includes('invalid login credentials') || messageLc.includes('invalid email or password')) {
		return 'Invalid email or password. Please try again.'
	}
	if (messageLc.includes('failed to fetch') || messageLc.includes('networkerror') || messageLc.includes('network')) {
		return 'Network error. Check your connection and try again.'
	}
	// Unknown/unclassified: log for diagnostics
	if (err) {
		// eslint-disable-next-line no-console
		console.warn('Auth error (unclassified):', err)
	}
	return rawMessage || defaultMessage
}


