export type CurrentUser = {
	id: string
	email: string
	fullName: string
	phone?: string | null
	role: string
	marketingConsent?: boolean
}

import { createLocalUser, getCurrentUser as getLocalCurrentUser, loginLocalUser, logoutUser } from '../lib/authClient'

export async function authMe(): Promise<CurrentUser | null> {
	// Prefer server session if available; fall back to local
	try {
		// #region agent log
		const __dbgBefore = {
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'B',
			location: 'src/utils/auth.ts:authMe:before',
			message: 'Calling /api/auth/me',
			data: {},
			timestamp: Date.now()
		}
		fetch('http://127.0.0.1:7242/ingest/f93d76cb-ddaa-401d-972f-239de3ada967', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(__dbgBefore)
		}).catch(() => {})
		fetch('/api/debug/log', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(__dbgBefore)
		}).catch(() => {})
		// #endregion
		const res = await fetch('/api/auth/me', { method: 'GET' })
		// #region agent log
		const __dbgAfter = {
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'B',
			location: 'src/utils/auth.ts:authMe:after',
			message: 'Response from /api/auth/me',
			data: { ok: res.ok, status: res.status },
			timestamp: Date.now()
		}
		fetch('http://127.0.0.1:7242/ingest/f93d76cb-ddaa-401d-972f-239de3ada967', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(__dbgAfter)
		}).catch(() => {})
		fetch('/api/debug/log', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(__dbgAfter)
		}).catch(() => {})
		// #endregion
		if (res.ok) {
			const data = await res.json()
			return (data?.user || null) as CurrentUser | null
		}
	} catch {
		// #region agent log
		const __dbgCatch = {
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'B',
			location: 'src/utils/auth.ts:authMe:catch',
			message: 'Error calling /api/auth/me; falling back',
			data: {},
			timestamp: Date.now()
		}
		fetch('http://127.0.0.1:7242/ingest/f93d76cb-ddaa-401d-972f-239de3ada967', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(__dbgCatch)
		}).catch(() => {})
		fetch('/api/debug/log', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(__dbgCatch)
		}).catch(() => {})
		// #endregion
	}
	return getLocalCurrentUser() as CurrentUser | null
}

export async function authRegister(input: { email: string; fullName: string; phone?: string; marketingConsent?: boolean }): Promise<CurrentUser> {
	// Try server registration first to get an HTTP-only session cookie
	try {
		const res = await fetch('/api/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		})
		if (!res.ok) {
			const msg = (await res.json().catch(() => ({})))?.error || `Registration failed (${res.status})`
			throw new Error(msg)
		}
		const data = await res.json()
		return data.user as CurrentUser
	} catch (err) {
		// Fallback to local (offline/dev) behavior
		const user = createLocalUser(input)
		return user as CurrentUser
	}
}

export async function authLogin(input: { email: string }): Promise<CurrentUser> {
	// Try server login first
	try {
		const res = await fetch('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		})
		if (!res.ok) {
			const msg = (await res.json().catch(() => ({})))?.error || `Login failed (${res.status})`
			throw new Error(msg)
		}
		const data = await res.json()
		return data.user as CurrentUser
	} catch (err: any) {
		// Fallback to local (offline/dev) behavior
		const user = loginLocalUser(input.email)
		if (!user) {
			throw new Error(err?.message || 'No account found for this email. Try creating one first.')
		}
		return user as CurrentUser
	}
}

export async function authLogout(): Promise<void> {
	// Try server logout; ignore errors and always clear local
	try {
		await fetch('/api/auth/logout', { method: 'POST' })
	} catch {}
	logoutUser()
}


