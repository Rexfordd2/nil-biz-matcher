import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Button from './ui/Button'
import { friendlyMessageForProfilesError } from '../lib/supabaseErrors'
import type { ProfileRow } from '../types'

type Props = {
	onEditProfile?: () => void
	onLogout?: () => void
}

export default function AppHome({ onEditProfile, onLogout }: Props) {
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [email, setEmail] = useState<string | null>(null)
	const [displayName, setDisplayName] = useState<string | null>(null)
	const [role, setRole] = useState<string | null>(null)

	useEffect(() => {
		if (!supabase) {
			setLoading(false)
			setError('Cloud sync not enabled — using local storage')
			return
		}
		let mounted = true
		;(async () => {
			setLoading(true)
			setError(null)
			const { data: userData, error: userErr } = await supabase.auth.getUser()
			if (userErr || !userData?.user) {
				if (!mounted) return
				setError(userErr?.message || 'Not authenticated')
				setLoading(false)
				return
			}
			const u = userData.user
			if (!mounted) return
			setEmail(u.email || null)

			const { data: profile, error: profErr } = await supabase
				.from('profiles')
				.select('display_name, role')
				.eq('id', u.id)
				.maybeSingle<ProfileRow>()

			if (!mounted) return
			if (profErr) {
				const friendly = friendlyMessageForProfilesError(profErr)
				setError(friendly ?? profErr.message)
			}

			// Type-safe normalizer: prefer profiles table, then auth user metadata, then email/null
			const normalizedDisplayName =
				profile?.display_name ?? (u.user_metadata as any)?.full_name ?? (u.email || null)
			const normalizedRole = profile?.role ?? (u.user_metadata as any)?.role ?? null

			setDisplayName(normalizedDisplayName)
			setRole(normalizedRole)
			setLoading(false)
		})()
		return () => {
			mounted = false
		}
	}, [])

	async function handleLogout() {
		try {
			await supabase?.auth.signOut()
		} catch {}
		onLogout?.()
	}

	return (
		<div style={{ maxWidth: 900, margin: '40px auto' }}>
			<h1 style={{ fontSize: 30, fontWeight: 800 }}>Athlete Ledger</h1>
			{loading ? (
				<p style={{ color: '#6B7280' }}>Loading…</p>
			) : error ? (
				<p style={{ color: '#B23A3A' }}>{error}</p>
			) : (
				<>
					<p style={{ color: '#6B7280' }}>
						Logged in as <b>{displayName ?? email}</b>
						{role ? ` (${role})` : null}
					</p>
					<div style={{ marginTop: 18, display: 'flex', gap: 12 }}>
						<Button onClick={() => onEditProfile?.()}>Edit Profile</Button>
						<Button variant="ghost" onClick={handleLogout}>Logout</Button>
					</div>
				</>
			)}
		</div>
	)
}


