import { useMemo, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import Card from './ui/Card'
import Button from './ui/Button'
import { AthleteProfile } from '../types'
import { getPublicAvailabilityLabels } from '../lib/publicProfilePrivacy'

export default function PublicProfile({ athlete }: { athlete: AthleteProfile | null }) {
	const a = athlete
	if (!a) {
		return (
			<div className="text-slate-600">Create your profile first in the Athlete tab.</div>
		)
	}

	const profilePrintRef = useRef<HTMLDivElement>(null)
	const sportAndPositions = useMemo(() => {
		return a.sports.map(s => `${s.sportName}${s.positions?.length ? ' — ' + s.positions.join('/') : ''}`).join(' • ')
	}, [a.sports])
	const exportedOn = useMemo(() => new Date().toLocaleDateString(), [])
	const availabilityLabels = useMemo(() => getPublicAvailabilityLabels(a), [a])

	const handlePrint = useReactToPrint({
		contentRef: profilePrintRef,
		documentTitle: `${a.name} - Athlete Profile`
	})

	const hasAcademicPublic =
		Boolean(a.academicProfile?.schoolName || a.academicProfile?.level) ||
		(a.academicProfile?.academicInterests || []).length > 0 ||
		availabilityLabels.length > 0 ||
		Boolean(a.internationalFlag)

	const hasNilPublic =
		Boolean(a.nil?.schoolNILPolicyUrl) ||
		Boolean(a.nil?.associatedCollective?.name)

	return (
		<>
			<div className="mb-4 flex items-center gap-3 no-print">
				<Button onClick={handlePrint}>Export PDF</Button>
				<span className="text-sm text-slate-600">Opens print dialog. Choose ‘Save as PDF’ to download.</span>
			</div>

			<div ref={profilePrintRef} data-testid="public-profile">
				{/* Print-only header */}
				<div className="hidden print:block mb-4 text-black">
					<div className="text-2xl font-semibold">{a.name}</div>
					{sportAndPositions && <div className="text-base">{sportAndPositions}</div>}
					<div className="text-sm">Exported: {exportedOn}</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
			<Card title="Profile">
				<div className="space-y-2">
					<div className="headline text-2xl">{a.name}</div>
					<div className="text-slate-700">{a.sports.map(s => `${s.sportName}${s.positions?.length ? ' — ' + s.positions.join('/') : ''}`).join(' • ')}</div>
					<div className="text-slate-600">{a.school} • {a.level}</div>
					{a.location && <div className="text-slate-700">{a.location}</div>}
					{(a.socialHandles || []).length > 0 && (
						<div className="mt-2">
							<div className="text-slate-900 font-semibold mb-1">Social</div>
							<ul className="list-disc list-inside text-slate-700 text-sm leading-relaxed break-words">
								{a.socialHandles.map((s, i) => (
									<li key={`sh-${i}`}>{s.platform}: {s.handle} {s.url ? (<a className="underline" href={s.url} target="_blank" rel="noreferrer">link</a>) : null}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</Card>

			<Card title="Recruiting Snapshot">
				<div className="space-y-2 text-sm text-slate-700 leading-relaxed break-words">
					{(() => {
						const p = a.physicalAttributes
						if (!p && !a.sportMetrics && !a.gameFilm) return <div className="subtle text-sm">Add your recruiting profile in the Athlete tab.</div>
						const heightText = p?.heightInches ? `${Math.floor(p.heightInches/12)}'${p.heightInches%12}"` : undefined
						const weightText = p?.weightLbs ? `${p.weightLbs} lbs` : undefined
						return (
							<>
								{(heightText || weightText) && <div className="text-slate-900 font-semibold">Physical</div>}
								{(heightText || weightText || p?.wingspanInches || p?.dominantHand) && (
									<div className="text-black">
										{[heightText && `Height: ${heightText}`, weightText && `Weight: ${weightText}`, p?.wingspanInches && `Wingspan: ${p.wingspanInches}"`, p?.dominantHand && `Hand: ${p.dominantHand}`].filter(Boolean).join(' | ')}
									</div>
								)}
								{(a.sportMetrics || []).length > 0 && (
									<div>
										<div className="text-slate-900 font-semibold mt-2">Top Metrics</div>
										<ul className="list-disc list-inside text-black space-y-1.5">
											{(a.sportMetrics || []).slice(0, 5).map((m, i) => (
												<li key={`m-${i}`}>{[m.metricName, m.value].filter(Boolean).join(': ')}{m.position ? ` (${m.position})` : ''}</li>
											))}
										</ul>
									</div>
								)}
								{(a.gameFilm || []).length > 0 && (
									<div>
										<div className="text-slate-900 font-semibold mt-2">Game Film</div>
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
							<span key={`mi-${idx}`} className="inline-block px-3 py-1 rounded-md border border-border text-slate-800 bg-mid">{tag}</span>
						))}
					</div>
				)}
			</Card>

			<Card title="Brand & Story">
				{a.performanceStory ? (
					<div className="space-y-3 leading-relaxed break-words">
						{a.performanceStory.currentFocus && <div className="text-black text-sm whitespace-pre-wrap break-words leading-relaxed">Current focus: {a.performanceStory.currentFocus}</div>}
						{(a.performanceStory.keyMilestones || []).length > 0 && (
							<div className="text-slate-700 text-sm">
								<div className="text-slate-900 text-xs font-semibold mb-1">Key milestones</div>
								<ul className="list-disc list-inside leading-relaxed">
									{a.performanceStory.keyMilestones.map((m, i) => <li key={`km2-${i}`} className="break-words">{m}</li>)}
								</ul>
							</div>
						)}
						{(a.performanceStory.futureGoals || []).length > 0 && (
							<div className="text-slate-700 text-sm">
								<div className="text-slate-900 text-xs font-semibold mb-1">Future goals</div>
								<div className="whitespace-pre-wrap break-words leading-relaxed text-black">{(a.performanceStory.futureGoals || []).join(' • ')}</div>
							</div>
						)}
					</div>
				) : (
					<div className="subtle text-sm">Add a short story in your profile to help partners connect with your journey.</div>
				)}
			</Card>

			{/* Contacts, guardians, and private circle are intentionally omitted from the public/printable surface. */}

			<Card title="Academics & Availability">
				{!hasAcademicPublic ? (
					<div className="subtle text-sm">No academic or availability details yet.</div>
				) : (
					<div className="space-y-3 text-sm text-slate-700 leading-relaxed">
						{a.academicProfile && (a.academicProfile.schoolName || a.academicProfile.level || (a.academicProfile.academicInterests || []).length > 0) && (
							<div>
								<div className="text-slate-900 font-semibold">Academics</div>
								<div className="text-black">
									{[a.academicProfile.schoolName, a.academicProfile.level]
										.filter(Boolean).join(' • ')}
								</div>
								{(a.academicProfile.academicInterests || []).length > 0 && (
									<div className="text-black">Interests: {(a.academicProfile.academicInterests || []).join(' • ')}</div>
								)}
							</div>
						)}
						{availabilityLabels.length > 0 && (
							<div>
								<div className="text-slate-900 font-semibold">Availability</div>
								<ul className="list-disc list-inside text-black leading-relaxed">
									{availabilityLabels.map((label, i) => (
										<li key={`av-${i}`}>{label}</li>
									))}
								</ul>
							</div>
						)}
						{a.internationalFlag && <div className="text-amber-600">International student / work restrictions may apply</div>}
					</div>
				)}
			</Card>

			<Card title="Compliance & NIL">
				{!hasNilPublic ? (
					<div className="subtle text-sm">No public NIL policy links yet.</div>
				) : (
					<div className="space-y-2 text-sm text-slate-700 leading-relaxed">
						{a.nil?.schoolNILPolicyUrl && (
							<div>Policy: <a href={a.nil.schoolNILPolicyUrl} target="_blank" rel="noreferrer" className="underline">View school NIL policy</a></div>
						)}
						{a.nil?.associatedCollective?.name && (
							<div>
								<div className="text-slate-900 font-semibold">Collective</div>
								<div className="text-black">{a.nil.associatedCollective.name}</div>
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
					<div className="space-y-3 text-sm text-slate-700 leading-relaxed">
						{(a.mediaKit.heroImages || []).length > 0 && (
							<div>
								<div className="text-slate-900 font-semibold">Hero Images</div>
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
								<div className="text-slate-900 font-semibold">Logos</div>
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
										<span className="text-black">{c}</span>
									</span>
								))}
							</div>
						)}
						{(a.mediaKit.samplePosts || []).length > 0 && (
							<div>
								<div className="text-slate-900 font-semibold">Sample Posts</div>
								<ul className="list-disc list-inside leading-relaxed">
									{a.mediaKit.samplePosts.slice(0, 5).map((s, i) => <li key={`sp-${i}`} className="break-words">{s}</li>)}
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
					<ul className="space-y-2 text-sm text-slate-700 leading-relaxed">
						{(a.trainingLog.entries || []).slice(-5).reverse().map((e, i) => (
							<li key={`tl-${i}`} className="flex flex-wrap gap-2">
								<span className="text-slate-900">{e.date}</span>
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
			</div>
		</>
	)
}
