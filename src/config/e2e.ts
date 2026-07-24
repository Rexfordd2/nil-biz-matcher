/**
 * Test-only auth bypass for Playwright navigation specs.
 * Must never be enabled in production builds.
 */
export function isE2EAuthBypass(): boolean {
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		return String(import.meta.env.VITE_E2E_BYPASS_AUTH || '').toLowerCase() === 'true'
	}
	if (typeof process !== 'undefined' && process.env) {
		return String(process.env.VITE_E2E_BYPASS_AUTH || '').toLowerCase() === 'true'
	}
	return false
}
