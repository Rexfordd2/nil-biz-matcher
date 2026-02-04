import { useMemo, useRef, useState } from 'react'
import Observability, { generateRequestId } from '../lib/obs'
import { searchBusinesses } from '../services/search'
import { searchPrograms } from '../recruiting/search'
import { loadGoogleMaps } from '../lib/google/loader'

type Target = 'discover' | 'recruiting' | 'explore_map'

type RunResult = {
	requestId: string
	ok: boolean
	empty?: boolean
	durationMs: number
	errorName?: string
	errorMessage?: string
	cancelled?: boolean
	resultHash?: string
}

function median(values: number[]): number {
	if (values.length === 0) return 0
	const arr = [...values].sort((a, b) => a - b)
	const mid = Math.floor(arr.length / 2)
	return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid]
}

function p95(values: number[]): number {
	if (values.length === 0) return 0
	const arr = [...values].sort((a, b) => a - b)
	const idx = Math.ceil(0.95 * arr.length) - 1
	return arr[Math.max(0, Math.min(arr.length - 1, idx))]
}

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]
}

function randomDiscoverQuery() {
	const terms = ['pizza', 'gym', 'coffee', 'restaurant', 'barber', 'yoga', 'bakery', 'pharmacy']
	const locs = ['New York, NY', 'Austin, TX', 'Seattle, WA', 'Miami, FL', 'Denver, CO', 'Chicago, IL', 'San Diego, CA']
	return { term: pick(terms), location: pick(locs) }
}

