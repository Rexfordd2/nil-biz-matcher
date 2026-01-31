export const MISSING_PROFILES_TABLE_MESSAGE = 'Profiles table is not set up in Supabase yet.'

export function isMissingProfilesTableError(err: any): boolean {
	const message: string = String(err?.message ?? err?.toString?.() ?? '')
	return /schema cache/i.test(message) && /profiles/i.test(message)
}

export function friendlyMessageForProfilesError(err: any): string | null {
	return isMissingProfilesTableError(err) ? MISSING_PROFILES_TABLE_MESSAGE : null
}

