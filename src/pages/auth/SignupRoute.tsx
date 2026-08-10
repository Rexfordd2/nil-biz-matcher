import SignUp from '../../components/auth/SignUp'
import SignUpSupabase from '../../components/auth/SignUpSupabase'
import { supabaseEnvConfigured } from '../../lib/supabaseClient'
import { useMemo } from 'react'
import { navigate } from '../../routes/RootRouter'
import type { CurrentUser } from '../../utils/auth'
import { PUBLIC_MODE } from '../../config/publicMode'
import PublicAuthDisabled from '../../components/auth/PublicAuthDisabled'
import { postAuthDestination } from '../../lib/auth/onboardingState'

export default function SignupRoute() {
	// Demo / public-release surface may still disable account creation.
	// Production public auth runs with PUBLIC_MODE=false so signup is available.
	if (PUBLIC_MODE) {
		return <PublicAuthDisabled kind="signup" />
	}

	const returnTo = useMemo(() => {
		const sp = new URLSearchParams(window.location.search)
		return sp.get('returnTo') || '/app/today'
	}, [])

	function onSignedIn(user: CurrentUser) {
		navigate(postAuthDestination(user.id, returnTo), true)
	}

	return (
		<div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-4">
			{supabaseEnvConfigured ? (
				<SignUpSupabase onSignedIn={onSignedIn} />
			) : import.meta.env.DEV ? (
				<SignUp onSignedIn={onSignedIn} />
			) : (
				<div className="rounded-md border border-border bg-surface p-4 text-sm text-gray-300 max-w-md mx-auto" data-testid="auth-unavailable">
					<p className="mb-3">Cloud sign up is not currently available.</p>
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
						data-testid="signup-back-to-gate"
					>
						Back to access gate
					</button>
					<span className="text-gray-500">•</span>
					<button
						onClick={() => navigate('/auth/login')}
						className="text-gray-300 hover:text-white underline"
						data-testid="signup-back-to-login"
					>
						Log in
					</button>
					<span className="text-gray-500">•</span>
					<button
						onClick={() => navigate('/')}
						className="text-gray-300 hover:text-white underline"
						data-testid="signup-back-home"
					>
						Back home
					</button>
				</div>
			</div>
		</div>
	)
}
