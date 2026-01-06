import Login from '../../components/auth/Login'
import LoginSupabase from '../../components/auth/LoginSupabase'
import { supabaseEnvConfigured } from '../../lib/supabaseClient'
import { useMemo } from 'react'
import { navigate } from '../../routes/RootRouter'
import type { CurrentUser } from '../../utils/auth'

export default function LoginRoute() {
	const returnTo = useMemo(() => {
		const sp = new URLSearchParams(window.location.search)
		return sp.get('returnTo') || '/app'
	}, [])
	function onLoggedIn(_: CurrentUser) {
		navigate(returnTo)
	}
	return (
		<div className="mx-auto max-w-3xl px-4 md:px-6 py-10">
			{supabaseEnvConfigured ? (
				<LoginSupabase onLoggedIn={onLoggedIn} onNeedAccount={() => navigate('/auth/signup')} />
			) : (
				<Login onLoggedIn={onLoggedIn} onNeedAccount={() => navigate('/auth/signup')} />
			)}
		</div>
	)
}


