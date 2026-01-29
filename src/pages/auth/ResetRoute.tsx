import { useEffect, useState } from 'react'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { supabase } from '../../lib/supabaseClient'
import { navigate } from '../../routes/RootRouter'
import { PUBLIC_MODE } from '../../config/publicMode'
import PublicAuthDisabled from '../../components/auth/PublicAuthDisabled'

export default function ResetRoute() {
	// In public mode, auth is disabled
	if (PUBLIC_MODE) {
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
		async function check() {
			if (!supabase) {
				setHasSession(false)
				return
			}
			const { data } = await supabase.auth.getSession()
			if (!canceled) setHasSession(Boolean(data.session))
		}
		check()
		return () => { canceled = true }
	}, [])

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setErr(null)
		if (!supabase) {
			setErr('Cloud auth not configured')
			return
		}
		if (password.length < 8) {
			setErr('Password must be at least 8 characters')
			return
		}
		if (password !== confirm) {
			setErr('Passwords do not match')
			return
		}
		setLoading(true)
		const { error } = await supabase.auth.updateUser({ password })
		setLoading(false)
		if (error) {
			setErr(error.message)
			return
		}
		navigate('/app', true)
	}

	// If Supabase isn't configured, show a friendly unavailable message
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
				{hasSession === false && (
					<div className="text-sm text-gray-300 mb-4">
						This reset link is invalid or expired. Please request a new reset email.
					</div>
				)}
				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">New password</span>
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
						<span className="subtle text-sm">Confirm password</span>
						<Input
							type={showPassword ? 'text' : 'password'}
							value={confirm}
							onChange={e => setConfirm(e.target.value)}
							placeholder="••••••••"
						/>
					</label>
					{err && <div className="text-red-400 text-sm">{err}</div>}
					<div className="pt-2">
						<Button type="submit" className="red-glow" disabled={loading || hasSession === false}>
							{loading ? 'Saving…' : 'Save password'}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	)
}