function randomRecruitingFilters() {
	const sports = ['soccer', 'basketball', 'football', 'baseball', 'volleyball', 'hockey', 'tennis', 'wrestling']
	const levels = ['', 'ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'juco', 'semi_pro']
	const regions = ['', 'TX', 'CA', 'WA', 'NY', 'FL', 'OH', 'GA', 'NC']
	return { sport: pick(sports), level: pick(levels), region: pick(regions) }
}

function randomExploreMapParams() {
	const centers = [
		{ lat: 40.7128, lng: -74.0060 }, // NYC
		{ lat: 34.0522, lng: -118.2437 }, // LA
		{ lat: 41.8781, lng: -87.6298 }, // Chicago
		{ lat: 29.7604, lng: -95.3698 }, // Houston
		{ lat: 33.4484, lng: -112.0740 }, // Phoenix
		{ lat: 39.9526, lng: -75.1652 }, // Philadelphia
		{ lat: 32.7767, lng: -96.7970 }, // Dallas
		{ lat: 25.7617, lng: -80.1918 }, // Miami
	]
	const zooms = [10, 11, 12, 13, 14, 15]
	const sports = ['', 'soccer', 'basketball', 'football', 'baseball', 'volleyball', 'hockey']
	const levels = ['', 'youth', 'hs', 'college', 'semi-pro', 'pro', 'club']
	const orgTypes = ['', 'school', 'club', 'league', 'association']
	return {
		center: pick(centers),
		zoom: pick(zooms),
		sport: pick(sports),
		level: pick(levels),
		orgType: pick(orgTypes)
	}
}

function hashResults(results: any[]): string {
	// Simple hash based on place IDs and count
	const ids = results.map(r => r.placeId || r.id || '').sort().join(',')
	return `${results.length}:${ids.slice(0, 50)}`
}

export default function DebugDiscoverRecruiting() {
	const [target, setTarget] = useState<Target>('discover')
	const [running, setRunning] = useState(false)
	const [results, setResults] = useState<RunResult[]>([])
	const [discoverResults, setDiscoverResults] = useState<RunResult[]>([])
	const [recruitingResults, setRecruitingResults] = useState<RunResult[]>([])
	const [runId, setRunId] = useState(0)
	const controllersRef = useRef<AbortController[]>([])

	function cleanupControllers() {
		controllersRef.current.forEach(c => {
			try { c.abort() } catch {}
		})
		controllersRef.current = []
	}

	async function runOnce(t: Target): Promise<RunResult> {
		const requestId = generateRequestId()
		const ac = new AbortController()
		controllersRef.current.push(ac)
		const started = Date.now()
		try {
			if (t === 'discover') {
				const q = randomDiscoverQuery()
				Observability.log({ feature: 'discover', route: 'debug.burst', status: 'start', requestId, meta: q })
				const arr = await searchBusinesses({ term: q.term, location: q.location, limit: 10 }, { requestId, signal: ac.signal })
				const dur = Date.now() - started
				const empty = Array.isArray(arr) ? arr.length === 0 : true
				const hash = hashResults(arr || [])
				Observability.log({ feature: 'discover', route: 'debug.burst', status: empty ? 'empty' : 'ok', requestId, durationMs: dur })
				// eslint-disable-next-line no-console
				console.log(JSON.stringify({ harness: 'discover', requestId, durationMs: dur, count: Array.isArray(arr) ? arr.length : 0, hash }))
				return { requestId, ok: true, empty, durationMs: dur, resultHash: hash }
			} else if (t === 'recruiting') {
				const f = randomRecruitingFilters()
				Observability.log({ feature: 'recruitment', route: 'debug.burst', status: 'start', requestId, meta: f })
				const arr = await searchPrograms(f, { requestId, signal: ac.signal })
				const dur = Date.now() - started
				const empty = Array.isArray(arr) ? arr.length === 0 : true
				const hash = hashResults(arr || [])
				Observability.log({ feature: 'recruitment', route: 'debug.burst', status: empty ? 'empty' : 'ok', requestId, durationMs: dur })
				// eslint-disable-next-line no-console
				console.log(JSON.stringify({ harness: 'recruitment', requestId, durationMs: dur, count: Array.isArray(arr) ? arr.length : 0, hash }))
				return { requestId, ok: true, empty, durationMs: dur, resultHash: hash }
			} else {
				// explore_map: simulate Google Places API call
				const params = randomExploreMapParams()
				Observability.log({ feature: 'recruitment', route: 'debug.explore_map', status: 'start', requestId, meta: params })
				
				const google = await loadGoogleMaps()
				if (ac.signal.aborted) throw new Error('Aborted')
				if (!google?.maps?.places) throw new Error('Google Places not available')
				
				const svc = new google.maps.places.PlacesService(document.createElement('div'))
				const keyword = [params.sport, params.level, params.orgType].filter(Boolean).join(' ') || 'sports club OR athletics'
				
				const request: google.maps.places.TextSearchRequest = {
					query: keyword,
					location: new google.maps.LatLng(params.center.lat, params.center.lng),
					radius: params.zoom >= 15 ? 2000 : params.zoom >= 13 ? 5000 : params.zoom >= 11 ? 10000 : params.zoom >= 9 ? 20000 : params.zoom >= 7 ? 40000 : 60000
				}
				
				const results = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
					if (ac.signal.aborted) {
						reject(new Error('Aborted'))
						return
					}
					svc.textSearch(request, (res, status) => {
						if (ac.signal.aborted) {
							reject(new Error('Aborted'))
							return
						}
						if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(res)) {
							resolve(res)
						} else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
							resolve([])
						} else {
							reject(new Error(`Places textSearch failed: ${status}`))
						}
					})
				})
				
				const normalized = (results || []).map((p) => ({
					placeId: p.place_id || '',
					name: p.name || '',
					location: {
						lat: typeof p.geometry?.location?.lat === 'function' ? p.geometry.location.lat() : 0,
						lng: typeof p.geometry?.location?.lng === 'function' ? p.geometry.location.lng() : 0
					}
				})).filter(p => !!p.placeId)
				
				const dur = Date.now() - started
				const empty = normalized.length === 0
				const hash = hashResults(normalized)
				
				Observability.log({
					feature: 'recruitment',
					route: 'debug.explore_map',
					status: empty ? 'empty' : 'ok',
					requestId,
					durationMs: dur,
					meta: { count: normalized.length }
				})
				// eslint-disable-next-line no-console
				console.log(JSON.stringify({ harness: 'explore_map', requestId, durationMs: dur, count: normalized.length, hash }))
				return { requestId, ok: true, empty, durationMs: dur, resultHash: hash }
			}
		} catch (e: any) {
			const dur = Date.now() - started
			const cancelled = ac.signal.aborted
			const errName = cancelled ? 'AbortError' : (e?.name || 'Error')
			const errMsg = cancelled ? 'aborted' : (e?.message || String(e))
			const feature = t === 'discover' ? 'discover' : 'recruitment'
			Observability.log({
				feature,
				route: t === 'explore_map' ? 'debug.explore_map' : 'debug.burst',
				status: 'error',
				requestId,
				durationMs: dur,
				errorName: errName,
				errorMessage: errMsg
			})
			// eslint-disable-next-line no-console
			console.error(JSON.stringify({ harness: t, requestId, durationMs: dur, error: `${errName}: ${errMsg}` }))
			return { requestId, ok: false, durationMs: dur, errorName: errName, errorMessage: errMsg, cancelled }
		}
	}

	async function runSequential50() {
		setRunning(true)
		const myRun = runId + 1
		setRunId(myRun)
		setResults([])
		cleanupControllers()
		try {
			const local: RunResult[] = []
			for (let i = 0; i < 50; i++) {
				if (myRun !== runId + 1) break
				// eslint-disable-next-line no-await-in-loop
				const r = await runOnce(target)
				local.push(r)
				setResults([...local])
			}
			// Store results by target for metrics JSON
			if (target === 'discover') {
				setDiscoverResults([...local])
			} else if (target === 'recruiting') {
				setRecruitingResults([...local])
			}
		} finally {
			setRunning(false)
		}
	}

	async function runConcurrent20() {
		setRunning(true)
		const myRun = runId + 1
		setRunId(myRun)
		setResults([])
		cleanupControllers()
		try {
			const promises = Array.from({ length: 20 }).map(() => runOnce(target))
			const settled = await Promise.all(promises)
			setResults(settled)
			// Store results by target for metrics JSON
			if (target === 'discover') {
				setDiscoverResults(settled)
			} else if (target === 'recruiting') {
				setRecruitingResults(settled)
			}
		} finally {
			setRunning(false)
		}
	}

	// Convenience: run both features back-to-back
	async function runBothSequential50() {
		if (running) return
		const original = target
		await (async () => {
			setTarget('discover')
			await runSequential50()
		})()
		await (async () => {
			setTarget('recruiting')
			await runSequential50()
		})()
		setTarget(original)
	}

	async function runBothConcurrent20() {
		if (running) return
		const original = target
		await (async () => {
			setTarget('discover')
			await runConcurrent20()
		})()
		await (async () => {
			setTarget('recruiting')
			await runConcurrent20()
		})()
		setTarget(original)
	}

	function stopRun() {
		cleanupControllers()
		setRunning(false)
	}

	const summary = useMemo(() => {
		const finished = results.filter(r => !r.cancelled)
		const successes = finished.filter(r => r.ok)
		const failures = finished.filter(r => !r.ok)
		const latencies = successes.map(r => r.durationMs)
		const med = median(latencies)
		const p = p95(latencies)
		const errorCounts = new Map<string, number>()
		for (const f of failures) {
			const sig = `${f.errorName || 'Error'}: ${f.errorMessage || ''}`
			errorCounts.set(sig, (errorCounts.get(sig) || 0) + 1)
		}
		const topErrors = Array.from(errorCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
		
		// Hash instability check (for discover and recruiting to detect result inconsistency)
		const hashes = successes.map(r => r.resultHash).filter(Boolean) as string[]
		const uniqueHashes = new Set(hashes)
		// Inconsistency rate: fraction of results that are duplicates (same hash)
		// If all results have unique hashes, inconsistencyRate = 0
		// If all results have the same hash, inconsistencyRate = (hashes.length - 1) / hashes.length
		const inconsistencyRate = hashes.length > 0 ? (hashes.length - uniqueHashes.size) / hashes.length : undefined
		
		return {
			total: results.length,
			successes: successes.length,
			failures: failures.length,
			median: med,
			p95: p,
			topErrors,
			inconsistencyRate: (target === 'discover' || target === 'recruiting') ? inconsistencyRate : undefined,
			failureRate: results.length > 0 ? failures.length / results.length : 0
		}
	}, [results, target])

	// Compute full metrics JSON for Playwright scraping
	// This includes both discover and recruiting metrics when available
	const fullMetricsJson = useMemo(() => {
		const computeMetrics = (resultSet: RunResult[]) => {
			const finished = resultSet.filter(r => !r.cancelled)
			const successes = finished.filter(r => r.ok)
			const failures = finished.filter(r => !r.ok)
			const hashes = successes.map(r => r.resultHash).filter(Boolean) as string[]
			const uniqueHashes = new Set(hashes)
			const inconsistencyRate = hashes.length > 0 ? (hashes.length - uniqueHashes.size) / hashes.length : undefined
			
			return {
				failureRate: resultSet.length > 0 ? failures.length / resultSet.length : 0,
				inconsistencyRate
			}
		}
		
		const discoverMetrics = computeMetrics(discoverResults)
		const recruitingMetrics = computeMetrics(recruitingResults)
		
		return {
			discover: {
				failureRate: discoverMetrics.failureRate,
				inconsistencyRate: discoverMetrics.inconsistencyRate
			},
			recruiting: {
				failureRate: recruitingMetrics.failureRate,
				inconsistencyRate: recruitingMetrics.inconsistencyRate
			}
		}
	}, [discoverResults, recruitingResults])

	return (
		<div className="mx-auto max-w-3xl p-4 space-y-4">
			<div className="text-white text-xl font-semibold">Debug: Discover & Recruiting Harness</div>
			<div className="text-sm text-foreground/70">Dev-only. Randomizes queries, runs sequential or concurrent loads, aggregates outcomes and latencies. Explore Map test simulates rapid pan/zoom/filter changes.</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
				<div className="space-y-2">
					<div className="text-xs uppercase tracking-wide text-foreground/60">Target</div>
					<select
						className="bg-surface border border-border rounded-md px-2 py-2 text-sm"
						value={target}
						onChange={e => setTarget(e.target.value as Target)}
					>
						<option value="discover">Discover (Business API)</option>
						<option value="recruiting">Recruiting Finder (Programs API)</option>
						<option value="explore_map">Explore Map (Places API)</option>
					</select>
				</div>
				<div className="space-y-2">
					<div className="text-xs uppercase tracking-wide text-foreground/60">Actions</div>
					<div className="flex flex-wrap gap-2">
						<button className="px-3 py-2 rounded-md bg-amber-700 text-white disabled:opacity-50" onClick={runSequential50} disabled={running}>Run 50 sequential</button>
						<button className="px-3 py-2 rounded-md bg-amber-700 text-white disabled:opacity-50" onClick={runConcurrent20} disabled={running}>Run 20 concurrent</button>
						<button className="px-3 py-2 rounded-md bg-emerald-700 text-white disabled:opacity-50" onClick={runBothSequential50} disabled={running}>Both: 50 sequential each</button>
						<button className="px-3 py-2 rounded-md bg-emerald-700 text-white disabled:opacity-50" onClick={runBothConcurrent20} disabled={running}>Both: 20 concurrent each</button>
						<button className="px-3 py-2 rounded-md bg-gray-600 text-white" onClick={stopRun}>Cancel</button>
					</div>
				</div>
				<div className="space-y-2">
					<div className="text-xs uppercase tracking-wide text-foreground/60">Hints</div>
					<ul className="text-xs list-disc pl-5 text-foreground/70 space-y-1">
						<li>Use Diagnostics button (bottom-right) to correlate requestIds</li>
						<li>Check server logs for requestId-correlation</li>
					</ul>
				</div>
			</div>

			<div className="border border-border rounded-md p-3">
				<div className="font-medium text-white mb-2">Summary</div>
				<div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-sm">
					<div>Total: <span className="font-semibold">{summary.total}</span></div>
					<div>Success: <span className="font-semibold text-green-500">{summary.successes}</span></div>
					<div>Fail: <span className="font-semibold text-red-500">{summary.failures}</span></div>
					<div>
						Fail rate: <span 
							className="font-semibold"
							data-testid={target === 'discover' ? 'discover-failure-rate' : target === 'recruiting' ? 'recruiting-failure-rate' : undefined}
						>{summary.total > 0 ? `${Math.round((summary.failures / summary.total) * 100)}%` : '—'}</span>
					</div>
					<div>
						Inconsistency: <span 
							className="font-semibold"
							data-testid={target === 'discover' ? 'discover-inconsistency-rate' : target === 'recruiting' ? 'recruiting-inconsistency-rate' : undefined}
						>{summary.inconsistencyRate !== undefined ? `${Math.round(summary.inconsistencyRate * 100)}%` : '—'}</span>
					</div>
					<div>Median: <span className="font-semibold">{Math.round(summary.median)} ms</span></div>
					<div>P95: <span className="font-semibold">{Math.round(summary.p95)} ms</span></div>
					<div className="col-span-2 md:col-span-7">Errors: <span className="font-semibold">{summary.topErrors.map(([k, v]) => `${v}× ${k}`).join(' | ') || '—'}</span></div>
				</div>
			</div>

			<div className="border border-border rounded-md overflow-auto">
				<table className="w-full text-xs">
					<thead className="text-foreground/60">
						<tr>
							<th className="text-left px-2 py-1">ok</th>
							<th className="text-left px-2 py-1">duration</th>
							<th className="text-left px-2 py-1">empty</th>
							<th className="text-left px-2 py-1">hash</th>
							<th className="text-left px-2 py-1">error</th>
							<th className="text-left px-2 py-1">requestId</th>
						</tr>
					</thead>
					<tbody>
						{results.map((r, idx) => (
							<tr key={idx} className="border-t border-border">
								<td className="px-2 py-1">{r.ok ? '✓' : (r.cancelled ? 'cancel' : '✗')}</td>
								<td className="px-2 py-1">{Math.round(r.durationMs)} ms</td>
								<td className="px-2 py-1">{r.empty ? 'yes' : ''}</td>
								<td className="px-2 py-1"><code className="text-xs">{r.resultHash ? r.resultHash.slice(0, 20) : '—'}</code></td>
								<td className="px-2 py-1">{r.errorName ? `${r.errorName}: ${r.errorMessage}` : ''}</td>
								<td className="px-2 py-1"><code>{r.requestId}</code></td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Raw metrics JSON for Playwright scraping */}
			<div data-testid="harness-raw-metrics-json" style={{ display: 'none' }}>
				{JSON.stringify(fullMetricsJson, null, 2)}
			</div>
		</div>
	)
}

