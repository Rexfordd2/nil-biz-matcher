import { useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import type { CurrentUser } from '../../utils/auth'
import { supabase } from '../../lib/supabaseClient'
import { signIn } from '../../lib/authSupabase'

type Props = {
	onLoggedIn: (user: CurrentUser) => void
	onNeedAccount?: () => void
}

export default function LoginSupabase({ onLoggedIn, onNeedAccount }: Props) {
	if (!supabase) {
		return (
			<div className="max-w-md mx-auto">
				<Card title="Cloud login unavailable">
					<div className="text-sm text-gray-300">
						Supabase is not configured. Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable cloud login.
					</div>
				</Card>
			</div>
		)
	}
	const sb = supabase!
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [err, setErr] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setErr(null)
		setLoading(true)
		const { data: u, error } = await signIn({ email, password })
		setLoading(false)
		if (error) {
			setErr(error)
			return
		}
		if (!u) {
			setErr('Unable to load user after login')
			return
		}
		const current: CurrentUser = {
			id: u.id,
			email: u.email || email,
			fullName: (u.user_metadata?.full_name as string) || u.email || 'User',
			role: (u.user_metadata?.role as string) || 'athlete',
			marketingConsent: Boolean(u.user_metadata?.marketingConsent)
		}
		onLoggedIn(current)
	}

	return (
		<div className="max-w-md mx-auto">
			<Card title="Log in to Athlete Ledger">
				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Email</span>
						<input
							type="email"
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder="you@example.com"
							className="bg-mid border border-border rounded-md px-3 py-2 text-white"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Password</span>
						<input
							type="password"
							value={password}
							onChange={e => setPassword(e.target.value)}
							placeholder="••••••••"
							className="bg-mid border border-border rounded-md px-3 py-2 text-white"
						/>
					</label>
					{err && <div className="text-red-400 text-sm">{err}</div>}
					<div className="flex items-center justify-between">
						<Button className="red-glow" disabled={loading} onClick={() => {}}>{loading ? 'Logging in…' : 'Log in'}</Button>
						{onNeedAccount && (
							<button type="button" onClick={onNeedAccount} className="text-sm text-gray-300 hover:text-white">Need an account? Sign up</button>
						)}
					</div>
				</form>
			</Card>
		</div>
	)
}


