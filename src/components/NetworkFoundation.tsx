import Button from './ui/Button'
import type { AthleteProfile } from '../types'

type Props = {
	athlete: AthleteProfile | null
	onEditPassport: () => void
	onReturnToday: () => void
}

/**
 * Network foundation screen (PR-2).
 * Reads only in-memory athlete profile counts. Does not render contact PII.
 */
export default function NetworkFoundation({ athlete, onEditPassport, onReturnToday }: Props) {
	const supportTeamCount = athlete?.supportTeam?.length ?? 0
	const trustedCircleCount = athlete?.trustedCircle?.length ?? 0

	return (
		<div className="space-y-6" data-testid="network-foundation">
			<div className="card p-6 space-y-4">
				<h2 className="headline text-2xl">Your Network</h2>
				<p className="text-gray-200">
					Your coaches, mentors, family support, advisors, business contacts, and collaborators
					should grow with you throughout your athletic journey.
				</p>
				<p className="text-gray-300 text-sm" data-testid="network-foundation-disclosure">
					Your support team and trusted circle are currently managed inside Athlete Passport.
					A dedicated relationship CRM will be built in the next phase.
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
					<div className="bg-mid border border-border rounded-md p-3">
						<div className="text-gray-400 text-xs">Support team (count)</div>
						<div className="text-white text-lg font-bold" data-testid="network-support-count">
							{supportTeamCount}
						</div>
					</div>
					<div className="bg-mid border border-border rounded-md p-3">
						<div className="text-gray-400 text-xs">Trusted circle (count)</div>
						<div className="text-white text-lg font-bold" data-testid="network-trusted-count">
							{trustedCircleCount}
						</div>
					</div>
				</div>
				<p className="text-xs text-gray-400">
					Contact names, emails, phone numbers, and private notes are not shown here.
				</p>
				<div className="flex flex-wrap gap-3 pt-2">
					<Button onClick={onEditPassport} className="red-glow" data-testid="network-edit-passport">
						Edit Athlete Passport
					</Button>
					<Button onClick={onReturnToday} variant="secondary" data-testid="network-return-today">
						Return to Today
					</Button>
				</div>
			</div>
		</div>
	)
}
