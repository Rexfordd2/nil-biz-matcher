import { useEffect, useState } from 'react'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { supabase } from '../../lib/supabaseClient'
import { navigate } from '../../routes/RootRouter'
import { PUBLIC_MODE } from '../../config/publicMode'
import { isExistingUserLoginEnabled } from '../../config/existingUserLogin'
import PublicAuthDisabled from '../../components/auth/PublicAuthDisabled'
import { friendlyAuthErrorMessage } from '../../lib/supabaseErrors'
import { validateNewPassword } from '../../lib/auth/passwordReset'

export default function ResetRoute() {
	// Production public auth: PUBLIC_MODE=false → reset always available.
	// Demo public surface may reopen reset with existing-user login enablement.
	if (PUBLIC_MODE && !isExistingUserLoginEnabled()) {
		return <PublicAuthDisabled kind="reset" />
	}

	const [password, setPassword] = useState('')
	const [confirm, setConfirm] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [err, setErr] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [hasSession, setHasSession] = useState<boolean | null>(null)

	useEffect(() => {
		let canceled = false
		if (!supabase) {
			setHasSession(false)
			return
		}
		const sb = supabase

		async function check() {
			const { data } = await sb.auth.getSession()
			if (!canceled) setHasSession(Boolean(data.session))
		}

		check()

		const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
			if (!canceled) setHasSession(Boolean(session))
		})

		return () => {
			canceled = true
			try {
				listener.subscription.unsubscribe()
			} catch {
				// ignore
			}
		}
	}, [])

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setErr(null)
		if (!supabase) {
			setErr('Cloud auth not configured')
			return
		}
		if (hasSession !== true) {
			setErr('This reset link is invalid or expired. Please request a new reset email.')
			return
		}
		const validationError = validateNewPassword(password, confirm)
		if (validationError) {
			setErr(validationError)
			return
		}
		setLoading(true)
		try {
			const { error } = await supabase.auth.updateUser({ password })
			if (error) {
				setErr(friendlyAuthErrorMessage(error, { context: 'reset' }))
				return
			}
			navigate('/auth/login?passwordUpdated=1', true)
		} catch (e: any) {
			setErr(friendlyAuthErrorMessage(e, { context: 'reset' }))
		} finally {
			setLoading(false)
		}
	}

	if (!supabase) {
		return (
			<div className="mx-auto max-w-md px-4 md:px-6 py-10">
				<Card title="Set a new password">
					<div className="space-y-4" data-testid="auth-unavailable">
						<p className="text-sm text-gray-300">
							Cloud authentication is not currently available.
						</p>
						<p className="text-xs text-gray-400">
							Password reset requires Supabase configuration. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
						</p>
					</div>
				</Card>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-md px-4 md:px-6 py-10">
			<Card title="Set a new password">
				{hasSession === null && (
					<p className="text-sm text-gray-300 mb-4" data-testid="reset-session-loading">
						Checking your reset link…
					</p>
				)}
				{hasSession === false && (
					<div className="text-sm text-gray-300 mb-4" data-testid="reset-invalid-session">
						This reset link is invalid or expired. Please request a new reset email.
					</div>
				)}
				{hasSession === true && (
					<p className="text-sm text-gray-300 mb-4" data-testid="reset-session-ready">
						Choose a new password for your account.
					</p>
				)}
				<form className="space-y-4" data-testid="reset-form" onSubmit={handleSubmit}>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">New password</span>
						<div className="flex gap-2">
							<Input
								data-testid="reset-password"
								type={showPassword ? 'text' : 'password'}
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder="••••••••"
								disabled={hasSession !== true || loading}
								autoComplete="new-password"
							/>
							<button
								type="button"
								className="text-xs text-gray-300 hover:text-white px-2"
								onClick={() => setShowPassword(v => !v)}
								disabled={hasSession !== true || loading}
							>
								{showPassword ? 'Hide' : 'Show'}
							</button>
						</div>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Confirm password</span>
						<Input
							data-testid="reset-password-confirm"
							type={showPassword ? 'text' : 'password'}
							value={confirm}
							onChange={e => setConfirm(e.target.value)}
							placeholder="••••••••"
							disabled={hasSession !== true || loading}
							autoComplete="new-password"
						/>
					</label>
					{err && (
						<div className="text-red-400 text-sm" data-testid="reset-error" aria-live="polite">
							{err}
						</div>
					)}
					<div className="pt-2">
						<Button
							type="submit"
							className="red-glow"
							data-testid="reset-submit"
							disabled={loading || hasSession !== true}
						>
							{loading ? <span data-testid="reset-saving">Saving…</span> : 'Save password'}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	)
}
