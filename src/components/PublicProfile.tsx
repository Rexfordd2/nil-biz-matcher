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

			<Card title="Recruiting Snapshot">
				<div className="space-y-2 text-sm text-gray-200">
					{(() => {
						const p = a.physicalAttributes
						if (!p && !a.sportMetrics && !a.gameFilm) return <div className="subtle text-sm">Add your recruiting profile in the Athlete tab.</div>
						const heightText = p?.heightInches ? `${Math.floor(p.heightInches/12)}'${p.heightInches%12}"` : undefined
						const weightText = p?.weightLbs ? `${p.weightLbs} lbs` : undefined
						return (
							<>
								{(heightText || weightText) && <div className="text-white font-semibold">Physical</div>}
								{(heightText || weightText || p?.wingspanInches || p?.dominantHand) && (
									<div className="text-gray-300">
										{[heightText && `Height: ${heightText}`, weightText && `Weight: ${weightText}`, p?.wingspanInches && `Wingspan: ${p.wingspanInches}"`, p?.dominantHand && `Hand: ${p.dominantHand}`].filter(Boolean).join(' | ')}
									</div>
								)}
								{(a.sportMetrics || []).length > 0 && (
									<div>
										<div className="text-white font-semibold mt-2">Top Metrics</div>
										<ul className="list-disc list-inside text-gray-200">
											{(a.sportMetrics || []).slice(0, 5).map((m, i) => (
												<li key={`m-${i}`}>{[m.metricName, m.value].filter(Boolean).join(': ')}{m.position ? ` (${m.position})` : ''}</li>
											))}
										</ul>
									</div>
								)}
								{(a.gameFilm || []).length > 0 && (
									<div>
										<div className="text-white font-semibold mt-2">Game Film</div>
										<div className="flex flex-wrap gap-2">
											{(a.gameFilm || []).slice(0, 5).map((g, i) => (
												<a key={`gf-${i}`} href={g.url} target="_blank" rel="noreferrer" className="inline-block px-3 py-1 rounded-md border border-border bg-mid hover:bg-mid/80">{g.label || g.platform}</a>
											))}
										</div>
									</div>
								)}
							</>
						)
					})()}
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
						{(a.performanceStory.futureGoals || []).length > 0 && (
							<div className="text-gray-300 text-sm">
								<div className="subtle text-xs mb-1">Future goals</div>
								<div>{(a.performanceStory.futureGoals || []).join(' • ')}</div>
							</div>
						)}
					</div>
				) : (
					<div className="subtle text-sm">Add a short story in your profile to help partners connect with your journey.</div>
				)}
			</Card>

			<Card title="Contacts & Decision Circle">
				{(!(a.supportTeam && a.supportTeam.length) && !(a.trustedCircle && a.trustedCircle.length)) ? (
					<div className="subtle text-sm">No support contacts listed yet.</div>
				) : (
					<div className="space-y-3 text-sm text-gray-200">
						{(a.supportTeam || []).length > 0 && (
							<div>
								<div className="text-white font-semibold">Support Team</div>
								<ul className="list-disc list-inside">
									{(a.supportTeam || []).map((s, i) => (
										<li key={`sup-${i}`}>{s.role.replaceAll('_',' ')} — {s.name}{s.organization ? ` (${s.organization})` : ''}</li>
									))}
								</ul>
							</div>
						)}
						{(a.trustedCircle || []).length > 0 && (
							<div>
								<div className="text-white font-semibold">Decision Circle</div>
								<ul className="list-disc list-inside">
									{(a.trustedCircle || []).map((t, i) => (
										<li key={`tc-${i}`}>{t.role.replaceAll('_',' ')} — {t.name}{t.relationship ? ` (${t.relationship})` : ''}</li>
									))}
								</ul>
							</div>
						)}
					</div>
				)}
			</Card>

			<Card title="Academics & Availability">
				{!a.academicProfile && !a.availability && !a.internationalFlag ? (
					<div className="subtle text-sm">No academic or availability details yet.</div>
				) : (
					<div className="space-y-3 text-sm text-gray-200">
						{a.academicProfile && (
							<div>
								<div className="text-white font-semibold">Academics</div>
								<div className="text-gray-300">
									{[a.academicProfile.schoolName, a.academicProfile.level, a.academicProfile.gpaRange && `GPA: ${a.academicProfile.gpaRange.replaceAll('_','.')}`]
										.filter(Boolean).join(' • ')}
								</div>
								{(a.academicProfile.academicInterests || []).length > 0 && (
									<div className="text-gray-300">Interests: {(a.academicProfile.academicInterests || []).join(' • ')}</div>
								)}
							</div>
						)}
						{(a.availability || []).length > 0 && (
							<div>
								<div className="text-white font-semibold">Availability</div>
								<ul className="list-disc list-inside text-gray-300">
									{(a.availability || []).map((w, i) => (
										<li key={`av-${i}`}>{[w.label, (w.days || []).join('/'), w.timeRange].filter(Boolean).join(' — ')}</li>
									))}
								</ul>
							</div>
						)}
						{a.internationalFlag && <div className="text-amber-300">International student / work restrictions may apply</div>}
					</div>
				)}
			</Card>

			<Card title="Compliance & NIL">
				{!a.nil ? (
					<div className="subtle text-sm">No NIL compliance info yet.</div>
				) : (
					<div className="space-y-2 text-sm text-gray-200">
						{a.nil?.complianceContactEmail && <div>Compliance: <span className="text-white">{a.nil.complianceContactEmail}</span></div>}
						{a.nil?.schoolNILPolicyUrl && (
							<div>Policy: <a href={a.nil.schoolNILPolicyUrl} target="_blank" rel="noreferrer" className="underline">View school NIL policy</a></div>
						)}
						{a.nil?.associatedCollective && (
							<div>
								<div className="text-white font-semibold">Collective</div>
								<div className="text-gray-300">
									{a.nil.associatedCollective.name}
									{a.nil.associatedCollective.contactName ? ` — ${a.nil.associatedCollective.contactName}` : ''}
									{a.nil.associatedCollective.contactEmail ? ` (${a.nil.associatedCollective.contactEmail})` : ''}
								</div>
								{a.nil.associatedCollective.notes && <div className="text-gray-400">{a.nil.associatedCollective.notes}</div>}
							</div>
						)}
					</div>
				)}
			</Card>

			<Card title="Media Kit">
				{!a.mediaKit || (
					(a.mediaKit.heroImages.length === 0 &&
					 a.mediaKit.logos.length === 0 &&
					 a.mediaKit.brandColors.length === 0 &&
					 (a.mediaKit.samplePosts || []).length === 0 &&
					 !a.mediaKit.externalDeckUrl)
				) ? (
					<div className="subtle text-sm">No media kit yet.</div>
				) : (
					<div className="space-y-3 text-sm text-gray-200">
						{(a.mediaKit.heroImages || []).length > 0 && (
							<div>
								<div className="text-white font-semibold">Hero Images</div>
								<div className="grid grid-cols-3 gap-2">
									{a.mediaKit.heroImages.slice(0, 6).map((src, i) => (
										<div key={`ph-${i}`} className="w-full h-20 rounded-md overflow-hidden border border-border bg-surface">
											<img src={src} alt="" className="w-full h-full object-cover" />
										</div>
									))}
								</div>
							</div>
						)}
						{(a.mediaKit.logos || []).length > 0 && (
							<div>
								<div className="text-white font-semibold">Logos</div>
								<div className="flex flex-wrap gap-2">
									{a.mediaKit.logos.slice(0, 8).map((src, i) => (
										<div key={`pl-${i}`} className="w-12 h-12 rounded-md overflow-hidden border border-border bg-surface flex items-center justify-center">
											<img src={src} alt="" className="w-full h-full object-contain p-1" />
										</div>
									))}
								</div>
							</div>
						)}
						{(a.mediaKit.brandColors || []).length > 0 && (
							<div className="flex flex-wrap gap-2">
								{a.mediaKit.brandColors.slice(0, 10).map((c, i) => (
									<span key={`pc-${i}`} className="inline-flex items-center gap-2">
										<span className="inline-block w-5 h-5 rounded border border-border" style={{ background: c }} />
										<span className="text-gray-300">{c}</span>
									</span>
								))}
							</div>
						)}
						{(a.mediaKit.samplePosts || []).length > 0 && (
							<div>
								<div className="text-white font-semibold">Sample Posts</div>
								<ul className="list-disc list-inside">
									{a.mediaKit.samplePosts.slice(0, 5).map((s, i) => <li key={`sp-${i}`}>{s}</li>)}
								</ul>
							</div>
						)}
						{a.mediaKit.externalDeckUrl && (
							<div>
								<a href={a.mediaKit.externalDeckUrl} target="_blank" rel="noreferrer" className="underline">View external deck</a>
							</div>
						)}
					</div>
				)}
			</Card>

			<Card title="Training Log (recent)">
				{!(a.trainingLog && (a.trainingLog.entries || []).length) ? (
					<div className="subtle text-sm">No training entries recorded.</div>
				) : (
					<ul className="space-y-2 text-sm text-gray-200">
						{(a.trainingLog.entries || []).slice(-5).reverse().map((e, i) => (
							<li key={`tl-${i}`} className="flex flex-wrap gap-2">
								<span className="text-white">{e.date}</span>
								<span>• {e.type}</span>
								{e.description && <span>• {e.description}</span>}
								{typeof e.durationMinutes === 'number' && <span>• {e.durationMinutes} min</span>}
								{e.perceivedIntensity && <span>• {e.perceivedIntensity}</span>}
							</li>
						))}
					</ul>
				)}
			</Card>
		</div>
	)
}



