import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Runtime env sanity check (boolean only) - do not print values
export const supabaseEnvConfigured: boolean = Boolean(
	typeof supabaseUrl === 'string' &&
	supabaseUrl &&
	typeof supabaseAnonKey === 'string' &&
	supabaseAnonKey
)

let warned = false
function warnOnce(message: string) {
	if (!warned) {
		// eslint-disable-next-line no-console
		console.warn(message)
		warned = true
	}
}

function isValidHttpUrl(value: string | undefined): value is string {
	if (!value) return false
	try {
		const u = new URL(value)
		return u.protocol === 'http:' || u.protocol === 'https:'
	} catch {
		return false
	}
}

let client: SupabaseClient | null = null
if (isValidHttpUrl(supabaseUrl) && typeof supabaseAnonKey === 'string' && supabaseAnonKey.length > 0) {
	client = createClient(supabaseUrl, supabaseAnonKey)
} else {
	warnOnce('[Athlete Ledger] Supabase not configured')
}

export const supabase: SupabaseClient | null = client

