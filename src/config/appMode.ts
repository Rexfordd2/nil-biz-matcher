/**
 * App Mode feature flag (demo | beta)
 * 
 * Controls which production surface is being built/deployed:
 * - DEMO: Public, lightweight, waitlist-only surface
 * - BETA: Full app with auth gating
 * 
 * Source of truth: APP_MODE env var (propagated as VITE_APP_MODE during build)
 * 
 * Default behavior (when VITE_APP_MODE is not set):
 * - If PUBLIC_MODE is true → demo
 * - Otherwise → beta
 */

export type AppMode = 'demo' | 'beta'

export function getAppMode(): AppMode {
	// Check both client-side (import.meta.env) and build-time (process.env)
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		const clientFlag = String(import.meta.env.VITE_APP_MODE || '').toLowerCase()
		if (clientFlag === 'demo') return 'demo'
		if (clientFlag === 'beta') return 'beta'
		
		// Fallback: if PUBLIC_MODE is true, default to demo
		const publicMode = String(import.meta.env.VITE_PUBLIC_MODE || '').toLowerCase() === 'true'
		if (publicMode) return 'demo'
	}
	
	// Fallback for build-time/server contexts
	if (typeof process !== 'undefined' && process.env) {
		const serverFlag = String(process.env.VITE_APP_MODE || '').toLowerCase()
		if (serverFlag === 'demo') return 'demo'
		if (serverFlag === 'beta') return 'beta'
		
		// Fallback: if PUBLIC_MODE is true, default to demo
		const publicMode = String(process.env.VITE_PUBLIC_MODE || '').toLowerCase() === 'true'
		if (publicMode) return 'demo'
	}
	
	// Final fallback: beta (full app)
	return 'beta'
}

export const APP_MODE = getAppMode()

export function isDemoMode(): boolean {
	return APP_MODE === 'demo'
}

export function isBetaMode(): boolean {
	return APP_MODE === 'beta'
}
