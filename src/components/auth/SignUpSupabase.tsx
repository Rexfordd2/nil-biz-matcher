import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Card from '../ui/Card'
import type { CurrentUser } from '../../utils/auth'
import { supabase } from '../../lib/supabaseClient'
import { resendSignupConfirmation, signUp } from '../../lib/authSupabase'
import { friendlyAuthErrorMessage } from '../../lib/supabaseErrors'
import { navigate } from '../../routes/RootRouter'

type Role = 'athlete' | 'parent' | 'coach'

type Props = {
	onSignedIn: (user: CurrentUser) => void
}

export default function SignUpSupabase({ onSignedIn }: Props) {
	if (!supabase) {
		return (
			<div className="max-w-lg mx-auto">
				<Card title="Cloud signup unavailable">
					<div className="text-sm text-gray-300" data-testid="auth-unavailable">
						Supabase is not configured. Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable cloud signup.
					</div>
				</Card>
			</div>
		)
	}
	const [displayName, setDisplayName] = useState('')
	const [role, setRole] = useState<Role>('athlete')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [termsAccepted, setTermsAccepted] = useState(false)
	const [err, setErr] = useState<string | null>(null)
	const [info, setInfo] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [resending, setResending] = useState(false)
	const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

	async function handleResend() {
		if (!email) return
		setErr(null)
		setInfo(null)
		setResending(true)
		try {
			const result = await resendSignupConfirmation(email)
			if (result.error) {
				setErr(friendlyAuthErrorMessage(result.error, { context: 'signup' }))
				return
			}
			setInfo('If that email needs confirmation, we sent another link.')
		} catch (e: any) {
			setErr(friendlyAuthErrorMessage(e, { context: 'signup' }))
		} finally {
			setResending(false)
		}
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (loading) return
		setErr(null)
		setInfo(null)
		if (!displayName.trim()) {
			setErr('Enter a display name')
			return
		}
		if (!termsAccepted) {
			setErr('You must accept the Terms of Use and Privacy Policy')
			return
		}
		if (password.length < 8) {
			setErr('Password must be at least 8 characters')
			return
		}
		if (password !== confirmPassword) {
			setErr('Passwords do not match')
			return
		}
		setLoading(true)

		try {
			const { TERMS_VERSION } = await import('../../constants/legal')
			const result = await signUp({
				email,
				password,
				fullName: displayName.trim(),
				emailRedirectTo: `${window.location.origin}/auth/login`,
				metadata: {
					full_name: displayName.trim(),
					role,
					termsAcceptedAt: new Date().toISOString(),
					termsVersion: TERMS_VERSION,
					// Product/display role only — never claim app_metadata privileges from the client.
				},
			})
			if (result.error || !result.user) {
				const message =
					friendlyAuthErrorMessage(result.error, { context: 'signup' }) ||
					"We couldn't create your account. Please try again shortly."
				setErr(message)
				return
			}

			// CASE B — account created, email confirmation required. Do not pretend authenticated.
			if (result.requiresEmailConfirmation || !result.session) {
				setAwaitingConfirmation(true)
				return
			}

			// CASE A — session exists; AuthContext receives it via onAuthStateChange.
			// Profile row is created by public.handle_new_user() trigger.
			const current: CurrentUser = {
				id: result.user.id,
				email: result.user.email || email,
				fullName: displayName.trim() || result.user.email || 'User',
				role,
				marketingConsent: false,
				workflowCloudPersistenceCanary: false,
			}
			onSignedIn(current)
		} catch (e: any) {
			const message =
				friendlyAuthErrorMessage(e, { context: 'signup' }) ||
				"We couldn't create your account. Please try again shortly."
			setErr(message)
		} finally {
			setLoading(false)
		}
	}

	if (awaitingConfirmation) {
		return (
			<div className="max-w-lg mx-auto">
				<Card title="Confirm your email">
					<div className="space-y-4" data-testid="signup-confirm-required">
						<p className="text-sm text-gray-300">
							Check your email to finish creating your NIL Roster account.
						</p>
						<p className="text-sm text-gray-400">
							After confirming your email, return here to sign in.
						</p>
						{info && (
							<div className="text-green-300 text-sm" data-testid="signup-resend-info" aria-live="polite">
								{info}
							</div>
						)}
						{err && (
							<div className="text-red-400 text-sm" data-testid="signup-error" aria-live="polite">
								{err}
							</div>
						)}
						<div className="flex flex-col sm:flex-row gap-2 pt-2">
							<Button
								type="button"
								className="red-glow"
								data-testid="signup-go-login"
								onClick={() => navigate('/auth/login')}
							>
								Back to login
							</Button>
							<Button
								type="button"
								variant="secondary"
								data-testid="signup-resend-confirmation"
								disabled={resending}
								onClick={handleResend}
							>
								{resending ? 'Sending…' : 'Resend confirmation'}
							</Button>
						</div>
					</div>
				</Card>
			</div>
		)
	}

	return (
		<div className="max-w-lg mx-auto">
			<Card title="Create your NIL Roster account">
				<p className="text-sm text-gray-300 mb-4" data-testid="signup-support-copy">
					Build your athlete identity, organize recruiting, and manage opportunities from one place.
				</p>
				<form className="space-y-4" data-testid="signup-form" onSubmit={handleSubmit}>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Display name</span>
						<Input
							data-testid="signup-display-name"
							type="text"
							name="name"
							autoComplete="name"
							value={displayName}
							onChange={e => setDisplayName(e.target.value)}
							placeholder="Your display name"
							disabled={loading}
							required
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Role</span>
						<Select
							data-testid="signup-role"
							name="role"
							value={role}
							onChange={e => setRole(e.target.value as Role)}
							disabled={loading}
						>
							<option value="athlete">Athlete</option>
							<option value="parent">Parent/Guardian</option>
							<option value="coach">Coach/AD/Agent</option>
						</Select>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Email</span>
						<Input
							data-testid="signup-email"
							type="email"
							name="email"
							autoComplete="email"
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder="you@example.com"
							disabled={loading}
							required
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Password</span>
						<div className="flex gap-2">
							<Input
								data-testid="signup-password"
								type={showPassword ? 'text' : 'password'}
								name="password"
								autoComplete="new-password"
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder="At least 8 characters"
							disabled={loading}
							required
						/>
							<button
								type="button"
								className="text-xs text-gray-300 hover:text-white px-2"
								onClick={() => setShowPassword(v => !v)}
								disabled={loading}
							>
								{showPassword ? 'Hide' : 'Show'}
							</button>
						</div>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Confirm password</span>
						<Input
							data-testid="signup-password-confirm"
							type={showPassword ? 'text' : 'password'}
							name="confirmPassword"
							autoComplete="new-password"
							value={confirmPassword}
							onChange={e => setConfirmPassword(e.target.value)}
							placeholder="••••••••"
							disabled={loading}
							required
						/>
					</label>
					<label className="inline-flex items-start gap-2 text-sm text-gray-300">
						<input
							data-testid="signup-terms"
							type="checkbox"
							checked={termsAccepted}
							onChange={e => setTermsAccepted(e.target.checked)}
							disabled={loading}
							className="mt-1"
						/>
						<span>
							I agree to the <a href="/terms" className="underline">Terms of Use</a> and{' '}
							<a href="/privacy" className="underline">Privacy Policy</a>.
						</span>
					</label>
					{err && (
						<div className="text-red-400 text-sm" data-testid="signup-error" aria-live="polite">
							{err}
						</div>
					)}
					<div className="pt-2">
						<Button
							type="submit"
							className="red-glow"
							data-testid="signup-submit"
							disabled={loading}
						>
							{loading ? <span data-testid="signup-loading">Creating…</span> : 'Create my NIL Roster account'}
						</Button>
					</div>
				</form>
				<div className="text-sm text-gray-300 mt-4 flex flex-wrap items-center gap-2">
					<span>Already have an account?</span>
					<button
						type="button"
						className="underline hover:text-white"
						data-testid="signup-login-link"
						onClick={() => navigate('/auth/login')}
					>
						Log in
					</button>
				</div>
			</Card>
		</div>
	)
}
