import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { CurrentUser } from '../utils/auth'
import { authLogin, authLogout, authMe, authRegister } from '../utils/auth'
import { supabase } from '../lib/supabaseClient'

type AuthContextValue = {
	user: CurrentUser | null
	initializing: boolean
	login: (email: string) => Promise<CurrentUser>
	signup: (input: { fullName: string; email: string; phone?: string; marketingConsent?: boolean }) => Promise<CurrentUser>
	logout: () => Promise<void>
	refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<CurrentUser | null>(null)
	const [initializing, setInitializing] = useState(true)

	const refresh = useCallback(async () => {
		setInitializing(true)
		// Try server-based session
		const u = await authMe()
		if (u) {
			setUser(u)
			setInitializing(false)
			return
		}
		// Fallback to Supabase session if configured
		if (supabase) {
			const { data } = await supabase.auth.getUser()
			const su = data.user
			if (su) {
				const mapped: CurrentUser = {
					id: su.id,
					email: su.email || '',
					fullName: (su.user_metadata?.full_name as string) || su.email || 'User',
					role: (su.user_metadata?.role as string) || 'athlete',
					marketingConsent: Boolean(su.user_metadata?.marketingConsent)
				}
				setUser(mapped)
				setInitializing(false)
				return
			}
		}
		setUser(null)
		setInitializing(false)
	}, [])

	useEffect(() => {
		// Ensure refresh completion toggles initializing off
		refresh().catch(() => setInitializing(false))
	}, [refresh])

	const login = useCallback(async (email: string) => {
		const u = await authLogin({ email })
		setUser(u)
		return u
	}, [])

	const signup = useCallback(async (input: { fullName: string; email: string; phone?: string; marketingConsent?: boolean }) => {
		const u = await authRegister(input)
		setUser(u)
		return u
	}, [])

	const logout = useCallback(async () => {
		await authLogout()
		setUser(null)
	}, [])

	const value = useMemo<AuthContextValue>(() => ({ user, initializing, login, signup, logout, refresh }), [user, initializing, login, signup, logout, refresh])

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
	return ctx
}


