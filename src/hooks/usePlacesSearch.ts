import { useRef, useState, useCallback } from 'react'
import { placesProxySearch } from '../lib/google/placesProxy'
import { normalizeGoogleProxyError, isRetryable as isRetryableError } from '../lib/google/errors'
import Observability, { generateRequestId } from '../lib/obs'

export type NormalizedPlace = {
	placeId: string
	name: string
	formattedAddress?: string
	location: { lat: number, lng: number }
	rating?: number
	userRatingsTotal?: number
	types?: string[]
	photoUrl?: string
}

type SearchParams = {
	query: string
	locationText: string
	locationPlaceId?: string
	requestId?: string
}

type Return = {
	results: NormalizedPlace[]
	loading: boolean
	error: string | null
	isStale: boolean
	selected: NormalizedPlace | null
	setSelected: (p: NormalizedPlace | null) => void
	search: (params: SearchParams) => Promise<void>
	retry: () => void
}

/**
 * Manual search hook - only fires when explicitly called via search()
 * No auto-search on input changes
 */
export function usePlacesSearch(): Return {
	const [results, setResults] = useState<NormalizedPlace[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isStale, setIsStale] = useState(false)
	const [selected, setSelected] = useState<NormalizedPlace | null>(null)

	const requestTokenRef = useRef(0)
	const lastGoodRef = useRef<NormalizedPlace[] | null>(null)
	const controllerRef = useRef<AbortController | null>(null)
	const lastParamsRef = useRef<SearchParams | null>(null)

	const search = useCallback(async (params: SearchParams) => {
		// Normalize params
		const query = (params.query || '').trim()
		const locationText = (params.locationText || '').trim()
		
		// Client-side validation - don't call server if invalid
		if (!query || query.length < 2) {
			setError('Enter a search term (at least 2 characters)')
			setResults([])
			setSelected(null)
			return
		}
		
		if (!locationText) {
			setError('Enter a location')
			setResults([])
			setSelected(null)
			return
		}
		
		// Store params for retry
		lastParamsRef.current = params
		
		// Cancel any in-flight request (single-flight enforcement)
		if (controllerRef.current) {
			try { 
				controllerRef.current.abort() 
			} catch (err) {
				// Ignore abort errors
			}
		}
		
		const ac = new AbortController()
		controllerRef.current = ac
		const token = ++requestTokenRef.current
		
		setLoading(true)
		setError(null)
		setIsStale(false)
		
		try {
			const reqId = params.requestId || generateRequestId()

			// DETERMINISTIC: All search traffic goes through server proxy ONLY
			// NO fallback to Google Maps JS SDK on error
			// Call server-side proxy
			const proxyResult = await placesProxySearch(
				{
					q: query,
					location: locationText,
					radius: 20000
				},
				{
					signal: ac.signal,
					requestId: reqId,
					feature: 'discover',
					userAction: 'search'
				}
			)

			// Token gating: ignore if not latest request
			if (ac.signal.aborted || token !== requestTokenRef.current) return

			// Convert proxy results to NormalizedPlace format
			const normalized: NormalizedPlace[] = proxyResult.results.map((p) => ({
				placeId: p.placeId,
				name: p.name,
				formattedAddress: p.formattedAddress,
				location: p.location,
				rating: p.rating,
				userRatingsTotal: p.userRatingsTotal,
				types: p.types,
				photoUrl: undefined // Photos require Maps JS
			}))

			// Final token check
			if (token !== requestTokenRef.current) return

			setResults(normalized)
			lastGoodRef.current = normalized
			setSelected(normalized[0] || null)
			setError(null)
		} catch (e: any) {
			// Ignore aborted requests
			if (ac.signal.aborted || e?.name === 'AbortError' || token !== requestTokenRef.current) return
			
			const hasLastGood = lastGoodRef.current && lastGoodRef.current.length > 0
			
			// Normalize error
			const normalized = e?.normalized ? e.normalized : normalizeGoogleProxyError({
				code: e?.code,
				userMessage: e?.message,
				devDetails: e?.stack || e?.message || String(e)
			})
			
			// Resilience: show last known good with stale banner for retryable errors
			if (hasLastGood && isRetryableError(normalized.code)) {
				setIsStale(true)
				setError(normalized.userMessage)
				// Keep showing last known good results
			} else {
				setError(normalized.userMessage)
				setResults([])
				setSelected(null)
			}
		} finally {
			// Only clear loading if this is the latest request
			if (token === requestTokenRef.current) {
				setLoading(false)
			}
		}
	}, [])

	const retry = useCallback(() => {
		if (lastParamsRef.current) {
			search(lastParamsRef.current)
		}
	}, [search])

	return { results, loading, error, isStale, selected, setSelected, search, retry }
}


