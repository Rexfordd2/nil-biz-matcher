import { Component, ReactNode, useEffect, useMemo, useState } from 'react'
import AthleteProfileForm from './components/AthleteProfileForm'
import BusinessForm from './components/BusinessForm'
import BusinessAnalysisCard from './components/BusinessAnalysisCard'
import Dashboard from './components/Dashboard'
import SuggestedPlays from './components/SuggestedPlays'
import Outreach from './components/Outreach'
import NILHub from './pages/NILHub'
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
import RecruitingFinder from './components/RecruitingFinder'
import RecruitingBoard from './components/RecruitingBoard'
import RecruitingBlast from './components/RecruitingBlast'
import Sidebar from './components/Sidebar'
import SignUp from './components/auth/SignUp'
import SignUpSupabase from './components/auth/SignUpSupabase'
import Login from './components/auth/Login'
import LoginSupabase from './components/auth/LoginSupabase'
import { authMe, authLogout, type CurrentUser } from './utils/auth'
import { useAutosaveProfile } from './hooks/useAutosaveProfile'
import { supabase, supabaseEnvConfigured } from './lib/supabaseClient'
import { getSession } from './lib/authSupabase'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: any }> {
	constructor(props: { children: ReactNode }) {
		super(props)
		this.state = { hasError: false }
	}
	static getDerivedStateFromError(error: any) {
		return { hasError: true, error }
	}
	override componentDidCatch(error: any, info: any) {
		// eslint-disable-next-line no-console
		console.error('App error:', error, info)
	}
	override render() {
		if (this.state.hasError) {
			return (
				<div className="mx-auto max-w-2xl p-6">
					<h1 className="headline text-2xl mb-2">Something went wrong</h1>
					<p className="text-gray-400 text-sm mb-4">An error occurred while rendering the app.</p>
					<pre className="card overflow-auto text-xs">{String(this.state.error)}</pre>
				</div>
			)
		}
		return this.props.children
	}
}

type Tab =
	| 'Welcome'
	| 'Athlete'
	| 'Businesses'
	| 'Discover'
	| 'Matches'
	| 'Deals'
	| 'Opportunities'
	| 'Events'
	| 'Dashboard'
	| 'Profile Preview'
	| 'Resources'
	| 'Guidelines'
	| 'NIL Hub'
	| 'Vendor Directory'
	| 'Recruiting'
	| 'Recruiting Board'
	| 'Recruiting Blast'
	| 'Sign Up'
	| 'Log In'

