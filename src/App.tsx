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
import { updateUserBusinessProfile, upsertBusinessCanonical, saveUserBusiness } from './services/userBusinesses'
import { useMyBusinesses } from './hooks/useMyBusinesses'
import { useCanonicalBusinessPreflight } from './hooks/useCanonicalBusinessPreflight'
import { useBusinessFilters } from './hooks/useBusinessFilters'
import { CANONICAL_BUSINESSES_MIGRATION_SQL } from './constants/canonicalBusinessMigrationSql'
import BusinessFilterBar from './components/BusinessFilterBar'
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
import RecruitingBoard from './components/RecruitingBoard'
import RecruitingBlast from './components/RecruitingBlast'
import Sidebar from './components/Sidebar'
import RecruitingV2 from './components/RecruitingV2'
import SignUp from './components/auth/SignUp'
import SignUpSupabase from './components/auth/SignUpSupabase'
import Login from './components/auth/Login'
import LoginSupabase from './components/auth/LoginSupabase'
import Extras from './pages/Extras'
import { type CurrentUser } from './utils/auth'
import { useAutosaveProfile } from './hooks/useAutosaveProfile'
import { useAnonProfileDraft } from './hooks/useAnonProfileDraft'
import { supabase, supabaseEnvConfigured, getSupabaseHostname } from './lib/supabaseClient'
import { getSession } from './lib/authSupabase'
import { signOut } from './lib/authSupabase'
import LoginPage from './components/LoginPage'
import { SupabaseSessionProvider, useSupabaseSession } from './context/SupabaseSessionContext'
import SectionErrorBoundary from './components/ErrorBoundary'
import { BUILD_ID } from './constants/build'
import { APP_INSTANCE } from './config/env'
import Observability from './lib/obs'
import DiagnosticsPanel from './components/DiagnosticsPanel'
import DebugDiscoverRecruiting from './pages/DebugDiscoverRecruiting'
import DebugBuild from './pages/DebugBuild'
import { navigate } from './routes/RootRouter'
import WaitlistGate from './components/WaitlistGate'
import BetaWaitlistModal from './components/BetaWaitlistModal'
import { isBetaMode, isDemoMode } from './config/appMode'
import AthleteProfileDebugPanel from './components/AthleteProfileDebugPanel'
import AuthDebugPanel from './components/AuthDebugPanel'
import GoogleDebugPanel from './components/GoogleDebugPanel'
import { goToLogin, goToLogout } from './lib/auth/navigation'

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
	| 'Settings'
	| 'Extras'

