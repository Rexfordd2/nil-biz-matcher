import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { CurrentUser } from '../utils/auth'
import { authLogin, authLogout, authRegister } from '../utils/auth'
import { supabase } from '../lib/supabaseClient'
import { goToLogout } from '../lib/auth/navigation'

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

	// Debug flag for verbose auth logging (dev or ?debugAuth=1)
	const DEBUG_AUTH = import.meta.env.DEV || window.location.search.includes('debugAuth=1')

	function mapSupabaseUserToCurrent(userLike: any | null | undefined): CurrentUser | null {
		const su = userLike as any | null | undefined
		if (!su) return null
		return {
			id: su.id,
			email: su.email || '',
			fullName: (su.user_metadata?.full_name as string) || su.email || 'User',
			role: (su.user_metadata?.role as string) || 'athlete',
			marketingConsent: Boolean(su.user_metadata?.marketingConsent)
		}
	}

	const refresh = useCallback(async () => {
		if (DEBUG_AUTH) console.log('[auth] refresh: auth getSession start')
		setInitializing(true)
		try {
			if (!supabase) {
				if (DEBUG_AUTH) console.log('[auth] refresh: supabase not configured')
				setUser(null)
				setInitializing(false)
				return
			}
			
			// Check localStorage for Supabase session token before making network call
			// Supabase stores sessions in localStorage with keys like "sb-<project-ref>-auth-token"
			const hasLocalSession = typeof window !== 'undefined' && 
				Object.keys(localStorage).some(key => 
					key.startsWith('sb-') && key.includes('auth-token')
				)
			
			if (!hasLocalSession) {
				// No session indicators - skip network call
				if (DEBUG_AUTH) console.log('[auth] refresh: no session indicators, skipping getSession')
				setUser(null)
				setInitializing(false)
				return
			}
			
			const { data, error } = await supabase.auth.getSession()
			if (error) {
				// Silently handle errors - don't show network errors for missing sessions
				if (!error.message?.includes('session') && !error.message?.includes('token')) {
					// eslint-disable-next-line no-console
					console.warn('[auth] getSession error', error)
				}
			}
			const s = data?.session ?? null
			const mapped = mapSupabaseUserToCurrent(s?.user)
			setUser(mapped)
			if (DEBUG_AUTH) console.log('[auth] refresh: auth getSession end', { hasSession: Boolean(s), hasUser: Boolean(mapped) })
		} catch (e) {
			// Silently handle exceptions - don't block rendering
			// eslint-disable-next-line no-console
			if (DEBUG_AUTH) console.warn('[auth] getSession exception', e)
			setUser(null)
		} finally {
			setInitializing(false)
			if (DEBUG_AUTH) console.log('[auth] initializing false (refresh finally)')
		}
	}, [DEBUG_AUTH])

	useEffect(() => {
		let mounted = true
		let unsubscribe: (() => void) | undefined
		if (DEBUG_AUTH) console.log('[auth] mount: boot start')

		// Emergency fallback: force initialize false after 5s
		const emergencyTimer = window.setTimeout(() => {
			if (mounted && initializing) {
				setInitializing(false)
				if (DEBUG_AUTH) console.log('[auth] initializing forced false (5s emergency)')
			}
		}, 5000)

		async function boot() {
			try {
				if (DEBUG_AUTH) console.log('[auth] boot: auth getSession start')
				setInitializing(true)
				if (!supabase) {
					if (DEBUG_AUTH) console.log('[auth] boot: supabase not configured')
					if (!mounted) return
					setUser(null)
					setInitializing(false)
					return
				}
				
				// Check localStorage for Supabase session token before making network call
				// Supabase stores sessions in localStorage with keys like "sb-<project-ref>-auth-token"
				const hasLocalSession = typeof window !== 'undefined' && 
					Object.keys(localStorage).some(key => 
						key.startsWith('sb-') && key.includes('auth-token')
					)
				
				if (!hasLocalSession) {
					// No session indicators - skip network call
					if (DEBUG_AUTH) console.log('[auth] boot: no session indicators, skipping getSession')
					if (!mounted) return
					setUser(null)
					setInitializing(false)
					return
				}
				
				const { data, error } = await supabase.auth.getSession()
				if (error) {
					// Silently handle errors - don't show network errors for missing sessions
					if (!error.message?.includes('session') && !error.message?.includes('token')) {
						// eslint-disable-next-line no-console
						console.warn('[auth] getSession error', error)
					}
				}
				if (!mounted) return
				const s = data?.session ?? null
				setUser(mapSupabaseUserToCurrent(s?.user))
				if (DEBUG_AUTH) console.log('[auth] boot: auth getSession end', { hasSession: Boolean(s) })
			} catch (e) {
				// Silently handle exceptions - don't block rendering
				// eslint-disable-next-line no-console
				if (DEBUG_AUTH) console.warn('[auth] getSession exception', e)
				if (!mounted) return
				setUser(null)
			} finally {
				if (mounted) {
					setInitializing(false)
					if (DEBUG_AUTH) console.log('[auth] initializing false (boot finally)')
				}
			}
		}

		boot()

		if (supabase) {
			const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
				if (!mounted) return
				if (DEBUG_AUTH) console.log('[auth] auth state change', event, { hasSession: Boolean(session) })
				setUser(mapSupabaseUserToCurrent(session?.user))
				// If initializing was stuck, unstick it
				setInitializing(false)
				if (DEBUG_AUTH) console.log('[auth] initializing false (onAuthStateChange)')
			})
			unsubscribe = () => listener.subscription.unsubscribe()
		}

		return () => {
			mounted = false
			window.clearTimeout(emergencyTimer)
			if (unsubscribe) {
				try {
					unsubscribe()
				} catch {
					// ignore
				}
			}
			if (DEBUG_AUTH) console.log('[auth] unmount: cleanup done')
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

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
		// Use centralized logout function for consistent behavior
		await goToLogout()
	}, [])

	const value = useMemo<AuthContextValue>(() => ({ user, initializing, login, signup, logout, refresh }), [user, initializing, login, signup, logout, refresh])

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
	return ctx
}


