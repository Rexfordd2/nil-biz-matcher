import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Card from '../ui/Card'
import type { CurrentUser } from '../../utils/auth'
import { supabase } from '../../lib/supabaseClient'
import { signUp } from '../../lib/authSupabase'
import { friendlyAuthErrorMessage } from '../../lib/supabaseErrors'

type Role = 'athlete' | 'parent' | 'coach'

type Props = {
	onSignedIn: (user: CurrentUser) => void
}

export default function SignUpSupabase({ onSignedIn }: Props) {
	if (!supabase) {
		return (
			<div className="max-w-lg mx-auto">
				<Card title="Cloud signup unavailable">
					<div className="text-sm text-gray-300">
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
	const [loading, setLoading] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setErr(null)
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
			// centralized in src/constants/legal.ts
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { TERMS_VERSION } = await import('../../constants/legal')
			const result = await signUp({
				email,
				password,
				fullName: displayName,
				metadata: {
					full_name: displayName,
					role,
					termsAcceptedAt: new Date().toISOString(),
					termsVersion: TERMS_VERSION
				}
			})
			if (result.error || !result.data) {
				const message = friendlyAuthErrorMessage(result.error, { context: 'signup' }) || "We couldn't create your account. Please try again shortly."
				setErr(message)
				return
			}
			const userId = result.data.id

			// Rely on DB trigger public.handle_new_user() to create profiles row.
			// Do not block signup success on client-side profiles writes.
			const current: CurrentUser = {
				id: userId,
				email: result.data.email || email,
				fullName: displayName || result.data.email || 'User',
				role,
				marketingConsent: false
			}
			onSignedIn(current)
		} catch (e: any) {
			const message = friendlyAuthErrorMessage(e, { context: 'signup' }) || "We couldn't create your account. Please try again shortly."
			setErr(message)
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="max-w-lg mx-auto">
			<Card title="Create your Athlete Ledger account">
				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Display name</span>
						<Input
							type="text"
							value={displayName}
							onChange={e => setDisplayName(e.target.value)}
							placeholder="Your display name"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Role</span>
						<Select
							value={role}
							onChange={e => setRole(e.target.value as Role)}
						>
							<option value="athlete">Athlete</option>
							<option value="parent">Parent/Guardian</option>
							<option value="coach">Coach/AD/Agent</option>
						</Select>
					</label>
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
						<div className="flex gap-2">
							<Input
								type={showPassword ? 'text' : 'password'}
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder="••••••••"
							/>
							<button type="button" className="text-xs text-gray-300 hover:text-white px-2" onClick={() => setShowPassword(v => !v)}>
								{showPassword ? 'Hide' : 'Show'}
							</button>
						</div>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Confirm Password</span>
						<Input
							type={showPassword ? 'text' : 'password'}
							value={confirmPassword}
							onChange={e => setConfirmPassword(e.target.value)}
							placeholder="••••••••"
						/>
					</label>
					<label className="inline-flex items-center gap-2 text-sm text-gray-300">
						<input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
						<span>
							I agree to the <a href="/terms" className="underline">Terms of Use</a> and <a href="/privacy" className="underline">Privacy Policy</a>.
						</span>
					</label>
					{err && <div className="text-red-400 text-sm">{err}</div>}
					<div className="pt-2">
						<Button type="submit" className="red-glow" disabled={loading}>{loading ? 'Creating…' : 'Create my Athlete Ledger account'}</Button>
					</div>
				</form>
				<div className="text-xs text-gray-400 mt-3">
					By using Athlete Ledger, you agree to our <a href="/terms" className="underline">Terms</a>.
				</div>
			</Card>
		</div>
	)
}


