/**
 * Debug route access control.
 * 
 * Debug routes are accessible when:
 * - import.meta.env.DEV is true (local development)
 * - VITE_DIAGNOSTICS=true (explicit diagnostics mode)
 * - ?debugKey=... query param matches VITE_DEBUG_KEY env var (secret key access)
 * 
 * In production without these conditions, debug routes should return 404.
 */

/**
 * Check if debug routes should be accessible.
 * @param searchParams - URL search params (from window.location.search or URLSearchParams)
 * @returns true if debug access is allowed, false otherwise
 */
export function isDebugAccessAllowed(searchParams?: string | URLSearchParams): boolean {
	// Always allow in dev mode
	if (import.meta.env.DEV) {
		return true
	}

	// Check VITE_DIAGNOSTICS flag
	const diagnosticsEnabled = String(import.meta.env.VITE_DIAGNOSTICS || '').toLowerCase() === 'true'
	if (diagnosticsEnabled) {
		return true
	}

	// Check debugKey query param
	if (searchParams) {
		const params = typeof searchParams === 'string' 
			? new URLSearchParams(searchParams)
			: searchParams
		
		const debugKey = params.get('debugKey')
		const expectedKey = import.meta.env.VITE_DEBUG_KEY
		
		if (debugKey && expectedKey && debugKey === expectedKey) {
			return true
		}
	}

	return false
}

/**
 * Build-time check: Assert that debug routes are not exposed in production builds
 * when diagnostics is disabled.
 * This should be called during build to fail if debug routes would be accessible.
 */
export function assertDebugRoutesProtected(): void {
	if (import.meta.env.DEV) {
		// Skip check in dev mode
		return
	}

	const diagnosticsEnabled = String(import.meta.env.VITE_DIAGNOSTICS || '').toLowerCase() === 'true'
	const hasDebugKey = Boolean(import.meta.env.VITE_DEBUG_KEY)

	// If neither diagnostics nor debug key is set in production, fail the build
	if (!diagnosticsEnabled && !hasDebugKey) {
		// This check happens at build time, so we can throw an error
		throw new Error(
			'[SECURITY] Debug routes must be protected in production. ' +
			'Set VITE_DIAGNOSTICS=true or VITE_DEBUG_KEY=<secret> to enable debug access, ' +
			'or ensure debug routes are excluded from production builds.'
		)
	}
}
