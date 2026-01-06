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

	useEffect(() => {
		function onPop() {
			setLoc(parseLocation(window.location.pathname))
		}
		window.addEventListener('popstate', onPop)
		return () => window.removeEventListener('popstate', onPop)
	}, [])

	// Auth guard for /app/*
	useEffect(() => {
		if ((loc.key === 'app' || loc.key === 'onboarding') && !initializing && !user) {
			const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
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
			{outlet}
		</div>
	)
}


