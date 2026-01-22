import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Card from '../ui/Card'
import type { CurrentUser } from '../../utils/auth'
import { supabase } from '../../lib/supabaseClient'
import { signIn } from '../../lib/authSupabase'
import { friendlyAuthErrorMessage } from '../../lib/supabaseErrors'
import { navigate } from '../../routes/RootRouter'

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
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [sendingReset, setSendingReset] = useState(false)
	const [slow, setSlow] = useState(false)
	const [submitCapturedCount, setSubmitCapturedCount] = useState(0)
	const [clickCapturedCount, setClickCapturedCount] = useState(0)
	const [nativeSubmitCount, setNativeSubmitCount] = useState(0)
	const [handleSubmitCount, setHandleSubmitCount] = useState(0)
	const DEBUG_AUTH = import.meta.env.DEV || window.location.search.includes('debugAuth=1')

	useEffect(() => {
		if (!loading) {
			setSlow(false)
			return
		}
		const t = window.setTimeout(() => setSlow(true), 8000)
		return () => window.clearTimeout(t)
	}, [loading])

	// Native DOM submit listener (tripwire)
	useEffect(() => {
		;(window as any).__nativeSubmitCount = 0
		const handler = () => {
			const count = ((window as any).__nativeSubmitCount || 0) + 1
			;(window as any).__nativeSubmitCount = count
			setNativeSubmitCount(count)
		}
		document.addEventListener('submit', handler, true)
		return () => document.removeEventListener('submit', handler, true)
	}, [])

	async function handleSubmit(e: React.FormEvent) {
		setHandleSubmitCount(c => c + 1)
		setIsSubmitting(true)
		setLoading(true)
		setErr(null)
		e.preventDefault()
		try {
			if (DEBUG_AUTH) console.log('[login] submit', { email })
			const { data: u, error } = await signIn({ email, password })
			if (error) {
				if (DEBUG_AUTH) console.log('[login] error', error)
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
			if (DEBUG_AUTH) console.log('[login] success', { userId: current.id })
			try {
				onLoggedIn(current)
			} catch (cbErr) {
				// eslint-disable-next-line no-console
				console.warn('[login] onLoggedIn error', cbErr)
			}
			// Redirect immediately after success
			const url = new URL(window.location.href)
			const returnTo = url.searchParams.get('returnTo')
			navigate(returnTo || '/app', true)
		} catch (e: any) {
			if (DEBUG_AUTH) console.log('[login] exception', e)
			setErr(friendlyAuthErrorMessage(e, { context: 'login' }) || 'We could not sign you in. Please try again.')
		} finally {
			setLoading(false)
			setIsSubmitting(false)
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
				<form 
					data-testid="login-form" 
					className="space-y-4" 
					onSubmit={handleSubmit}
					onSubmitCapture={() => setSubmitCapturedCount(c => c + 1)}
					onClickCapture={() => setClickCapturedCount(c => c + 1)}
				>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Email</span>
						<Input
							data-testid="login-email"
							type="email"
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder="you@example.com"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Password</span>
						<Input
							data-testid="login-password"
							type="password"
							value={password}
							onChange={e => setPassword(e.target.value)}
							placeholder="••••••••"
						/>
					</label>
					<div data-testid="login-status" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{isSubmitting ? 'submitting' : 'idle'}
					</div>
					<div data-testid="login-submit-captured" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{submitCapturedCount}
					</div>
					<div data-testid="login-click-captured" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{clickCapturedCount}
					</div>
					<div data-testid="login-native-submit-count" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{nativeSubmitCount}
					</div>
					<div data-testid="login-handle-submit-count" aria-live="polite" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
						{handleSubmitCount}
					</div>
					<div data-testid="login-error" aria-live="polite" className="text-red-400 text-sm">
						{err ?? ''}
					</div>
					{slow && !err && <div className="text-amber-300 text-xs">Login is taking longer than expected. Refresh and try again.</div>}
					<div className="flex items-center justify-between">
						<Button 
							data-testid="login-submit" 
							data-testid-loading={loading ? 'true' : 'false'} 
							className="red-glow" 
							type="submit" 
							disabled={isSubmitting}
							onClick={() => setClickCapturedCount(c => c + 1)}
						>
							{loading ? <span data-testid="login-loading">Logging in…</span> : 'Log in'}
						</Button>
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


