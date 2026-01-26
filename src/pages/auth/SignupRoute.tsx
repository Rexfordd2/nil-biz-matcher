import SignUp from '../../components/auth/SignUp'
import SignUpSupabase from '../../components/auth/SignUpSupabase'
import { supabaseEnvConfigured } from '../../lib/supabaseClient'
import { useMemo } from 'react'
import { navigate } from '../../routes/RootRouter'
import type { CurrentUser } from '../../utils/auth'

export default function SignupRoute() {
	const returnTo = useMemo(() => {
		const sp = new URLSearchParams(window.location.search)
		return sp.get('returnTo') || '/app'
	}, [])
	function onSignedIn(_: CurrentUser) {
		navigate(returnTo)
	}
	return (
		<div className="mx-auto max-w-3xl px-4 md:px-6 py-10">
			{supabaseEnvConfigured ? (
				<SignUpSupabase onSignedIn={onSignedIn} />
			) : import.meta.env.DEV ? (
				<SignUp onSignedIn={onSignedIn} />
			) : (
				<div className="rounded-md border border-border bg-surface p-4 text-sm text-gray-300">
					Supabase not configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
				</div>
			)}
		</div>
	)
}


