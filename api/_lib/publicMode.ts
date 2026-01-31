/**
 * Public mode feature flag (server-side)
 * 
 * When enabled, the app runs in public/no-login release mode:
 * - Auth enforcement is bypassed (no 401s for missing sessions)
 * - Auth providers (Supabase) remain intact but are optional
 * - User-specific features degrade gracefully
 */

export function isPublicModeServer(): boolean {
	// Check canonical flag first (VITE_PUBLIC_MODE)
	const vitePubMode = String(process.env.VITE_PUBLIC_MODE || '').toLowerCase()
	if (vitePubMode === 'true') return true
	
	// Check Next.js-style alias (NEXT_PUBLIC_PUBLIC_MODE)
	const nextPubMode = String(process.env.NEXT_PUBLIC_PUBLIC_MODE || '').toLowerCase()
	if (nextPubMode === 'true') return true
	
	// Optional fallback for generic PUBLIC_MODE
	const genericMode = String(process.env.PUBLIC_MODE || '').toLowerCase()
	if (genericMode === 'true') return true
	
	return false
}

export const PUBLIC_MODE_SERVER = isPublicModeServer()
