import { useEffect, useMemo, useState } from 'react'
import App from '../App'
import Home from '../pages/Home'
import Demo from '../pages/Demo'
import Terms from '../pages/Terms'
import Privacy from '../pages/Privacy'
import Onboarding from '../pages/Onboarding'
import Status from '../pages/Status'
import DebugDiscoverRecruiting from '../pages/DebugDiscoverRecruiting'
import DebugBuild from '../pages/DebugBuild'
import DebugPlacesHooks from '../pages/DebugPlacesHooks'
import LoginRoute from '../pages/auth/LoginRoute'
import SignupRoute from '../pages/auth/SignupRoute'
import ResetRoute from '../pages/auth/ResetRoute'
import { supabaseEnvConfigured } from '../lib/supabaseClient'
import { isDebugAccessAllowed } from '../lib/debugAccess'

type RouteEntry =
	| { key: 'home' }
	| { key: 'demo' }
	| { key: 'login' }
	| { key: 'signup' }
	| { key: 'reset' }
	| { key: 'terms' }
	| { key: 'privacy' }
	| { key: 'onboarding' }
	| { key: 'status' }
	| { key: 'app'; subpath: string }
	| { key: 'debug_discover_recruiting' }
	| { key: 'debug_build' }
	| { key: 'debug_places_hooks' }
	| { key: 'not_found' }

function parseLocation(pathname: string): RouteEntry {
	if (pathname === '/' || pathname === '') return { key: 'home' }
	if (pathname.startsWith('/demo')) return { key: 'demo' }
	if (pathname.startsWith('/auth/login')) return { key: 'login' }
	if (pathname.startsWith('/auth/signup')) return { key: 'signup' }
	if (pathname.startsWith('/terms')) return { key: 'terms' }
	if (pathname.startsWith('/privacy')) return { key: 'privacy' }
	if (pathname.startsWith('/app')) return { key: 'app', subpath: pathname.slice('/app'.length) || '/' }
	if (pathname.startsWith('/onboarding')) return { key: 'onboarding' }
	if (pathname.startsWith('/auth/reset')) return { key: 'reset' }
	if (pathname.startsWith('/status')) return { key: 'status' }
	if (pathname === '/debug/discover-recruiting') return { key: 'debug_discover_recruiting' }
	if (pathname === '/debug/build') return { key: 'debug_build' }
	if (pathname === '/debug/places-hooks') return { key: 'debug_places_hooks' }
	// Unknown route - will redirect to home
	return { key: 'not_found' }
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

	useEffect(() => {
		function onPop() {
			setLoc(parseLocation(window.location.pathname))
		}
		window.addEventListener('popstate', onPop)
		return () => window.removeEventListener('popstate', onPop)
	}, [])

	// Redirect effect: handle unknown routes and denied debug routes
	useEffect(() => {
		const hasDebugAccess = isDebugAccessAllowed(window.location.search)
		const isDebugRoute = loc.key === 'debug_discover_recruiting' || loc.key === 'debug_build' || loc.key === 'debug_places_hooks'
		const shouldRedirect = loc.key === 'not_found' || (isDebugRoute && !hasDebugAccess)

		if (shouldRedirect && window.location.pathname !== '/') {
			// Redirect to home (marketing landing)
			navigate('/', true)
		}
	}, [loc])

	// Auth guard removed - allow unauthenticated access to all routes
	// /app is the main experience and is accessible to anonymous users
	// /demo is an optional marketing demo, also accessible without authentication

	const outlet = useMemo(() => {
		// Check debug access for debug routes
		const hasDebugAccess = isDebugAccessAllowed(window.location.search)

		switch (loc.key) {
			case 'home':
				return <Home />
			case 'demo':
				return <Demo />
			case 'debug_discover_recruiting':
				// Protect debug routes: redirect to / (handled by effect above)
				if (!hasDebugAccess) {
					return <Home />
				}
				return <DebugDiscoverRecruiting />
			case 'debug_build':
				// Protect debug routes: redirect to / (handled by effect above)
				if (!hasDebugAccess) {
					return <Home />
				}
				return <DebugBuild />
			case 'debug_places_hooks':
				// Protect debug routes: redirect to / (handled by effect above)
				if (!hasDebugAccess) {
					return <Home />
				}
				return <DebugPlacesHooks />
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
				// Render app shell under /app/* - accessible to anonymous users
				// Components handle null currentUser gracefully using anonId-based behavior
				return <App />
			case 'not_found':
				// Unknown route: redirect to / (handled by effect above)
				return <Home />
			default:
				return <Home />
		}
	}, [loc])

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


