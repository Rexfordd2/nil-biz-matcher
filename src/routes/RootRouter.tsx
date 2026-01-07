import { useEffect, useMemo, useState } from 'react'
import App from '../App'
import Home from '../pages/Home'
import Terms from '../pages/Terms'
import Privacy from '../pages/Privacy'
import Onboarding from '../pages/Onboarding'
import Status from '../pages/Status'
import LoginRoute from '../pages/auth/LoginRoute'
import SignupRoute from '../pages/auth/SignupRoute'
import ResetRoute from '../pages/auth/ResetRoute'
import { useAuth } from '../context/AuthContext'
import { supabaseEnvConfigured } from '../lib/supabaseClient'

type RouteEntry =
	| { key: 'home' }
	| { key: 'login' }
	| { key: 'signup' }
	| { key: 'reset' }
	| { key: 'terms' }
	| { key: 'privacy' }
	| { key: 'onboarding' }
	| { key: 'status' }
	| { key: 'app'; subpath: string }

function parseLocation(pathname: string): RouteEntry {
	if (pathname === '/' || pathname === '') return { key: 'home' }
	if (pathname.startsWith('/auth/login')) return { key: 'login' }
	if (pathname.startsWith('/auth/signup')) return { key: 'signup' }
	if (pathname.startsWith('/terms')) return { key: 'terms' }
	if (pathname.startsWith('/privacy')) return { key: 'privacy' }
	if (pathname.startsWith('/app')) return { key: 'app', subpath: pathname.slice('/app'.length) || '/' }
	if (pathname.startsWith('/onboarding')) return { key: 'onboarding' }
	if (pathname.startsWith('/auth/reset')) return { key: 'reset' }
	if (pathname.startsWith('/status')) return { key: 'status' }
	// fallback to home
	return { key: 'home' }
}

export function navigate(to: string, replace: boolean = false) {
	// Debug navigation is noisy; restrict to explicit auth debugging
	const DEBUG_AUTH = import.meta.env.DEV || window.location.search.includes('debugAuth=1')
	if (DEBUG_AUTH) console.log('[router] navigate', { to, replace })
	if (replace) {
		window.history.replaceState({}, '', to)
	} else {
		window.history.pushState({}, '', to)
	}
	window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function RootRouter() {
	const [loc, setLoc] = useState<RouteEntry>(() => parseLocation(window.location.pathname))
	const { user, initializing } = useAuth()
	const DEBUG_AUTH = import.meta.env.DEV || window.location.search.includes('debugAuth=1')

	useEffect(() => {
		function onPop() {
			setLoc(parseLocation(window.location.pathname))
		}
		window.addEventListener('popstate', onPop)
		return () => window.removeEventListener('popstate', onPop)
	}, [])

	// Auth guard for /app/*
	useEffect(() => {
		if (DEBUG_AUTH) console.log('[router] guard check', { route: loc.key, initializing, hasUser: Boolean(user) })
		// Do not redirect while initializing
		if (initializing) return
		// Only guard app or onboarding sections
		if ((loc.key === 'app' || loc.key === 'onboarding') && !user) {
			const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
			if (DEBUG_AUTH) console.log('[router] redirect -> /auth/login', { returnTo })
			navigate(`/auth/login?returnTo=${returnTo}`, true)
		}
	}, [loc, user, initializing])

	const outlet = useMemo(() => {
		switch (loc.key) {
			case 'home':
				return <Home />
			case 'login':
				return <LoginRoute />
			case 'signup':
				return <SignupRoute />
			case 'terms':
				return <Terms />
			case 'privacy':
				return <Privacy />
			case 'onboarding':
				return <Onboarding />
			case 'reset':
				return <ResetRoute />
			case 'status':
				return <Status />
			case 'app':
				// Render authenticated app shell under /app/*
				return <App />
			case 'login':
			case 'signup':
				// These routes are handled in Home page CTAs and Auth components embedded there if needed.
				// For now, fallthrough to Home which contains CTAs. If you prefer dedicated pages, you can implement them similarly.
				return <Home />
			default:
				return <Home />
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loc, user])

	return (
		<div className="min-h-screen bg-background text-foreground">
			{import.meta.env.DEV && !supabaseEnvConfigured && (
				<div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/10 border-b border-amber-400/40 text-amber-200 text-xs px-3 py-2">
					<span className="font-semibold">Supabase not configured</span> — set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (DEV only banner)
				</div>
			)}
			{outlet}
		</div>
	)
}