export default function App() {
	const [tab, setTab] = useState<Tab>('Welcome')
	const [athlete, setAthlete] = useState<AthleteProfile | null>(() => migrateAthleteProfile(load('athlete', null)))
	const [businesses, setBusinesses] = useState<Business[]>(() => load('businesses', []))
	const [selectedBizId, setSelectedBizId] = useState<string | null>(null)
	const { show } = useToast()
	const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
	const [userMenuOpen, setUserMenuOpen] = useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const autosave = useAutosaveProfile({ userId: currentUser?.id, debounceMs: 800 })
	const cloudConfigured = supabaseEnvConfigured

	// Debug-only health check state
	const [healthRunning, setHealthRunning] = useState(false)
	const [healthResult, setHealthResult] = useState<{
		sessionOk: boolean | null
		sessionError?: string | null
		dbOk: boolean | null
		dbError?: string | null
	}>(() => ({ sessionOk: null, sessionError: null, dbOk: null, dbError: null }))

	useEffect(() => save('athlete', athlete), [athlete])
	useEffect(() => save('businesses', businesses), [businesses])

	// Initial mount ping (independent of auth)
	useEffect(() => {
		// #region agent log
		const __dbgMount = {
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'B',
			location: 'src/App.tsx:mount',
			message: 'App mounted',
			data: {},
			timestamp: Date.now()
		}
		fetch('http://127.0.0.1:7242/ingest/f93d76cb-ddaa-401d-972f-239de3ada967', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(__dbgMount)
		}).catch(() => {})
		fetch('/api/debug/log', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(__dbgMount)
		}).catch(() => {})
		// #endregion
	}, [])

	// Load current session on mount
	useEffect(() => {
		authMe().then(u => {
			// #region agent log
			const __dbgAuth = {
				sessionId: 'debug-session',
				runId: 'initial',
				hypothesisId: 'B',
				location: 'src/App.tsx:authMeEffect',
				message: 'Auth session check on mount',
				data: { authorized: Boolean(u) },
				timestamp: Date.now()
			}
			fetch('http://127.0.0.1:7242/ingest/f93d76cb-ddaa-401d-972f-239de3ada967', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(__dbgAuth)
			}).catch(() => {})
			fetch('/api/debug/log', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(__dbgAuth)
			}).catch(() => {})
			// #endregion
			if (u) setCurrentUser(u)
		})
	}, [])

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

	function isProtected(target: Tab): boolean {
		return ['Athlete', 'Deals', 'Opportunities', 'Recruiting', 'Recruiting Board', 'Recruiting Blast'].includes(target)
	}

	async function goToTab(next: Tab) {
		if (isProtected(next) && !currentUser) {
			show('Please log in to access this section')
			setTab('Log In')
			return
		}
		setTab(next)
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

	async function runHealthCheck() {
		setHealthRunning(true)
		const next: typeof healthResult = { sessionOk: null, sessionError: null, dbOk: null, dbError: null }
		try {
			// Session check
			const sess = await getSession()
			if (sess.error) {
				next.sessionOk = false
				next.sessionError = sess.error
			} else {
				next.sessionOk = Boolean(sess.data)
				next.sessionError = null
			}
		} catch (e: any) {
			next.sessionOk = false
			next.sessionError = String(e?.message || e)
		}
		try {
			// DB check (non-destructive)
			if (!supabase) {
				next.dbOk = false
				next.dbError = 'Supabase client not initialized'
			} else {
				const { data, error } = await supabase
					.from('athlete_profiles')
					.select('updated_at')
					.eq('user_id', currentUser?.id || '00000000-0000-0000-0000-000000000000')
					.limit(1)
				if (error) {
					next.dbOk = false
					next.dbError = [typeof error.status !== 'undefined' ? `status=${error.status}` : null, typeof error.code !== 'undefined' ? `code=${error.code}` : null, error.message ? `message=${error.message}` : null].filter(Boolean).join(' | ')
				} else {
					next.dbOk = true
					next.dbError = null
				}
			}
		} catch (e: any) {
			next.dbOk = false
			next.dbError = String(e?.message || e)
		}
		setHealthResult(next)
		setHealthRunning(false)
	}

	// Derived cloud availability for header
	const cloudAvailable = cloudConfigured && Boolean(currentUser) && !Boolean(autosave.error)

	async function handleLogout() {
		try {
			await authLogout()
		} catch {}
		setCurrentUser(null)
		setUserMenuOpen(false)
		show('Logged out')
	}

	return (
		<ToastProvider>
			<ErrorBoundary>
			<div className="min-h-screen bg-background light-theme">
				<header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
					<div className="mx-auto max-w-6xl px-4 md:px-6 py-4 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded-lg bg-brand-red shadow-glow overflow-hidden">
								<img
									src="/athlete-ledger-logo.png"
									alt="Athlete Ledger Logo"
									className="w-full h-full object-cover"
									onError={(e) => {
										;(e.currentTarget as HTMLImageElement).style.display = 'none'
									}}
								/>
							</div>
							<h1 className="headline text-2xl">Athlete Ledger</h1>
						</div>
						<div className="relative flex flex-col items-end gap-1">
							<div className="text-xs">
								{cloudAvailable ? (
									<span className="text-green-300">Cloud sync: Available</span>
								) : (
									<span className="text-amber-300">Cloud sync unavailable</span>
								)}
							</div>
							{currentUser ? (
								<div className="flex items-center gap-3">
									<button
										type="button"
										onClick={() => setUserMenuOpen(v => !v)}
										className="text-white bg-mid border border-border rounded-md px-3 py-1 hover:bg-mid/80"
									>
										{currentUser.fullName}
									</button>
									{userMenuOpen && (
										<div className="absolute right-0 mt-2 w-44 bg-background border border-border rounded-md shadow-lg overflow-hidden">
											<button className="w-full text-left px-3 py-2 text-gray-200 hover:bg-mid" onClick={() => { setUserMenuOpen(false); goToTab('Athlete') }}>Profile</button>
											<button className="w-full text-left px-3 py-2 text-gray-200 hover:bg-mid" onClick={() => setUserMenuOpen(false)}>Settings</button>
											<button className="w-full text-left px-3 py-2 text-gray-200 hover:bg-mid" onClick={handleLogout}>Log out</button>
										</div>
									)}
								</div>
							) : (
								<div className="flex items-center gap-2">
									<button className="text-gray-300 hover:text-white" onClick={() => setTab('Log In')}>Log in</button>
									<Button onClick={() => setTab('Sign Up')} className="red-glow">Sign up</Button>
								</div>
							)}
						</div>
					</div>
				</header>
				<main className="mx-auto max-w-6xl px-4 md:px-6 pt-6 pb-24 md:pb-6">
					{(() => {
						const params = new URLSearchParams(window.location.search)
						const showDebug = params.get('debug') === '1'
						if (!showDebug) return null
						return (
							<div className="mb-4 p-3 rounded-md border border-border bg-surface text-xs text-gray-200">
								<div className="flex items-center justify-between">
									<div>
										<div>User ID: <span className="text-white">{currentUser?.id || '—'}</span></div>
										<div>Env configured: <span className="text-white">{String(cloudConfigured)}</span></div>
										<div>Last saved: <span className="text-white">{autosave.lastSavedAt ? new Date(autosave.lastSavedAt).toLocaleString() : '—'}</span></div>
										<div>Status: <span className="text-white">{autosave.statusText || '—'}</span></div>
										{autosave.error && <div>Error: <span className="text-amber-300">{autosave.error}</span></div>}
										{(healthResult.sessionOk !== null || healthResult.dbOk !== null) && (
											<div className="mt-2 space-y-1">
												<div>Health Session: <span className={healthResult.sessionOk ? 'text-green-300' : 'text-amber-300'}>{healthResult.sessionOk ? 'pass' : 'fail'}</span> {healthResult.sessionError ? `- ${healthResult.sessionError}` : ''}</div>
												<div>Health DB: <span className={healthResult.dbOk ? 'text-green-300' : 'text-amber-300'}>{healthResult.dbOk ? 'pass' : 'fail'}</span> {healthResult.dbError ? `- ${healthResult.dbError}` : ''}</div>
											</div>
										)}
									</div>
									<div>
										<Button variant="ghost" onClick={() => autosave.refresh()}>Force reload from Supabase</Button>
										<Button variant="ghost" onClick={() => runHealthCheck()} disabled={healthRunning} className="ml-2">{healthRunning ? 'Health Check…' : 'Health Check'}</Button>
									</div>
								</div>
							</div>
						)
					})()}
					<div className="grid grid-cols-1 md:grid-cols-[240px,1fr] gap-6">
						<div className="hidden md:block">
							<Sidebar
								current={tab}
								onSelect={(k) => goToTab(k as Tab)}
								sections={[
									{
										title: 'Main',
										items: [
											{ key: 'Welcome', label: 'Home' },
											{ key: 'Athlete', label: 'Athlete Profile' },
											{ key: 'Discover', label: 'Discover' },
											{ key: 'Matches', label: 'Matches' },
											{ key: 'Dashboard', label: 'Dashboard' },
											{ key: 'Profile Preview', label: 'Public Profile' },
											...(currentUser ? [] as any : [{ key: 'Log In', label: 'Log In' }, { key: 'Sign Up', label: 'Sign Up' }])
										]
									},
									{
										title: 'Workflows',
										items: [
											{ key: 'Businesses', label: 'Businesses' },
											{ key: 'Deals', label: 'Deals' },
											{ key: 'Opportunities', label: 'Opportunities' },
											{ key: 'Events', label: 'Events' }
										]
									},
									{
										title: 'Recruiting',
										items: [
											{ key: 'Recruiting', label: 'Finder' },
											{ key: 'Recruiting Board', label: 'Board' },
											{ key: 'Recruiting Blast', label: 'Blast' }
										]
									},
									{
										title: 'Learn',
										items: [
											{ key: 'NIL Hub', label: 'NIL Hub' },
											{ key: 'Resources', label: 'Resources' },
											{ key: 'Guidelines', label: 'Guidelines' },
											{ key: 'Vendor Directory', label: 'Vendors' }
										]
									}
								]}
							/>
						</div>
						<div className="space-y-6">
					{tab === 'Welcome' && (
						<Welcome
							onStartProfile={() => goToTab('Athlete')}
							onGoResources={() => setTab('Resources')}
							onGoGuidelines={() => setTab('Guidelines')}
						/>
					)}
					{tab === 'Athlete' && (
						<>
							<div className="flex items-center justify-between">
								<div className="text-sm text-gray-400">
									{autosave.statusText}
									{autosave.lastSavedAt && (autosave.statusText === '' || autosave.statusText === 'All changes saved') && (
										<span className="ml-2">Last saved at {new Date(autosave.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
									)}
									{autosave.error && <span className="ml-2 text-amber-300">({autosave.error})</span>}
								</div>
							</div>
							<AthleteProfileForm
								key={`${currentUser?.id || 'anon'}:${autosave.initialProfile ? 'loaded' : 'new'}`}
								value={autosave.initialProfile ?? undefined}
								onSave={async (a) => {
									setAthlete(a)
									if (currentUser) autosave.onDraftChange(a)
								}}
								onChange={(draft) => {
									setAthlete(draft)
									if (currentUser) autosave.onDraftChange(draft)
								}}
							/>
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
										<section key={b.id} className={`card ${active ? 'fade-in' : 'opacity-60'}`}>
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
												<div className="bg-surface border border-border rounded-md p-3">
															<div className="text-gray-400 text-xs">Estimated time per week</div>
															<div className="text-white text-lg font-bold">{m.opportunityCost.timePerWeekHours} hrs</div>
														</div>
												<div className="bg-surface border border-border rounded-md p-3">
															<div className="text-gray-400 text-xs">Estimated duration</div>
															<div className="text-white text-lg font-bold">{m.opportunityCost.durationWeeks} weeks</div>
														</div>
												<div className="bg-surface border border-border rounded-md p-3">
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
												<div key={`idea-${idx}`} className="bg-surface border border-border rounded-lg p-4">
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
															<div className="bg-surface border border-border rounded-md p-3">
																	<details>
																		<summary className="cursor-pointer text-white font-semibold flex items-center justify-between">
																			<span>Phone script</span>
																			<Button variant="ghost" onClick={(e) => { e.preventDefault(); copyToClipboard(conv.phoneScript) }}>Copy</Button>
																		</summary>
																		<pre className="mt-3 bg-mid border border-border rounded-md p-3 whitespace-pre-wrap text-gray-100 text-sm">{conv.phoneScript}</pre>
																	</details>
																</div>
															<div className="bg-surface border border-border rounded-md p-3">
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
						<>
							<SuggestedPlays athlete={athlete} marketingConsent={currentUser?.marketingConsent} />
							<Dashboard
								businesses={businesses}
								onUpdate={upsertBusiness}
								onBuildOutreach={(b) => { setSelectedBizId(b.id); setTab('Matches') }}
							/>
						</>
					)}

					{tab === 'Profile Preview' && <PublicProfile athlete={athlete} />}

					{tab === 'Recruiting' && <RecruitingFinder athlete={athlete} onRequireProfile={() => setTab('Athlete')} />}

					{tab === 'Recruiting Board' && <RecruitingBoard />}

					{tab === 'Recruiting Blast' && <RecruitingBlast athlete={athlete} />}

					{tab === 'Sign Up' && (
						import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? (
							<SignUpSupabase onSignedIn={(u) => { setCurrentUser(u); setTab('Athlete') }} />
						) : (
							<SignUp onSignedIn={(u) => { setCurrentUser(u); setTab('Athlete') }} />
						)
					)}

					{tab === 'Log In' && (
						import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? (
							<LoginSupabase
								onLoggedIn={(u) => { setCurrentUser(u); setTab('Athlete') }}
								onNeedAccount={() => setTab('Sign Up')}
							/>
						) : (
							<Login
								onLoggedIn={(u) => { setCurrentUser(u); setTab('Athlete') }}
								onNeedAccount={() => setTab('Sign Up')}
							/>
						)
					)}

					{tab === 'Resources' && <Resources onGoVendors={() => setTab('Vendor Directory')} />}

					{tab === 'Guidelines' && <Guidelines />}

					{tab === 'NIL Hub' && <NILHub />}

					{tab === 'Vendor Directory' && <VendorDirectory />}
						</div>
					</div>
				</main>

				{/* Mobile bottom navigation */}
				<nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur">
					<div className="grid grid-cols-6 gap-1 px-2 py-2">
						<button
							type="button"
							onClick={() => goToTab('Welcome')}
							className={`text-sm px-2 py-2 rounded-md ${tab === 'Welcome' ? 'bg-mid text-white' : 'text-gray-300 hover:bg-mid/60'}`}
						>
							Home
						</button>
						<button
							type="button"
							onClick={() => goToTab('Athlete')}
							className={`text-sm px-2 py-2 rounded-md ${tab === 'Athlete' ? 'bg-mid text-white' : 'text-gray-300 hover:bg-mid/60'}`}
						>
							Athlete
						</button>
						<button
							type="button"
							onClick={() => goToTab('Discover')}
							className={`text-sm px-2 py-2 rounded-md ${tab === 'Discover' ? 'bg-mid text-white' : 'text-gray-300 hover:bg-mid/60'}`}
						>
							Discover
						</button>
						<button
							type="button"
							onClick={() => goToTab('Matches')}
							className={`text-sm px-2 py-2 rounded-md ${tab === 'Matches' ? 'bg-mid text-white' : 'text-gray-300 hover:bg-mid/60'}`}
						>
							Matches
						</button>
						<button
							type="button"
							onClick={() => goToTab('Dashboard')}
							className={`text-sm px-2 py-2 rounded-md ${tab === 'Dashboard' ? 'bg-mid text-white' : 'text-gray-300 hover:bg-mid/60'}`}
						>
							Board
						</button>
						<button
							type="button"
							onClick={() => setMobileMenuOpen(true)}
							className="text-sm px-2 py-2 rounded-md text-gray-300 hover:bg-mid/60"
						>
							More
						</button>
					</div>
				</nav>

				{/* Mobile full menu overlay */}
				{mobileMenuOpen && (
					<div className="md:hidden fixed inset-0 z-30">
						<div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
						<div className="absolute bottom-0 left-0 right-0 max-h-[75vh] overflow-y-auto bg-background border-t border-border rounded-t-2xl p-4">
							<div className="flex items-center justify-between mb-3">
								<div className="text-sm uppercase tracking-wide text-foreground/60">Menu</div>
								<button
									type="button"
									onClick={() => setMobileMenuOpen(false)}
									className="text-gray-300 hover:text-white px-3 py-1 border border-border rounded-md"
								>
									Close
								</button>
							</div>
							<div className="space-y-5">
								<div>
									<div className="text-xs uppercase tracking-wide text-foreground/60 mb-2">Main</div>
									<div className="grid grid-cols-2 gap-2">
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Welcome') }}>Home</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Athlete') }}>Athlete Profile</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Discover') }}>Discover</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Matches') }}>Matches</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Dashboard') }}>Dashboard</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Profile Preview') }}>Public Profile</button>
										{!currentUser && (
											<>
												<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Log In') }}>Log In</button>
												<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Sign Up') }}>Sign Up</button>
											</>
										)}
									</div>
								</div>
								<div>
									<div className="text-xs uppercase tracking-wide text-foreground/60 mb-2">Workflows</div>
									<div className="grid grid-cols-2 gap-2">
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Businesses') }}>Businesses</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Deals') }}>Deals</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Opportunities') }}>Opportunities</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Events') }}>Events</button>
									</div>
								</div>
								<div>
									<div className="text-xs uppercase tracking-wide text-foreground/60 mb-2">Recruiting</div>
									<div className="grid grid-cols-2 gap-2">
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Recruiting') }}>Finder</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Recruiting Board') }}>Board</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Recruiting Blast') }}>Blast</button>
									</div>
								</div>
								<div>
									<div className="text-xs uppercase tracking-wide text-foreground/60 mb-2">Learn</div>
									<div className="grid grid-cols-2 gap-2">
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('NIL Hub') }}>NIL Hub</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Resources') }}>Resources</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Guidelines') }}>Guidelines</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Vendor Directory') }}>Vendors</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				<footer className="py-10" />
			</div>
			</ErrorBoundary>
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


