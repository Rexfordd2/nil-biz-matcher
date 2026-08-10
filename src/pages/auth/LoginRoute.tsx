import Login from '../../components/auth/Login'
import LoginSupabase from '../../components/auth/LoginSupabase'
import { supabaseEnvConfigured } from '../../lib/supabaseClient'
import { useMemo } from 'react'
import { navigate } from '../../routes/RootRouter'
import type { CurrentUser } from '../../utils/auth'
import { PUBLIC_MODE } from '../../config/publicMode'
import { isExistingUserLoginEnabled } from '../../config/existingUserLogin'
import PublicAuthDisabled from '../../components/auth/PublicAuthDisabled'
import { postAuthDestination } from '../../lib/auth/onboardingState'

export default function LoginRoute() {
	// Production public auth: PUBLIC_MODE=false → login always available.
	// Demo public surface (PUBLIC_MODE=true) may optionally reopen login via
	// VITE_EXISTING_USER_LOGIN_ENABLED without enabling signup.
	if (PUBLIC_MODE && !isExistingUserLoginEnabled()) {
		return <PublicAuthDisabled kind="login" />
	}

	const returnTo = useMemo(() => {
		const sp = new URLSearchParams(window.location.search)
		return sp.get('returnTo') || '/app/today'
	}, [])
	function onLoggedIn(user: CurrentUser) {
		navigate(postAuthDestination(user.id, returnTo), true)
	}
	return (
		<div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-4">
			{supabaseEnvConfigured ? (
				<LoginSupabase onLoggedIn={onLoggedIn} onNeedAccount={() => navigate('/auth/signup')} />
			) : import.meta.env.DEV ? (
				<Login onLoggedIn={onLoggedIn} onNeedAccount={() => navigate('/auth/signup')} />
			) : (
				<div className="rounded-md border border-border bg-surface p-4 text-sm text-gray-300 max-w-md mx-auto" data-testid="auth-unavailable">
					<p className="mb-3">Cloud login is not currently available.</p>
					<p className="text-xs text-gray-400 mb-4">
						Supabase not configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
					</p>
				</div>
			)}
			
			<div className="max-w-md mx-auto text-center space-y-2">
				<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
					<button
						onClick={() => navigate('/app')}
						className="text-gray-300 hover:text-white underline"
						data-testid="login-back-to-gate"
					>
						Back to access gate
					</button>
					<span className="text-gray-500">•</span>
					<button
						onClick={() => navigate('/')}
						className="text-gray-300 hover:text-white underline"
						data-testid="login-back-home"
					>
						Back home
					</button>
					<span className="text-gray-500">•</span>
					<a
						href="https://athletehouze.com"
						target="_blank"
						rel="noreferrer"
						className="text-gray-300 hover:text-white underline"
						data-testid="login-route-athlete-houze"
					>
						Athlete Houze
					</a>
				</div>
			</div>
		</div>
	)
}


