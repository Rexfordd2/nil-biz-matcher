import { useEffect, useMemo, useState } from 'react'
import AthleteProfileForm from './components/AthleteProfileForm'
import BusinessForm from './components/BusinessForm'
import BusinessAnalysisCard from './components/BusinessAnalysisCard'
import Dashboard from './components/Dashboard'
import Outreach from './components/Outreach'
import NILHub from './components/NILHub'
import { ToastProvider } from './components/ui/Toast'
import { AthleteProfile, Business } from './types'
import { load, save } from './utils/storage'
import { evaluateMatch } from './utils/matching'
import Button from './components/ui/Button'
import { FitBadge, LevelBadge } from './components/ui/Badge'
import { migrateAthleteProfile } from './utils/migrations'

type Tab = 'Athlete' | 'Businesses' | 'Matches' | 'Dashboard' | 'NIL Hub'

export default function App() {
	const [tab, setTab] = useState<Tab>('Athlete')
	const [athlete, setAthlete] = useState<AthleteProfile | null>(() => migrateAthleteProfile(load('athlete', null)))
	const [businesses, setBusinesses] = useState<Business[]>(() => load('businesses', []))
	const [selectedBizId, setSelectedBizId] = useState<string | null>(null)

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
							{(['Athlete','Businesses','Matches','Dashboard','NIL Hub'] as Tab[]).map(t => (
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
											<div className="text-gray-400 text-sm mt-2">Focus levels: {m.recommendedLevels.join(' • ')}</div>
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

					{tab === 'Dashboard' && (
						<Dashboard
							businesses={businesses}
							onUpdate={upsertBusiness}
							onBuildOutreach={(b) => { setSelectedBizId(b.id); setTab('Matches') }}
						/>
					)}

					{tab === 'NIL Hub' && <NILHub />}
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


