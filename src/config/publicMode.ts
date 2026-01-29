/**
 * Public mode feature flag
 * 
 * When enabled (VITE_PUBLIC_MODE=true), the app runs in a public/no-login release mode:
 * - Build doesn't fail if debug routes lack explicit VITE_DEBUG_KEY (they're deny-by-default)
 * - Auth/login flows are optional (graceful degradation when Supabase not configured)
 * - Anonymous access to /app is explicitly supported
 */

export function isPublicMode(): boolean {
	// Check both client-side (import.meta.env) and build-time (process.env)
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		const clientFlag = String(import.meta.env.VITE_PUBLIC_MODE || '').toLowerCase()
		return clientFlag === 'true'
	}
	
	// Fallback for build-time/server contexts
	if (typeof process !== 'undefined' && process.env) {
		const serverFlag = String(process.env.VITE_PUBLIC_MODE || '').toLowerCase()
		return serverFlag === 'true'
	}
	
	return false
}

export const PUBLIC_MODE = isPublicMode()
