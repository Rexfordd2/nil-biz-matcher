import { useEffect, useMemo, useState } from 'react'
import AthleteProfileForm from './components/AthleteProfileForm'
import BusinessForm from './components/BusinessForm'
import BusinessAnalysisCard from './components/BusinessAnalysisCard'
import Dashboard from './components/Dashboard'
import Outreach from './components/Outreach'
import NILHub from './components/NILHub'
import VendorDirectory from './components/VendorDirectory'
import Deals from './components/Deals'
import { ToastProvider, useToast } from './components/ui/Toast'
import { AthleteProfile, Business } from './types'
import { load, save } from './utils/storage'
import { evaluateMatch } from './utils/matching'
import Button from './components/ui/Button'
import { FitBadge, LevelBadge } from './components/ui/Badge'
import { migrateAthleteProfile } from './utils/migrations'
import { buildConversationScript } from './utils/conversation'
import Discover from './components/Discover'
import PublicProfile from './components/PublicProfile'
import OpportunityBoard from './components/OpportunityBoard'
import EventsPlanner from './components/EventsPlanner'
import Welcome from './components/Welcome'
import Resources from './components/Resources'
import Guidelines from './components/Guidelines'

type Tab = 'Welcome' | 'Athlete' | 'Businesses' | 'Discover' | 'Matches' | 'Deals' | 'Opportunities' | 'Events' | 'Dashboard' | 'Profile Preview' | 'Resources' | 'Guidelines' | 'NIL Hub' | 'Vendor Directory'

