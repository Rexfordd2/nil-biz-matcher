/**
 * Local-only E2E auth bypass for Playwright navigation specs.
 *
 * Never enable via query params or UI. Production / remote hosts must always
 * return false even if VITE_E2E_BYPASS_AUTH was baked into a preview build.
 */

const LOCAL_E2E_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

export type LocalE2EAuthBypassInput = {
	/** Raw VITE_E2E_BYPASS_AUTH value (defaults to import.meta.env). */
	envFlag?: string
	/** Browser hostname (defaults to window.location.hostname when available). */
	hostname?: string
	/** Whether a browser window exists (defaults to typeof window !== 'undefined'). */
	hasWindow?: boolean
}

function readEnvBypassFlag(): string {
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		return String(import.meta.env.VITE_E2E_BYPASS_AUTH || '')
	}
	return ''
}

/**
 * Returns true only when the env flag is set AND the page is served on a
 * loopback hostname. False for SSR, remote hosts, LAN IPs, and deployed domains.
 */
export function isLocalE2EAuthBypassAllowed(input: LocalE2EAuthBypassInput = {}): boolean {
	const flag = (input.envFlag ?? readEnvBypassFlag()).toLowerCase()
	if (flag !== 'true') return false

	const hasWindow = input.hasWindow ?? typeof window !== 'undefined'
	if (!hasWindow) return false

	const hostname =
		input.hostname !== undefined
			? String(input.hostname).toLowerCase()
			: typeof window !== 'undefined'
				? String(window.location.hostname || '').toLowerCase()
				: ''

	return LOCAL_E2E_HOSTNAMES.has(hostname)
}
