import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Card from '../ui/Card'
import type { CurrentUser } from '../../utils/auth'
import { supabase } from '../../lib/supabaseClient'
import { signIn } from '../../lib/authSupabase'
import { friendlyAuthErrorMessage } from '../../lib/supabaseErrors'

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
	const [sendingReset, setSendingReset] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setErr(null)
		setLoading(true)
		try {
			const { data: u, error } = await signIn({ email, password })
			if (error) {
				setErr(friendlyAuthErrorMessage(error, { context: 'login' }))
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
		} catch (e: any) {
			setErr(friendlyAuthErrorMessage(e, { context: 'login' }) || 'Login failed')
		} finally {
			setLoading(false)
		}
	}

	async function handleForgotPassword() {
		if (!email) {
			setErr('Enter your email to reset password')
			return
		}
		setErr(null)
		setSendingReset(true)
		try {
			await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` })
		} catch (e: any) {
			setErr(e?.message || 'Failed to send reset email')
		} finally {
			setSendingReset(false)
		}
	}

	return (
		<div className="max-w-md mx-auto">
			<Card title="Log in to Athlete Ledger">
				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Email</span>
						<Input
							type="email"
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder="you@example.com"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Password</span>
						<Input
							type="password"
							value={password}
							onChange={e => setPassword(e.target.value)}
							placeholder="••••••••"
						/>
					</label>
					{err && <div className="text-red-400 text-sm">{err}</div>}
					<div className="flex items-center justify-between">
						<Button className="red-glow" disabled={loading} onClick={() => {}}>{loading ? 'Logging in…' : 'Log in'}</Button>
						{onNeedAccount && (
							<button type="button" onClick={onNeedAccount} className="text-sm text-gray-300 hover:text-white">Need an account? Sign up</button>
						)}
					</div>
					<div className="flex items-center justify-between">
						<button type="button" onClick={handleForgotPassword} className="text-xs text-gray-300 underline hover:text-white" disabled={sendingReset}>
							{sendingReset ? 'Sending reset…' : 'Forgot password?'}
						</button>
					</div>
				</form>
				<div className="text-xs text-gray-400 mt-3">
					By using Athlete Ledger, you agree to our <a href="/terms" className="underline">Terms</a>.
				</div>
			</Card>
		</div>
	)
}


