import { useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import type { CurrentUser } from '../../utils/auth'
import { supabase } from '../../lib/supabaseClient'
import { signUp } from '../../lib/authSupabase'

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
	const sb = supabase!
	const [displayName, setDisplayName] = useState('')
	const [role, setRole] = useState<Role>('athlete')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [err, setErr] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setErr(null)
		setLoading(true)

		const result = await signUp({ email, password, fullName: displayName })
		if (result.error || !result.data) {
			setLoading(false)
			setErr(result.error ?? 'Signup failed')
			return
		}
		const userId = result.data.id
		// Ensure a profiles row exists with minimal fields for app usage
		const { error: profileErr } = await sb
			.from('profiles')
			.upsert({ id: userId, full_name: displayName, phone: null, profile: {} }, { onConflict: 'id' })

		setLoading(false)
		if (profileErr) {
			setErr(profileErr.message)
			return
		}

		const current: CurrentUser = {
			id: userId,
			email: result.data.email || email,
			fullName: displayName || result.data.email || 'User',
			role,
			marketingConsent: false
		}
		onSignedIn(current)
	}

	return (
		<div className="max-w-lg mx-auto">
			<Card title="Create your Athlete Ledger account">
				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Display name</span>
						<input
							type="text"
							value={displayName}
							onChange={e => setDisplayName(e.target.value)}
							placeholder="Your display name"
							className="bg-mid border border-border rounded-md px-3 py-2 text-white"
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="subtle text-sm">Role</span>
						<select
							value={role}
							onChange={e => setRole(e.target.value as Role)}
							className="bg-mid border border-border rounded-md px-3 py-2 text-white"
						>
							<option value="athlete">Athlete</option>
							<option value="parent">Parent/Guardian</option>
							<option value="coach">Coach/AD/Agent</option>
						</select>
					</label>
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
					<div className="pt-2">
						<Button type="submit" className="red-glow" disabled={loading}>{loading ? 'Creating…' : 'Create my Athlete Ledger account'}</Button>
					</div>
				</form>
			</Card>
		</div>
	)
}


