import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

type RoleChoice =
	| 'athlete_18_plus'
	| 'athlete_under_18'
	| 'parent_guardian'
	| 'agent_rep'
	| 'coach_staff'
	| 'business_brand'

const STORAGE_KEY_PREFIX = 'athleteLedger:onboarding:seen:'

export default function Onboarding() {
	const { user } = useAuth()
	const [role, setRole] = useState<RoleChoice | ''>('')
	const [ackGuardian, setAckGuardian] = useState(false)
	const [saving, setSaving] = useState(false)
	const [completed, setCompleted] = useState(false)

	useEffect(() => {
		if (!user) return
		const seen = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`)
		if (seen === '1') setCompleted(true)
	}, [user])

	async function saveRole() {
		if (!user) return
		if (!role) return
		if (role === 'athlete_under_18' && !ackGuardian) return
		setSaving(true)
		try {
			// Store in Supabase metadata when available
			if (supabase) {
				await supabase.auth.updateUser({
					data: {
						role,
						guardianRequired: role === 'athlete_under_18'
					}
				})
			}
			localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.id}`, '1')
			setCompleted(true)
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-6">
			<h1 className="text-3xl font-bold mb-2">Getting Started</h1>
			<p className="text-gray-300">Quick 2‑step checklist to set up your account.</p>

			<Card className="space-y-4">
				<div className="text-white font-semibold">Step 1: Select your role</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
					<label className="inline-flex items-center gap-2 text-sm text-gray-300">
						<input type="radio" name="role" checked={role === 'athlete_18_plus'} onChange={() => setRole('athlete_18_plus')} />
						<span>Athlete (18+)</span>
					</label>
					<label className="inline-flex items-center gap-2 text-sm text-gray-300">
						<input type="radio" name="role" checked={role === 'athlete_under_18'} onChange={() => setRole('athlete_under_18')} />
						<span>Athlete (Under 18)</span>
					</label>
					<label className="inline-flex items-center gap-2 text-sm text-gray-300">
						<input type="radio" name="role" checked={role === 'parent_guardian'} onChange={() => setRole('parent_guardian')} />
						<span>Parent/Guardian</span>
					</label>
					<label className="inline-flex items-center gap-2 text-sm text-gray-300">
						<input type="radio" name="role" checked={role === 'agent_rep'} onChange={() => setRole('agent_rep')} />
						<span>Agent/Rep</span>
					</label>
					<label className="inline-flex items-center gap-2 text-sm text-gray-300">
						<input type="radio" name="role" checked={role === 'coach_staff'} onChange={() => setRole('coach_staff')} />
						<span>Coach/Staff</span>
					</label>
					<label className="inline-flex items-center gap-2 text-sm text-gray-300">
						<input type="radio" name="role" checked={role === 'business_brand'} onChange={() => setRole('business_brand')} />
						<span>Business/Brand</span>
					</label>
				</div>
				{role === 'athlete_under_18' && (
					<div className="mt-2">
						<label className="inline-flex items-center gap-2 text-sm text-gray-300">
							<input type="checkbox" checked={ackGuardian} onChange={e => setAckGuardian(e.target.checked)} />
							<span>Parent/guardian will be involved in any agreements (required).</span>
						</label>
					</div>
				)}
				<div className="pt-2">
					<Button onClick={saveRole} disabled={saving || !role || (role === 'athlete_under_18' && !ackGuardian)} className="red-glow">
						{saving ? 'Saving…' : 'Save role'}
					</Button>
				</div>
			</Card>

			<Card className="space-y-2">
				<div className="text-white font-semibold">Step 2: Quickstart</div>
				<ol className="list-decimal pl-6 space-y-2 text-gray-300">
					<li>Complete your Athlete Snapshot (name, sports, film, “My Story”).</li>
					<li>Add your first NIL/Recruiting contact in your Decision Circle.</li>
				</ol>
				{completed && <div className="text-green-300 text-sm">Onboarding complete. You can revisit this anytime from Resources → Getting Started.</div>}
			</Card>
		</div>
	)
}