function MainApp() {
	const [tab, setTab] = useState<Tab>('Welcome')
	const [athlete, setAthlete] = useState<AthleteProfile | null>(() => migrateAthleteProfile(load('athlete', null)))
	const [selectedBizId, setSelectedBizId] = useState<string | null>(null)
	const [matchOverlay, setMatchOverlay] = useState<Record<string, { match: import('./types').MatchResult; level?: import('./types').BusinessLevel }>>({})
	const { show } = useToast()
	const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
	const [userMenuOpen, setUserMenuOpen] = useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const [waitlistOpen, setWaitlistOpen] = useState(false)
	const { user, loading } = useSupabaseSession()
	const { businesses, loading: businessesLoading, error: businessesError, migrationRequired: businessesMigrationRequired, refetch: refetchBusinesses } = useMyBusinesses()
	const { tablesOk, loading: preflightLoading } = useCanonicalBusinessPreflight()
	const isDebugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1'
	const showPreflightBanner = Boolean(user && isDebugMode && !preflightLoading && !tablesOk)
	const businessPipelineDisabled = !tablesOk
	const autosave = useAutosaveProfile({ user, debounceMs: 800 })
	const anonDraft = useAnonProfileDraft({ debounceMs: 800 })
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

	// Debug-only: log Supabase hostname once when ?debug=1 so deploy can confirm intended project
	useEffect(() => {
		if (typeof window === 'undefined') return
		const params = new URLSearchParams(window.location.search)
		if (params.get('debug') !== '1') return
		const host = getSupabaseHostname()
		// eslint-disable-next-line no-console
		console.log('[debug=1] Supabase hostname:', host)
	}, [])

	async function refreshBusinesses() {
		await refetchBusinesses()
		setMatchOverlay({})
	}

	const { filters, setFilters, filteredList } = useBusinessFilters(businesses)

	const filteredListWithMatches = useMemo(() =>
		filteredList.map(b => ({ ...b, ...matchOverlay[b.id] })),
		[filteredList, matchOverlay]
	)

	// Initial mount ping (independent of auth)
	useEffect(() => {
		// Observability: initial load
		Observability.log({ feature: 'ui', route: 'app.mount', status: 'ui_action' })
		
		// Log env config status in dev mode
		if (import.meta.env.DEV) {
			import('./config/env').then(({ hasGoogleMapsKey }) => {
				console.log('[App] Environment config:', {
					hasGoogleMapsKey,
					hasSupabase: supabaseEnvConfigured,
					mode: import.meta.env.MODE
				})
			})
		}
	}, [])

	// Map Supabase user to CurrentUser shape whenever it changes
	useEffect(() => {
		if (user) {
			const mapped: CurrentUser = {
				id: user.id,
				email: user.email || '',
				fullName: (user.user_metadata?.full_name as string) || user.email || 'User',
				role: (user.user_metadata?.role as string) || 'athlete',
				marketingConsent: Boolean(user.user_metadata?.marketingConsent)
			}
			setCurrentUser(mapped)
		} else {
			setCurrentUser(null)
		}
	}, [user])

	const selectedBiz = useMemo(() => {
		const b = businesses.find(b => b.id === selectedBizId) || null
		if (!b) return null
		return { ...b, ...matchOverlay[b.id] }
	}, [selectedBizId, businesses, matchOverlay])

	async function addBusiness(b: Business) {
		if (businessPipelineDisabled) {
			show('Business pipeline disabled: run canonical businesses migration first')
			return
		}
		if (user) {
			const placeId = `local-${crypto.randomUUID()}`
			const canon = await upsertBusinessCanonical(placeId, {
				name: b.name,
				address: b.location || undefined,
				lat: b.coordinates?.latitude ?? undefined,
				lng: b.coordinates?.longitude ?? undefined,
				phone: b.phone ?? undefined,
				website: b.website ?? undefined,
				rating: b.rating ?? undefined,
			})
			if (!canon.ok) {
				show('Failed to save business')
				return
			}
			const saved = await saveUserBusiness(user.id, placeId, b.status, b.tags)
			if (!saved.ok) {
				show('Failed to save business')
				return
			}
			await refreshBusinesses()
			show('Business added')
		} else {
			show('Business added (sign in to save to cloud)')
		}
		setTab('Businesses')
	}

	async function handleUpdateBusiness(updated: Business) {
		if (businessPipelineDisabled) {
			show('Business pipeline disabled: run canonical businesses migration first')
			return
		}
		if (user && (updated.status !== undefined || updated.tags !== undefined)) {
			const res = await updateUserBusinessProfile(user.id, updated.id, {
				...(updated.status !== undefined && { status: updated.status }),
				...(updated.tags !== undefined && { tags: updated.tags }),
			})
			if (res.ok) {
				show('Status updated')
				await refetchBusinesses()
			} else {
				show('Failed to update')
			}
		}
	}

	async function copyMigrationSql() {
		try {
			await navigator.clipboard.writeText(CANONICAL_BUSINESSES_MIGRATION_SQL)
			show('Migration SQL copied to clipboard')
		} catch {
			show('Failed to copy')
		}
	}

	async function goToTab(next: Tab) {
		// Allow access to all tabs regardless of authentication state
		// Observability: tab open
		if (next === 'Discover') {
			Observability.log({ feature: 'discover', route: 'ui.tab.open', status: 'ui_action' })
		} else if (next === 'Recruiting') {
			Observability.log({ feature: 'recruitment', route: 'ui.tab.open', status: 'ui_action' })
		} else {
			Observability.log({ feature: 'ui', route: `ui.tab.${next}.open`, status: 'ui_action' })
		}
		setTab(next)
	}

	function runMatches() {
		if (!athlete) return
		const next: Record<string, { match: import('./types').MatchResult; level?: import('./types').BusinessLevel }> = {}
		for (const b of businesses) {
			next[b.id] = {
				match: evaluateMatch(athlete, b),
				level: b.level || b.analysis?.levelGuess
			}
		}
		setMatchOverlay(next)
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
				next.sessionError = sess.error?.message || null
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
					next.dbError = [
						'status' in error ? `status=${(error as any).status}` : null,
						typeof error.code !== 'undefined' ? `code=${error.code}` : null,
						error.message ? `message=${error.message}` : null
					]
						.filter(Boolean)
						.join(' | ')
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
		// Use centralized logout function for consistent behavior
		await goToLogout()
	}

	// BETA mode auth gate: redirect unauthenticated users to /auth/login
	useEffect(() => {
		if (isBetaMode() && !loading && !user) {
			navigate('/auth/login', true)
		}
	}, [user, loading])

	// In BETA mode, if not authenticated, render nothing while redirecting
	if (isBetaMode() && !loading && !user) {
		return (
			<ToastProvider>
				<div className="min-h-screen bg-background light-theme flex items-center justify-center">
					<div className="text-gray-400">Redirecting to login...</div>
				</div>
			</ToastProvider>
		)
	}

	return (
		<ToastProvider>
			<ErrorBoundary>
			{/* Only show WaitlistGate in DEMO mode */}
			{isDemoMode() && <WaitlistGate />}
			{/* Beta waitlist modal */}
			{isBetaMode() && <BetaWaitlistModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} />}
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
							<div className="text-xs text-black">
								{`Build: ${BUILD_ID}`}
							</div>
							{!currentUser && (
								<Button 
									data-testid="app-header-login-button" 
									onClick={() => goToLogin()} 
									className="red-glow"
								>
									Sign In
								</Button>
							)}
							{currentUser ? (
								<div className="flex items-center gap-3">
									{isBetaMode() && (
										<Button
											onClick={() => setWaitlistOpen(true)}
											variant="secondary"
											data-testid="beta-waitlist-cta"
										>
											Join Waitlist
										</Button>
									)}
									<button
										type="button"
										onClick={() => setUserMenuOpen(v => !v)}
										className="text-white bg-mid border border-border rounded-md px-3 py-1 hover:bg-mid/80"
									>
										{currentUser?.fullName || 'User'}
									</button>
									{userMenuOpen && (
										<div className="absolute right-0 mt-2 w-44 bg-background border border-border rounded-md shadow-lg overflow-hidden">
											<button className="w-full text-left px-3 py-2 text-gray-200 hover:bg-mid" onClick={() => { setUserMenuOpen(false); goToTab('Athlete') }}>Profile</button>
											<button className="w-full text-left px-3 py-2 text-gray-200 hover:bg-mid" onClick={() => { setUserMenuOpen(false); goToTab('Settings') }}>Settings</button>
											<button className="w-full text-left px-3 py-2 text-gray-200 hover:bg-mid" onClick={handleLogout}>Log out</button>
										</div>
									)}
								</div>
							) : null}
						</div>
					</div>
				</header>
				<main className="mx-auto max-w-6xl px-4 md:px-6 pt-6 pb-24 md:pb-6">
					{/* Google Debug Panel */}
					<GoogleDebugPanel />
					
					{(() => {
						const params = new URLSearchParams(window.location.search)
						const showDebug = params.get('debug') === '1'
						if (!showDebug) return null
						return (
							<div className="mb-4 p-3 rounded-md border border-border bg-surface text-xs text-gray-200">
								<div className="flex items-center justify-between">
									<div>
										<div>App Instance: <span className="text-white">{APP_INSTANCE}</span></div>
										<div>Supabase: <span className="text-white" data-testid="debug-supabase-hostname">{getSupabaseHostname()}</span></div>
										<div>Build ID: <span className="text-white">{BUILD_ID}</span></div>
										<div>User ID: <span className="text-white">{currentUser?.id || '—'}</span></div>
										<div>Env configured: <span className="text-white">{String(cloudConfigured)}</span></div>
										<div>Last saved: <span className="text-white">{currentUser ? (autosave.lastSavedAt ? new Date(autosave.lastSavedAt).toLocaleString() : '—') : (anonDraft.lastSavedAt ? new Date(anonDraft.lastSavedAt).toLocaleString() : '—')}</span></div>
										<div>Status: <span className="text-white">{currentUser ? (autosave.statusText || '—') : (anonDraft.statusText || '—')}</span></div>
										{currentUser && autosave.error && <div>Error: <span className="text-amber-300">{autosave.error}</span></div>}
										{currentUser && autosave.errorRaw && (
											<div className="mt-2 p-2 bg-red-900/20 border border-red-700 rounded text-xs">
												<div className="font-semibold text-red-400 mb-1">Raw Supabase Error:</div>
												{autosave.errorRaw.code && <div>Code: <span className="text-white">{autosave.errorRaw.code}</span></div>}
												{autosave.errorRaw.status && <div>Status: <span className="text-white">{autosave.errorRaw.status}</span></div>}
												{autosave.errorRaw.message && <div>Message: <span className="text-white">{autosave.errorRaw.message}</span></div>}
												{autosave.errorRaw.details && <div>Details: <span className="text-white">{autosave.errorRaw.details}</span></div>}
												{autosave.errorRaw.hint && <div>Hint: <span className="text-white">{autosave.errorRaw.hint}</span></div>}
											</div>
										)}
										{(healthResult.sessionOk !== null || healthResult.dbOk !== null) && (
											<div className="mt-2 space-y-1">
												<div>Health Session: <span className={healthResult.sessionOk ? 'text-green-300' : 'text-amber-300'}>{healthResult.sessionOk ? 'pass' : 'fail'}</span> {healthResult.sessionError ? `- ${healthResult.sessionError}` : ''}</div>
												<div>Health DB: <span className={healthResult.dbOk ? 'text-green-300' : 'text-amber-300'}>{healthResult.dbOk ? 'pass' : 'fail'}</span> {healthResult.dbError ? `- ${healthResult.dbError}` : ''}</div>
											</div>
										)}
									</div>
									<div>
										{currentUser && <Button variant="ghost" onClick={() => autosave.refresh()}>Force reload from Supabase</Button>}
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
											{ key: 'Recruiting', label: 'Recruiting' },
											{ key: 'Profile Preview', label: 'Public Profile' },
											{ key: 'Settings', label: 'Settings' },
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
											{ key: 'Vendor Directory', label: 'Vendors' },
											{ key: 'Extras', label: 'Extras' }
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
							{/* Dedicated Debug Panel for Athlete Profile (only shows with ?debug=1) */}
							<AthleteProfileDebugPanel
								user={currentUser ? user : null}
								profileFetched={currentUser ? autosave.profileFetched : anonDraft.profileFetched}
								lastSaveAttempt={currentUser ? autosave.lastSaveAttempt : anonDraft.lastSaveAttempt}
								lastSavedAt={currentUser ? autosave.lastSavedAt : anonDraft.lastSavedAt}
								status={currentUser ? autosave.status : anonDraft.status}
								error={currentUser ? autosave.error : anonDraft.error}
								errorRaw={currentUser ? autosave.errorRaw : anonDraft.errorRaw}
								queueState={currentUser ? autosave._debugQueueState : anonDraft._debugQueueState}
							/>

							<div className="flex items-center justify-between">
								<div className="text-sm text-gray-400">
									{currentUser ? (
										<>
											{autosave.statusText}
											{autosave.lastSavedAt && (autosave.statusText === '' || autosave.statusText === 'All changes saved') && (
												<span className="ml-2">Last saved at {new Date(autosave.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
											)}
											{autosave.error && <span className="ml-2 text-amber-300">({autosave.error})</span>}
										</>
									) : (
										<>
											{anonDraft.statusText}
											{anonDraft.lastSavedAt && anonDraft.status === 'saved' && (
												<span className="ml-2">Last saved at {new Date(anonDraft.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
											)}
										</>
									)}
								</div>
							</div>
							<AthleteProfileForm
								key={`${currentUser?.id || 'anon'}:${currentUser ? (autosave.initialProfile ? 'loaded' : 'new') : (anonDraft.initialProfile ? 'loaded' : 'new')}`}
								value={currentUser ? (autosave.initialProfile ?? undefined) : (anonDraft.initialProfile ?? undefined)}
								onSave={async (a) => {
									setAthlete(a)
									if (currentUser) {
										autosave.onDraftChange(a)
										await autosave.saveNow()
										// Show success/failure based on save result
										if (autosave.status === 'saved') {
											show('Athlete profile saved')
										} else if (autosave.status === 'error') {
											show(`Save failed: ${autosave.error || 'Unknown error'}`)
										}
									} else {
										anonDraft.onDraftChange(a)
										await anonDraft.saveNow()
										if (anonDraft.status === 'saved') {
											show('Athlete profile saved locally')
										}
									}
								}}
								onChange={(draft) => {
									setAthlete(draft)
									if (currentUser) {
										autosave.onDraftChange(draft)
									} else {
										anonDraft.onDraftChange(draft)
									}
								}}
							/>
							<div className="flex justify-end">
								<Button onClick={runMatches} className="red-glow">Evaluate Matches</Button>
							</div>
						</>
					)}

					{tab === 'Businesses' && (
						<>
							{showPreflightBanner && (
								<div className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-500/20 px-4 py-3 text-amber-100" role="alert">
									<p className="font-bold">Admin: Canonical business tables missing (preflight check failed).</p>
									<p className="mt-1 text-sm">Run the migration in Supabase SQL Editor, then refresh.</p>
									<Button onClick={copyMigrationSql} className="mt-3" variant="secondary">Copy Migration SQL</Button>
								</div>
							)}
							{!showPreflightBanner && businessesMigrationRequired && (
								<div className="mb-4 rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-amber-200" role="alert">
									<p className="font-semibold">Admin: Business list failed (e.g. relation does not exist — tables missing).</p>
									<p className="mt-1 text-sm">Run the canonical businesses migration in Supabase SQL Editor: supabase/migrations/20260223_canonical_businesses_user_businesses.sql</p>
								</div>
							)}
							{!businessesMigrationRequired && businessesError && (
								<div className="mb-4 text-sm text-red-400">{businessesError}</div>
							)}
							{businessesLoading && (
								<div className="mb-4 text-sm text-gray-400">Loading businesses…</div>
							)}
							<BusinessForm onAdd={addBusiness} disabled={businessPipelineDisabled} />
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
								{filteredList.map(b => (
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
						<>
							{showPreflightBanner && (
								<div className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-500/20 px-4 py-3 text-amber-100" role="alert">
									<p className="font-bold">Admin: Canonical business tables missing (preflight check failed).</p>
									<p className="mt-1 text-sm">Run the migration in Supabase SQL Editor, then refresh.</p>
									<Button onClick={copyMigrationSql} className="mt-3" variant="secondary">Copy Migration SQL</Button>
								</div>
							)}
							{!showPreflightBanner && businessesMigrationRequired && (
								<div className="mb-4 rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-amber-200" role="alert">
									<p className="font-semibold">Admin: Business list failed (e.g. relation does not exist — tables missing).</p>
									<p className="mt-1 text-sm">Run the canonical businesses migration in Supabase SQL Editor: supabase/migrations/20260223_canonical_businesses_user_businesses.sql</p>
								</div>
							)}
							<Discover onSaved={refreshBusinesses} businessPipelineDisabled={businessPipelineDisabled} />
						</>
					)}

					{tab === 'Matches' && (
						<>
							{showPreflightBanner && (
								<div className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-500/20 px-4 py-3 text-amber-100" role="alert">
									<p className="font-bold">Admin: Canonical business tables missing (preflight check failed).</p>
									<p className="mt-1 text-sm">Run the migration in Supabase SQL Editor, then refresh.</p>
									<Button onClick={copyMigrationSql} className="mt-3" variant="secondary">Copy Migration SQL</Button>
								</div>
							)}
							<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
								<h2 className="headline text-xl">Best Matches for You</h2>
								<div className="flex items-center gap-2">
									<BusinessFilterBar businesses={businesses} filters={filters} onFiltersChange={setFilters} />
									<Button onClick={runMatches} variant="ghost">Re-run</Button>
								</div>
							</div>
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
								{filteredListWithMatches.map(b => {
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
						<>
							{showPreflightBanner && (
								<div className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-500/20 px-4 py-3 text-amber-100" role="alert">
									<p className="font-bold">Admin: Canonical business tables missing (preflight check failed).</p>
									<p className="mt-1 text-sm">Run the migration in Supabase SQL Editor, then refresh.</p>
									<Button onClick={copyMigrationSql} className="mt-3" variant="secondary">Copy Migration SQL</Button>
								</div>
							)}
							<div className="mb-4">
								<BusinessFilterBar businesses={businesses} filters={filters} onFiltersChange={setFilters} />
							</div>
							<Deals athlete={athlete} businesses={filteredListWithMatches} onUpdateBusiness={handleUpdateBusiness} />
						</>
					)}

					{tab === 'Opportunities' && (
						<>
							{showPreflightBanner && (
								<div className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-500/20 px-4 py-3 text-amber-100" role="alert">
									<p className="font-bold">Admin: Canonical business tables missing (preflight check failed).</p>
									<p className="mt-1 text-sm">Run the migration in Supabase SQL Editor, then refresh.</p>
									<Button onClick={copyMigrationSql} className="mt-3" variant="secondary">Copy Migration SQL</Button>
								</div>
							)}
							<OpportunityBoard athlete={athlete} businesses={filteredListWithMatches} onUpdateBusiness={handleUpdateBusiness} />
						</>
					)}

					{tab === 'Events' && (
						<EventsPlanner athlete={athlete} />
					)}

					{tab === 'Dashboard' && (
						<>
							<SuggestedPlays athlete={athlete} marketingConsent={currentUser?.marketingConsent} />
							<div className="mb-4">
								<BusinessFilterBar businesses={businesses} filters={filters} onFiltersChange={setFilters} statusOnly />
							</div>
							<Dashboard
								businesses={filteredListWithMatches}
								onUpdate={handleUpdateBusiness}
								onBuildOutreach={(b) => { setSelectedBizId(b.id); setTab('Matches') }}
							/>
						</>
					)}

					{tab === 'Profile Preview' && <PublicProfile athlete={((currentUser ? autosave.initialProfile : anonDraft.initialProfile) || athlete) ?? null} />}

					{tab === 'Recruiting' && (
						<SectionErrorBoundary>
							<RecruitingV2 />
						</SectionErrorBoundary>
					)}

					{tab === 'Recruiting Board' && <RecruitingBoard />}

					{tab === 'Recruiting Blast' && <RecruitingBlast athlete={athlete} />}

					{tab === 'Sign Up' && (
						import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? (
							<SignUpSupabase onSignedIn={(u) => { setCurrentUser(u); setTab('Athlete') }} />
						) : import.meta.env.DEV ? (
							<SignUp onSignedIn={(u) => { setCurrentUser(u); setTab('Athlete') }} />
						) : (
							<div className="rounded-md border border-border bg-surface p-4 text-sm text-gray-300">
								Supabase not configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
							</div>
						)
					)}

					{tab === 'Log In' && (
						import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? (
							<LoginSupabase
								onLoggedIn={(u) => { setCurrentUser(u); setTab('Athlete') }}
								onNeedAccount={() => setTab('Sign Up')}
							/>
						) : import.meta.env.DEV ? (
							<Login
								onLoggedIn={(u) => { setCurrentUser(u); setTab('Athlete') }}
								onNeedAccount={() => setTab('Sign Up')}
							/>
						) : (
							<div className="rounded-md border border-border bg-surface p-4 text-sm text-gray-300">
								Supabase not configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
							</div>
						)
					)}

					{tab === 'Resources' && <Resources onGoVendors={() => setTab('Vendor Directory')} />}

					{tab === 'Guidelines' && <Guidelines />}

					{tab === 'NIL Hub' && <NILHub />}

					{tab === 'Vendor Directory' && <VendorDirectory />}

					{tab === 'Settings' && (
						<div className="space-y-6">
							<div className="card p-6">
								<h2 className="headline text-xl mb-4">Settings</h2>
								{currentUser ? (
									<div className="space-y-4">
										<div>
											<div className="text-sm text-gray-400 mb-2">Account</div>
											<div className="text-white">{currentUser.email}</div>
										</div>
										<div>
											<div className="text-sm text-gray-400 mb-2">Cloud Sync</div>
											<div className="text-white">{cloudAvailable ? 'Enabled' : 'Unavailable'}</div>
										</div>
									</div>
								) : (
									<div className="space-y-4">
										{isDemoMode() ? (
											<>
												<div className="border border-border rounded-lg p-4 bg-mid/30">
													<h3 className="text-white font-semibold mb-2">Anonymous Mode</h3>
													<p className="text-gray-300 text-sm mb-4">
														You're using anonymous mode. Your progress is saved to this device.
													</p>
													<Button
														onClick={() => {
															navigate('/')
															setTimeout(() => {
																document.getElementById('waitlist-form')?.scrollIntoView({ behavior: 'smooth' })
															}, 100)
														}}
														className="red-glow"
													>
														Join waitlist to save progress to email
													</Button>
												</div>
												<div className="text-sm text-gray-400">
													<p>To access your data across devices and enable cloud sync, join the waitlist and claim your account when available.</p>
												</div>
											</>
										) : (
											<div className="border border-border rounded-lg p-4 bg-mid/30">
												<h3 className="text-white font-semibold mb-2">Not Logged In</h3>
												<p className="text-gray-300 text-sm mb-4">
													Log in to save your progress and access your data across devices.
												</p>
												<Button
													onClick={() => goToTab('Log In')}
													className="red-glow"
												>
													Log In
												</Button>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					)}

					{tab === 'Extras' && <Extras />}
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
							data-testid="nav-discover-button"
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
						data-testid="nav-more-button"
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
										<button data-testid="nav-recruiting-button" className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Recruiting') }}>Recruiting (V2)</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Profile Preview') }}>Public Profile</button>
										<button className="px-3 py-2 rounded-md bg-surface text-left" onClick={() => { setMobileMenuOpen(false); goToTab('Settings') }}>Settings</button>
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

				{/* Diagnostics (dev only or when VITE_DIAGNOSTICS=true) */}
				{(Observability as any).isDiagnosticsEnabled?.() && <DiagnosticsPanel />}

				{/* Auth Debug Panel (visible with ?debug=1) */}
				<AuthDebugPanel />

				<footer className="py-10">
					{!currentUser && isDemoMode() && (
						<div className="mx-auto max-w-6xl px-4 md:px-6">
							<div className="card p-4 bg-mid/30 border border-border">
								<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
									<div>
										<p className="text-sm text-gray-300">
											<span className="font-semibold">Anonymous mode:</span> Your progress is saved to this device.
										</p>
									</div>
									<Button
										variant="secondary"
										onClick={() => {
											navigate('/')
											setTimeout(() => {
												document.getElementById('waitlist-form')?.scrollIntoView({ behavior: 'smooth' })
											}, 100)
										}}
									>
										Join waitlist to save progress to email
									</Button>
								</div>
							</div>
						</div>
					)}
					{/* App instance label - always visible in footer */}
					<div className="mx-auto max-w-6xl px-4 md:px-6 mt-4">
						<div className="text-center text-xs text-gray-500">
							Instance: {APP_INSTANCE} | Build: {BUILD_ID}
						</div>
					</div>
				</footer>
			</div>
			</ErrorBoundary>
		</ToastProvider>
	)
}

function AppShell() {
	const { user, loading } = useSupabaseSession()
	if (!supabaseEnvConfigured) {
		return (
			<div className="min-h-screen">
				<div className="fixed top-2 right-3 text-xs text-black">{`Build: ${BUILD_ID}`}</div>
				<div>Cloud sync unavailable (missing Supabase env variables)</div>
			</div>
		)
	}
	// Don't block rendering - allow unauthenticated access immediately
	// Session loading happens in background and updates when ready
	return <MainApp />
}

export default function App() {
	const path = typeof window !== 'undefined' ? window.location.pathname : '/'
	const showDebugDiscoverRecruiting =
		path === '/debug/discover-recruiting' &&
		((Observability as any).isDiagnosticsEnabled?.() || import.meta.env.DEV)
	const showDebugBuild = path === '/debug/build'

	return (
		<SupabaseSessionProvider>
			{showDebugDiscoverRecruiting ? (
				<DebugDiscoverRecruiting />
			) : showDebugBuild ? (
				<DebugBuild />
			) : (
				<AppShell />
			)}
		</SupabaseSessionProvider>
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


