import SignUp from '../../components/auth/SignUp'
import SignUpSupabase from '../../components/auth/SignUpSupabase'
import { supabaseEnvConfigured } from '../../lib/supabaseClient'
import { useMemo } from 'react'
import { navigate } from '../../routes/RootRouter'
import type { CurrentUser } from '../../utils/auth'
import { PUBLIC_MODE } from '../../config/publicMode'
import PublicAuthDisabled from '../../components/auth/PublicAuthDisabled'

export default function SignupRoute() {
	// In public mode, auth is disabled
	if (PUBLIC_MODE) {
		return <PublicAuthDisabled kind="signup" />
	}

	const returnTo = useMemo(() => {
		const sp = new URLSearchParams(window.location.search)
		return sp.get('returnTo') || '/app'
	}, [])
	function onSignedIn(_: CurrentUser) {
		navigate(returnTo)
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
		</div>
	)
}


