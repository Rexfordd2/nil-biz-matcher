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

export type AppModeInput = {
	/** Raw VITE_APP_MODE value. */
	appModeFlag?: string
	/** Whether public mode is active. */
	publicMode?: boolean
}

/** Pure resolver for tests and build/runtime readers. */
export function resolveAppMode(input: AppModeInput = {}): AppMode {
	const flag = String(input.appModeFlag || '').toLowerCase()
	if (flag === 'demo') return 'demo'
	if (flag === 'beta') return 'beta'
	if (input.publicMode) return 'demo'
	return 'beta'
}

export function getAppMode(): AppMode {
	// Check both client-side (import.meta.env) and build-time (process.env)
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		return resolveAppMode({
			appModeFlag: String(import.meta.env.VITE_APP_MODE || ''),
			publicMode: String(import.meta.env.VITE_PUBLIC_MODE || '').toLowerCase() === 'true',
		})
	}
	
	// Fallback for build-time/server contexts
	if (typeof process !== 'undefined' && process.env) {
		return resolveAppMode({
			appModeFlag: String(process.env.VITE_APP_MODE || ''),
			publicMode: String(process.env.VITE_PUBLIC_MODE || '').toLowerCase() === 'true',
		})
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