export default function App() {
	const [tab, setTab] = useState<Tab>('Welcome')
	const [athlete, setAthlete] = useState<AthleteProfile | null>(() => migrateAthleteProfile(load('athlete', null)))
	const [businesses, setBusinesses] = useState<Business[]>(() => load('businesses', []))
	const [selectedBizId, setSelectedBizId] = useState<string | null>(null)
	const { show } = useToast()

	useEffect(() => save('athlete', athlete), [athlete])
	useEffect(() => save('businesses', businesses), [businesses])

	const selectedBiz = useMemo(() => businesses.find(b => b.id === selectedBizId) || null, [selectedBizId, businesses])

	function upsertBusiness(next: Business) {
		setBusinesses(prev => {
			const idx = prev.findIndex(b => b.id === next.id)
			if (idx === -1) return [next, ...prev]
			const copy = [...prev]
			copy[idx] = next
			return copy
		})
	}

	function addBusiness(b: Business) {
		upsertBusiness(b)
		setTab('Businesses')
	}

	function runMatches() {
		if (!athlete) return
		setBusinesses(prev =>
			prev.map(b => ({
				...b,
				match: evaluateMatch(athlete, b),
				level: b.level || b.analysis?.levelGuess
			}))
		)
		setTab('Matches')
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(() => show('Copied to clipboard'))
	}

	return (
		<ToastProvider>
			<div className="min-h-screen bg-background">
				<header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
					<div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded-lg bg-brand-red shadow-glow overflow-hidden">
								<img
									src="/monster-logo.png"
									alt="Monster Collective Logo"
									className="w-full h-full object-cover"
									onError={(e) => {
										// Hide the broken image icon, keep red background as fallback
										;(e.currentTarget as HTMLImageElement).style.display = 'none'
									}}
								/>
							</div>
							<h1 className="headline text-2xl">Monster Collective</h1>
						</div>
						<nav className="flex gap-2">
							{(['Welcome','Athlete','Businesses','Discover','Matches','Deals','Opportunities','Events','Dashboard','Profile Preview','Resources','Guidelines','NIL Hub','Vendor Directory'] as Tab[]).map(t => (
								<button
									key={t}
									onClick={() => setTab(t)}
									className={`px-3 py-2 rounded-md text-sm ${tab === t ? 'bg-mid text-white' : 'text-gray-300 hover:bg-mid'}`}
								>
									{t}
								</button>
							))}
						</nav>
					</div>
				</header>
				<main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
					{tab === 'Welcome' && (
						<Welcome
							onStartProfile={() => setTab('Athlete')}
							onGoResources={() => setTab('Resources')}
							onGoGuidelines={() => setTab('Guidelines')}
						/>
					)}
					{tab === 'Athlete' && (
						<>
							<AthleteProfileForm value={athlete ?? undefined} onSave={setAthlete} />
							<div className="flex justify-end">
								<Button onClick={runMatches} className="red-glow">Evaluate Matches</Button>
							</div>
						</>
					)}

					{tab === 'Businesses' && (
						<>
							<BusinessForm onAdd={addBusiness} />
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
								{businesses.map(b => (
									<div key={b.id} className="space-y-3">
										<BusinessAnalysisCard business={b} />
										<div className="flex items-center gap-2">
											{b.match && <FitBadge rating={b.match.rating} />}
											{(b.level || b.analysis?.levelGuess) && <LevelBadge level={b.level || b.analysis!.levelGuess} />}
											<Button variant="ghost" onClick={() => { setSelectedBizId(b.id); setTab('Matches') }}>View Match</Button>
										</div>
									</div>
								))}
							</div>
						</>
					)}

					{tab === 'Discover' && (
						<Discover />
					)}

					{tab === 'Matches' && (
						<>
							<div className="flex items-center justify-between">
								<h2 className="headline text-xl">Best Matches for You</h2>
								<Button onClick={runMatches} variant="ghost">Re-run</Button>
							</div>
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
								{businesses.map(b => {
									const m = b.match
									if (!m) return null
									const active = selectedBizId === null || selectedBizId === b.id
									return (
										<section key={b.id} className={`card p-5 ${active ? 'fade-in' : 'opacity-60'}`}>
											<header className="flex items-center justify-between mb-4">
												<div>
													<div className="text-white font-semibold text-lg">{b.name}</div>
													<div className="text-gray-400">{b.location}</div>
												</div>
												<div className="flex items-center gap-2">
													<FitBadge rating={m.rating} />
													<LevelBadge level={m.recommendedLevels[m.recommendedLevels.length - 1]} />
												</div>
											</header>
											<div className="grid grid-cols-3 gap-3 text-center">
												<Score label="Brand" value={m.brandAlignment} />
												<Score label="Audience" value={m.audienceOverlap} />
												<Score label="Integration" value={m.practicalIntegration} />
											</div>
											<p className="text-gray-200 mt-4">{m.explanation}</p>

											{m.opportunityCost && (
												<div className="mt-4 bg-mid border border-border rounded-lg p-4">
													<div className="text-white font-semibold mb-2">Estimated Opportunity Cost</div>
													<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
														<div className="bg-dark border border-border rounded-md p-3">
															<div className="text-gray-400 text-xs">Estimated time per week</div>
															<div className="text-white text-lg font-bold">{m.opportunityCost.timePerWeekHours} hrs</div>
														</div>
														<div className="bg-dark border border-border rounded-md p-3">
															<div className="text-gray-400 text-xs">Estimated duration</div>
															<div className="text-white text-lg font-bold">{m.opportunityCost.durationWeeks} weeks</div>
														</div>
														<div className="bg-dark border border-border rounded-md p-3">
															<div className="text-gray-400 text-xs">Opportunity cost</div>
															<div className={`text-lg font-bold ${m.opportunityCost.level === 'HIGH' ? 'text-red-400' : m.opportunityCost.level === 'MEDIUM' ? 'text-amber-300' : 'text-green-300'}`}>
																{m.opportunityCost.level}
															</div>
														</div>
													</div>
													<p className="text-gray-200 text-sm mt-3">{m.opportunityCost.explanation}</p>
													<p className="text-xs text-gray-400 mt-2">
														This is not financial advice. It’s a planning tool to help you think about time and focus.
													</p>
												</div>
											)}

										{m.strategy && (
											<div className="mt-4 bg-mid border border-border rounded-lg p-4">
												<div className="flex items-center justify-between mb-2">
													<div className="text-white font-semibold">Strategy / Playbook</div>
													<div className="text-xs text-gray-400">Ethical, school-friendly, NIL-aware</div>
												</div>
												<p className="text-gray-200 text-sm">{m.strategy.overview}</p>
												<p className="text-gray-300 text-sm mt-2">{m.strategy.positioning}</p>
												<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
													{m.strategy.ideas.map((idea, idx) => (
														<div key={`idea-${idx}`} className="bg-dark border border-border rounded-lg p-4">
															<div className="text-white font-semibold mb-1">{idea.title}</div>
															<p className="text-gray-200 text-sm">{idea.description}</p>
															<div className="mt-2 flex flex-wrap gap-2">
																{idea.suggestedCompensations.map((c, ci) => (
																	<span key={`comp-${idx}-${ci}`} className="inline-block bg-mid border border-border rounded-md px-2 py-1 text-xs text-gray-200">
																		{c.replace(/_/g, ' ')}
																	</span>
																))}
															</div>
														</div>
													))}
												</div>
											</div>
										)}

											{athlete && (
												<div className="mt-4 bg-mid border border-border rounded-lg p-4">
													<div className="flex items-center justify-between mb-2">
														<div className="text-white font-semibold">Conversation</div>
														<div className="text-xs text-gray-400">Respectful, non-pushy, teen/parent safe</div>
													</div>
													{(() => {
														const conv = buildConversationScript({
															athleteProfile: athlete,
															business: b,
															fit: m.rating,
															strategy: m.strategy
														})
														return (
															<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
																<div className="bg-dark border border-border rounded-md p-3">
																	<details>
																		<summary className="cursor-pointer text-white font-semibold flex items-center justify-between">
																			<span>Phone script</span>
																			<Button variant="ghost" onClick={(e) => { e.preventDefault(); copyToClipboard(conv.phoneScript) }}>Copy</Button>
																		</summary>
																		<pre className="mt-3 bg-mid border border-border rounded-md p-3 whitespace-pre-wrap text-gray-100 text-sm">{conv.phoneScript}</pre>
																	</details>
																</div>
																<div className="bg-dark border border-border rounded-md p-3">
																	<div className="text-white font-semibold mb-2">In-person talking points</div>
																	<ul className="list-disc pl-6 space-y-2 text-gray-200 text-sm">
																		{conv.inPersonOutline.map((line, idx) => (
																			<li key={`conv-${b.id}-step-${idx}`}>{line}</li>
																		))}
																	</ul>
																</div>
															</div>
														)
													})()}
													<p className="text-xs text-gray-400 mt-2">For any commitments, involve a parent/guardian or coach.</p>
												</div>
											)}

											<div className="text-gray-400 text-sm mt-2">Focus levels: {m.recommendedLevels.join(' • ')}</div>
											<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
												<div className="bg-mid border border-border rounded-lg p-4">
													<div className="text-white font-semibold mb-2">Why this is a good fit</div>
													<ul className="list-disc list-inside space-y-1 text-gray-200 text-sm">
														{(m.pros || []).map((p, i) => (
															<li key={`pro-${i}`}>{p}</li>
														))}
													</ul>
												</div>
												<div className="bg-mid border border-border rounded-lg p-4">
													<div className="text-white font-semibold mb-2">Things to watch out for</div>
													<ul className="list-disc list-inside space-y-1 text-gray-200 text-sm">
														{(m.cons || []).map((c, i) => (
															<li key={`con-${i}`}>{c}</li>
														))}
													</ul>
												</div>
											</div>
											<div className="text-xs text-gray-400 mt-2">This is guidance to help you decide, not a guarantee.</div>
											<div className="mt-4 flex gap-2 justify-end">
												<Button variant="ghost" onClick={() => setSelectedBizId(b.id)}>Build Outreach</Button>
												<Button onClick={() => setTab('Dashboard')}>Save to Dashboard</Button>
											</div>
										</section>
									)
								})}
							</div>
							{athlete && selectedBiz && (
								<Outreach athlete={athlete} business={selectedBiz} />
							)}
						</>
					)}

					{tab === 'Deals' && (
						<Deals athlete={athlete} businesses={businesses} />
					)}

					{tab === 'Opportunities' && (
						<OpportunityBoard athlete={athlete} />
					)}

					{tab === 'Events' && (
						<EventsPlanner athlete={athlete} />
					)}

					{tab === 'Dashboard' && (
						<Dashboard
							businesses={businesses}
							onUpdate={upsertBusiness}
							onBuildOutreach={(b) => { setSelectedBizId(b.id); setTab('Matches') }}
						/>
					)}

					{tab === 'Profile Preview' && <PublicProfile athlete={athlete} />}

					{tab === 'Resources' && <Resources onGoVendors={() => setTab('Vendor Directory')} />}

					{tab === 'Guidelines' && <Guidelines />}

					{tab === 'NIL Hub' && <NILHub onGoVendors={() => setTab('Vendor Directory')} />}

					{tab === 'Vendor Directory' && <VendorDirectory />}
				</main>
				<footer className="py-10" />
			</div>
		</ToastProvider>
	)
}

function Score({ label, value }: { label: string; value: number }) {
	return (
		<div className="bg-mid border border-border rounded-lg p-3">
			<div className="text-gray-400 text-xs">{label}</div>
			<div className="text-white text-xl font-bold">{value}</div>
		</div>
	)
}


