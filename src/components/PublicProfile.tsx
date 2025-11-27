import Card from './ui/Card'
import { AthleteProfile } from '../types'

export default function PublicProfile({ athlete }: { athlete: AthleteProfile | null }) {
	const a = athlete
	if (!a) {
		return (
			<div className="text-gray-400">Create your profile first in the Athlete tab.</div>
		)
	}
	return (
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
			<Card title="Profile">
				<div className="space-y-2">
					<div className="headline text-2xl">{a.name}</div>
					<div className="text-gray-300">{a.sports.map(s => `${s.sportName}${s.positions?.length ? ' — ' + s.positions.join('/') : ''}`).join(' • ')}</div>
					<div className="text-gray-400">{a.school} • {a.level}</div>
					{a.location && <div className="text-gray-300">{a.location}</div>}
					{(a.socialHandles || []).length > 0 && (
						<div className="mt-2">
							<div className="text-white font-semibold mb-1">Social</div>
							<ul className="list-disc list-inside text-gray-200 text-sm">
								{a.socialHandles.map((s, i) => (
									<li key={`sh-${i}`}>{s.platform}: {s.handle} {s.url ? (<a className="underline" href={s.url} target="_blank" rel="noreferrer">link</a>) : null}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</Card>

			<Card title="What I’m looking for right now">
				{(a.monetizationInterests || []).length === 0 ? (
					<div className="subtle text-sm">No preferences listed yet.</div>
				) : (
					<div className="flex flex-wrap gap-2">
						{(a.monetizationInterests || []).map((tag, idx) => (
							<span key={`mi-${idx}`} className="inline-block px-3 py-1 rounded-md border border-border text-gray-200 bg-mid">{tag}</span>
						))}
					</div>
				)}
			</Card>

			<Card title="Brand & Story">
				{a.performanceStory ? (
					<div className="space-y-3">
						{a.performanceStory.currentFocus && <div className="text-gray-200 text-sm">Current focus: {a.performanceStory.currentFocus}</div>}
						{(a.performanceStory.keyMilestones || []).length > 0 && (
							<div className="text-gray-300 text-sm">
								<div className="subtle text-xs mb-1">Key milestones</div>
								<ul className="list-disc list-inside">
									{a.performanceStory.keyMilestones.map((m, i) => <li key={`km2-${i}`}>{m}</li>)}
								</ul>
							</div>
						)}
					</div>
				) : (
					<div className="subtle text-sm">Add a short story in your profile to help partners connect with your journey.</div>
				)}
			</Card>
		</div>
	)
}



