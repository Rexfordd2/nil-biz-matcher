import { useMemo } from 'react'
import Card from './ui/Card'
import type { AthleteProfile } from '../types'
import { getProfileSuggestions } from '../suggestions/match'

export default function SuggestedPlays({ athlete, marketingConsent }: { athlete: AthleteProfile | null; marketingConsent?: boolean }) {
	const suggestions = useMemo(() => {
		if (!athlete) return []
		return getProfileSuggestions(athlete, { marketingConsent })
	}, [athlete, marketingConsent])

	return (
		<Card title="Suggested Plays for You">
			<div className="text-gray-400 text-sm mb-4">Based on your NIL Roster profile.</div>
			{suggestions.length === 0 ? (
				<div className="subtle">Complete more of your profile to see tailored NIL and recruiting ideas.</div>
			) : (
				<ul className="space-y-3">
					{suggestions.map(s => (
						<li key={s.id} className="bg-mid border border-border rounded-md p-3">
							<div className="text-white font-semibold">
								{s.type === 'local_brand_idea' && marketingConsent ? 'Potential deal idea: ' : ''}{s.title}
							</div>
							<div className="text-gray-300 text-sm mt-1">{s.description}</div>
						</li>
					))}
				</ul>
			)}
		</Card>
	)
}


