import Card from './ui/Card'
import { Business } from '../types'
import { LevelBadge } from './ui/Badge'

export default function BusinessAnalysisCard({ business }: { business: Business }) {
	const a = business.analysis
	if (!a) return null
	return (
		<Card title={business.name} className="fade-in">
			<div className="flex items-center gap-2 mb-3">
				<LevelBadge level={a.levelGuess} />
				<span className="subtle">{business.location}</span>
			</div>
			<p className="text-gray-200 mb-3">{business.description}</p>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<div className="subtle text-xs mb-1">History & Roots</div>
					<div className="text-white">{a.history}</div>
				</div>
				<div>
					<div className="subtle text-xs mb-1">Intent & Mission</div>
					<div className="text-white">{a.intentMission}</div>
				</div>
				<div>
					<div className="subtle text-xs mb-1">Main Goals</div>
					<div className="text-white">{a.mainGoals.join(' • ')}</div>
				</div>
				<div>
					<div className="subtle text-xs mb-1">Marketing Needs</div>
					<div className="text-white">{a.marketingNeeds.join(' • ')}</div>
				</div>
			</div>
		</Card>
	)
}


