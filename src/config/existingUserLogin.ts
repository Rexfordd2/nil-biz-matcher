/**
 * Existing-user login control — independent from public signup.
 *
 * Production public auth uses VITE_PUBLIC_MODE=false, so login/reset/signup
 * are available without this flag.
 *
 * When VITE_PUBLIC_MODE=true (demo surface), login and signup are both
 * disabled by default. Setting VITE_EXISTING_USER_LOGIN_ENABLED=true permits
 * password login and password recovery while signup remains disabled.
 *
 * Default / absent / any value other than exact "true" → false.
 * Not enabled by query parameters, client storage, or UI.
 */

export type ExistingUserLoginInput = {
	/** Raw VITE_EXISTING_USER_LOGIN_ENABLED value. */
	envFlag?: string
}

function readEnvFlag(): string {
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		const raw = import.meta.env.VITE_EXISTING_USER_LOGIN_ENABLED
		if (raw === undefined || raw === null) return ''
		return String(raw)
	}
	return ''
}

/** Exact string `"true"` enables; everything else is false. */
export function isExistingUserLoginEnabled(input: ExistingUserLoginInput = {}): boolean {
	const flag = input.envFlag ?? readEnvFlag()
	return flag === 'true'
}
