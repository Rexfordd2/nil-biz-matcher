import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { CurrentUser } from '../utils/auth'
import { authLogin, authLogout, authMe, authRegister } from '../utils/auth'

type AuthContextValue = {
	user: CurrentUser | null
	login: (email: string) => Promise<CurrentUser>
	signup: (input: { fullName: string; email: string; phone?: string; marketingConsent?: boolean }) => Promise<CurrentUser>
	logout: () => Promise<void>
	refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<CurrentUser | null>(null)

	const refresh = useCallback(async () => {
		const u = await authMe()
		setUser(u)
	}, [])

	useEffect(() => {
		refresh()
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

	const value = useMemo<AuthContextValue>(() => ({ user, login, signup, logout, refresh }), [user, login, signup, logout, refresh])

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
	return ctx
}


