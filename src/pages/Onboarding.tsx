import { useEffect, useMemo, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { navigate } from '../routes/RootRouter'
import { goToLogin } from '../lib/auth/navigation'
import { hasCompletedOnboarding, markOnboardingComplete } from '../lib/auth/onboardingState'

type RoleChoice =
	| 'athlete_18_plus'
	| 'athlete_under_18'
	| 'parent_guardian'
	| 'agent_rep'
	| 'coach_staff'
	| 'business_brand'

function mapSignupRoleToChoice(role: string | undefined): RoleChoice | '' {
	const r = String(role || '').toLowerCase()
	if (r === 'parent' || r === 'parent_guardian') return 'parent_guardian'
	if (r === 'coach' || r === 'coach_staff' || r === 'agent' || r === 'agent_rep') return 'coach_staff'
	if (r === 'athlete' || r === 'athlete_18_plus') return 'athlete_18_plus'
	if (r === 'athlete_under_18') return 'athlete_under_18'
	if (r === 'business_brand' || r === 'business') return 'business_brand'
	return ''
}

function isAthleteRole(role: RoleChoice | ''): boolean {
	return role === 'athlete_18_plus' || role === 'athlete_under_18'
}

export default function Onboarding() {
	const { user, initializing } = useAuth()
	const [role, setRole] = useState<RoleChoice | ''>('')
	const [ackGuardian, setAckGuardian] = useState(false)
	const [saving, setSaving] = useState(false)
	const [completed, setCompleted] = useState(false)

	const returnTo = useMemo(() => {
		const sp = new URLSearchParams(window.location.search)
		return sp.get('returnTo') || '/app/today'
	}, [])

	useEffect(() => {
		if (!user) return
		if (hasCompletedOnboarding(user.id)) {
			setCompleted(true)
			return
		}
		const fromSignup = mapSignupRoleToChoice(user.role)
		if (fromSignup) setRole(fromSignup)
	}, [user])

	async function saveRole() {
		if (!user) return
		if (!role) return
		if (role === 'athlete_under_18' && !ackGuardian) return
		setSaving(true)
		try {
			if (supabase) {
				await supabase.auth.updateUser({
					data: {
						// Display/product role only — not an authorization claim.
						role,
						onboardingRole: role,
						guardianRequired: role === 'athlete_under_18',
						onboardingCompletedAt: new Date().toISOString(),
					},
				})
			}
			markOnboardingComplete(user.id)
			setCompleted(true)
		} finally {
			setSaving(false)
		}
	}

	function continueToApp() {
		navigate(returnTo, true)
	}

	if (initializing) {
		return (
			<div className="mx-auto max-w-3xl px-4 md:px-6 py-10">
				<p className="text-gray-300" data-testid="onboarding-loading">Loading your account…</p>
			</div>
		)
	}

	if (!user) {
		return (
			<div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-4">
				<h1 className="text-3xl font-bold">Getting Started</h1>
				<p className="text-gray-300">Sign in to finish setting up your NIL Roster account.</p>
				<Button data-testid="onboarding-go-login" className="red-glow" onClick={() => goToLogin('/onboarding')}>
					Log in
				</Button>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-6" data-testid="onboarding-page">
			<h1 className="text-3xl font-bold mb-2">Getting Started</h1>
			<p className="text-gray-300">Quick setup so your account opens into a useful starting place.</p>

			<Card className="space-y-4">
				<div className="text-white font-semibold">Step 1: Confirm your role</div>
				<p className="text-xs text-gray-400">
					Roles help personalize the product. They do not grant admin or elevated permissions.
				</p>
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
					<Button
						data-testid="onboarding-save-role"
						onClick={saveRole}
						disabled={saving || !role || (role === 'athlete_under_18' && !ackGuardian)}
						className="red-glow"
					>
						{saving ? 'Saving…' : 'Save and continue'}
					</Button>
				</div>
			</Card>

			<Card className="space-y-3" data-testid="onboarding-next-steps">
				<div className="text-white font-semibold">Step 2: What to do next</div>
				{isAthleteRole(role) || !role ? (
					<ol className="list-decimal pl-6 space-y-2 text-gray-300">
						<li>Open Athlete Passport and add a short starter profile (name, sport, story).</li>
						<li>Visit Today for your next recommended action.</li>
					</ol>
				) : role === 'parent_guardian' ? (
					<div className="space-y-2 text-gray-300 text-sm">
						<p>
							Your parent/guardian account is ready. Athlete association and shared management tools will guide you
							from Today — we do not invent an athlete identity for you.
						</p>
						<p>Next: open Today, then use Network when you are ready to connect with an athlete.</p>
					</div>
				) : (
					<div className="space-y-2 text-gray-300 text-sm">
						<p>
							Your coach/agent account is ready for organizing recruiting and opportunity workflows. Selecting this
							role does not grant elevated admin access.
						</p>
						<p>Next: open Today, then Recruiting Board or Opportunities as needed.</p>
					</div>
				)}
				{completed && (
					<div className="space-y-3">
						<div className="text-green-300 text-sm" data-testid="onboarding-complete">
							Onboarding complete. Continue into NIL Roster.
						</div>
						<Button data-testid="onboarding-go-app" className="red-glow" onClick={continueToApp}>
							Go to Today
						</Button>
					</div>
				)}
			</Card>
		</div>
	)
}
