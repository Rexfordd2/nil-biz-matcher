import { useEffect, useMemo, useRef, useState } from 'react'
import Card from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import Select from './ui/Select'
import ProgramMap from './ProgramMap'
import ProgramSwipeDeck from './ProgramSwipeDeck'
import { AthleteProfile } from '../types'
import { CollegeProgram } from '../recruiting/programTypes'
import { searchPrograms } from '../recruiting/search'
import { analyzeProgramFit } from '../recruiting/fit'
import { upsertByProgram } from '../recruiting/pipeline'
import { buildRecruitingScript } from '../utils/recruitingOutreach'
import { useToast } from './ui/Toast'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Observability, { generateRequestId } from '../lib/obs'
import { ValidationError } from '../validation/validators'
import { normalizeError, getUserErrorMessage, shouldShowCachedWithRetry, shouldPreserveState } from '../lib/errorHandling'
import { saveUserData } from '../lib/userData'

export default function RecruitingFinder({ athlete, onRequireProfile }: { athlete: AthleteProfile | null; onRequireProfile?: () => void }) {
	const { show } = useToast()
	const { user } = useAuth()
	const [sport, setSport] = useState('')
	const [level, setLevel] = useState('')
	const [region, setRegion] = useState('')
	const [results, setResults] = useState<CollegeProgram[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isStale, setIsStale] = useState(false)
	const [lastGood, setLastGood] = useState<CollegeProgram[] | null>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [currentIndex, setCurrentIndex] = useState(0)
	const [isDeciding, setIsDeciding] = useState(false)

	// Request management
	const controllerRef = useRef<AbortController | null>(null)
	const reqVersionRef = useRef(0)

	useEffect(() => {
		// run initial search by athlete primary sport if available
		if (!sport && athlete?.sports?.[0]?.sportName) {
			setSport(athlete.sports[0].sportName)
		}
	}, [athlete, sport])

	async function runSearch() {
		// Cancel any in-flight
		try { controllerRef.current?.abort() } catch {}
		const ac = new AbortController()
		controllerRef.current = ac
		const myVersion = ++reqVersionRef.current

		const reqId = generateRequestId()
		Observability.log({
			feature: 'recruitment',
			route: 'ui.recruiting.search',
			status: 'ui_action',
			requestId: reqId,
			userId: user?.id || null,
			meta: { sport, level, region }
		})

		// Save user data (non-blocking)
		saveUserData('recruiting_search', {
			sport,
			region,
			ts: new Date().toISOString()
		}).catch(() => {
			// Errors are already logged in saveUserData
		})

		setLoading(true)
		setError(null)
		setIsStale(false)
		try {
			const r = await searchPrograms({ sport, level, region }, { requestId: reqId, userId: user?.id || null, signal: ac.signal })
			// Ignore late responses
			if (myVersion !== reqVersionRef.current) return
			setResults(r)
			setLastGood(r)
			setSelectedId(null)
			setCurrentIndex(0)
		} catch (e: any) {
			// Ignore abortion as error
			if (ac.signal.aborted) return
			if (myVersion !== reqVersionRef.current) return
			
			const normalized = normalizeError(e, reqId)
			const hasLastGood = lastGood && lastGood.length > 0
			
			// On failure, show last known good if present for transient errors
			if (hasLastGood && shouldShowCachedWithRetry(normalized)) {
				setResults(lastGood)
				setIsStale(true)
				setError(getUserErrorMessage(normalized, true))
			} else {
				// For validation errors, preserve state (don't clear results)
				if (shouldPreserveState(normalized)) {
					setError(getUserErrorMessage(normalized, false))
					// Don't clear results for validation errors
				} else {
					setResults([])
					setSelectedId(null)
					setCurrentIndex(0)
					setError(getUserErrorMessage(normalized, false))
				}
			}
			
			// Errors are handled and displayed to user, but no redirects
		} finally {
			// Only clear loading if this is the latest request
			if (myVersion === reqVersionRef.current) setLoading(false)
		}
	}

	// Cancel any in-flight on unmount
	useEffect(() => {
		return () => {
			try { controllerRef.current?.abort() } catch {}
		}
	}, [])

	const summaries = useMemo(() => {
		if (!athlete) return {}
		const acc: Record<string, { rating?: string; note?: string; tags?: string[]; gpa?: string }> = {}
		for (const p of results) {
			const an = analyzeProgramFit({ athlete, program: p })
			acc[p.id] = {
				rating: an.rating,
				note: an.pros[0] || an.cons[0] || '',
				tags: (p.playstyle?.playstyleTags || []).slice(0, 2),
				gpa: p.academic?.minGpaRange
			}
		}
		return acc
	}, [results, athlete])

	useEffect(() => {
		const active = results[currentIndex]
		if (active) setSelectedId(active.id)
	}, [currentIndex, results])

	function onSelectFromMap(id: string) {
		setSelectedId(id)
		const idx = results.findIndex(p => p.id === id)
		if (idx >= 0) setCurrentIndex(idx)
	}

	async function onSwipeDecision(programId: string, decision: 'pursue' | 'maybe' | 'skip') {
		if (isDeciding) return
		const prev = currentIndex

		// If no athlete profile, block and optionally redirect to profile
		if (!athlete) {
			show('Please create your profile first')
			onRequireProfile?.()
			// ProgramSwipeDeck calls onSwipeDecision before advancing; still ensure we stay put
			setCurrentIndex(prev)
			return
		}

		// Optimistic advance is handled by the deck; guard against double-submits here
		setIsDeciding(true)
		try {
			if (decision !== 'skip') {
				// Try cloud first when available
				const program = results.find(p => p.id === programId) || null
				if (supabase && user && program) {
					await supabase.from('recruiting_targets').insert({
						user_id: user.id,
						program,
						status: 'researching'
					})
				} else {
					// Fallback to local pipeline
					await Promise.resolve(
						upsertByProgram(athlete.id, programId, {
							status: 'researching',
							interestLevel: decision
						})
					)
				}
			}
		} catch (err) {
			// Roll back index on failure
			setCurrentIndex(prev)
			show('Failed to save decision. Please try again.')
			// eslint-disable-next-line no-console
			console.error(err)
		} finally {
			setIsDeciding(false)
		}
	}

	return (
		<div className="space-y-4">
			<Card title="College & Semi-Pro Finder">
				<div className="grid grid-cols-1 md:grid-cols-5 gap-3">
					<Input data-testid="recruiting-sport-input" value={sport} onChange={e => setSport(e.target.value)} placeholder="Sport (e.g., Football)" />
					<Select value={level} onChange={e => setLevel(e.target.value)}>
						<option value="">Any Level</option>
						<option value="ncaa_d1">NCAA_D1</option>
						<option value="ncaa_d2">NCAA_D2</option>
						<option value="ncaa_d3">NCAA_D3</option>
						<option value="naia">NAIA</option>
						<option value="juco">JUCO</option>
						<option value="semi_pro">SEMI_PRO</option>
					</Select>
					<Input data-testid="recruiting-region-input" value={region} onChange={e => setRegion(e.target.value)} placeholder="Region/state (e.g., TX)" />
					<div className="md:col-span-2 flex gap-2">
						<Button data-testid="recruiting-search-button" onClick={runSearch} disabled={loading}>{loading ? 'Searching…' : 'Search'}</Button>
						{!athlete && <div className="subtle text-sm self-center">Create your profile for better fit analysis.</div>}
					</div>
				</div>
				{error && (
					<div data-testid="recruiting-error-banner" className="mt-2 text-sm text-red-400 flex items-center justify-between">
						<span>{error}</span>
						<Button variant="secondary" onClick={runSearch} disabled={loading}>Retry</Button>
					</div>
				)}
			</Card>

			{results.length === 0 && !loading ? (
				<div data-testid="recruiting-results-container" className="text-gray-400 text-sm">No matches found.</div>
			) : (
				<div data-testid="recruiting-results-container" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
					{isStale && (
						<div className="md:col-span-2 rounded-md border border-amber-400 bg-amber-900/30 px-3 py-2 text-amber-200 text-sm">
							Showing cached results — retrying…
						</div>
					)}
					<div className="space-y-3">
						<ProgramMap
							programs={results}
							selectedId={selectedId}
							onSelectProgram={onSelectFromMap}
						/>
					</div>
					<div className="space-y-3">
						<ProgramSwipeDeck
							programs={results}
							currentIndex={currentIndex}
							onIndexChange={setCurrentIndex}
							onSwipeDecision={onSwipeDecision}
							disabled={!athlete || isDeciding}
							summaryById={summaries}
						/>
						{(() => {
							const p = results[currentIndex]
							if (!p) return null
							const s = summaries[p.id]
							return (
								<div className="card">
									<div className="flex items-center justify-between mb-2">
										<div className="text-white font-semibold truncate">{p.name}</div>
										{s?.rating && <div className="text-xs text-gray-300">{s.rating}</div>}
									</div>
									<div className="text-gray-400 text-sm truncate">{
										[p.sport, p.level, p.conference].filter(Boolean).join(' • ')
									}</div>
									{p.recruitingPageUrl && (
										<div className="truncate mt-1">
											<a href={p.recruitingPageUrl} className="text-blue-300 hover:underline" target="_blank" rel="noreferrer">{p.recruitingPageUrl}</a>
										</div>
									)}
									{(p.recruiters || []).length > 0 && (
										<div className="mt-3">
											<div className="text-white font-semibold mb-1">Recruiter Contacts</div>
											<ul className="list-disc list-inside text-gray-200 text-sm space-y-1">
												{(p.recruiters || []).map((r, idx) => (
													<li key={`rec-${idx}`}>
														{r.name}{r.role ? ` — ${r.role}` : ''}
														{r.email ? ` • ${r.email}` : ''}
														{r.phone ? ` • ${r.phone}` : ''}
														{r.website ? (
															<a href={r.website} target="_blank" rel="noreferrer" className="ml-2 underline">link</a>
														) : null}
													</li>
												))}
											</ul>
										</div>
									)}
									{athlete && (
										<div className="mt-3">
											<div className="text-white font-semibold mb-1">Prep Outreach</div>
											{(() => {
												const fit = analyzeProgramFit({ athlete, program: p })
												const email = buildRecruitingScript({ athlete, program: p, fitAnalysis: fit }).email
												return (
													<div>
														<div className="subtle text-xs mb-1">Email Template</div>
														<pre className="bg-mid border border-border rounded-md p-3 whitespace-pre-wrap text-gray-100 text-sm">{email}</pre>
														<div className="mt-2 flex justify-end">
															<Button variant="ghost" onClick={() => { navigator.clipboard.writeText(email).then(() => show('Copied to clipboard')) }}>Copy Email</Button>
														</div>
													</div>
												)
											})()}
										</div>
									)}
								</div>
							)
						})()}
					</div>
				</div>
			)}
		</div>
	)
}


