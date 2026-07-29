/**
 * Existing-user login control — independent from public signup.
 *
 * When VITE_PUBLIC_MODE=true, login and signup are both disabled by default.
 * Setting VITE_EXISTING_USER_LOGIN_ENABLED=true permits password login for
 * already-confirmed accounts while signup remains disabled under public mode.
 *
 * Default / absent / any value other than exact "true" → false.
 * Not enabled by query parameters, client storage, or UI.
 *
 * NOT ENABLED BY THIS COMMIT in Production / Preview.
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
