import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

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
	// #region agent log
	const __dbgA = {
		sessionId: 'debug-session',
		runId: 'initial',
		hypothesisId: 'A',
		location: 'src/lib/supabaseClient.ts:post-createClient',
		message: 'Supabase client initialized',
		data: {
			urlPresent: Boolean(supabaseUrl),
			keyPresent: Boolean(supabaseAnonKey)
		},
		timestamp: Date.now()
	}
	fetch('http://127.0.0.1:7242/ingest/f93d76cb-ddaa-401d-972f-239de3ada967', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(__dbgA)
	}).catch(() => {})
	fetch('/api/debug/log', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(__dbgA)
	}).catch(() => {})
	// #endregion
} else {
	warnOnce('[Athlete Ledger] Supabase not configured, using local fallback')
}

export const supabase: SupabaseClient | null = client

