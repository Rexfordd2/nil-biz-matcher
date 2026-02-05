import { useEffect, useMemo, useRef, useState } from 'react'
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

type Input = {
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
	retry: () => void
}

export function usePlacesSearch(input: Input): Return {
	const [results, setResults] = useState<NormalizedPlace[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isStale, setIsStale] = useState(false)
	const [selected, setSelected] = useState<NormalizedPlace | null>(null)

	const requestIdRef = useRef(0)
	const lastRequestId = useRef<string | undefined>(undefined)
	const lastGoodRef = useRef<NormalizedPlace[] | null>(null)
	const rerunFlagRef = useRef(0)
	const controllerRef = useRef<AbortController | null>(null)

	const normalizedInput = useMemo(() => ({
		query: (input.query || '').trim(),
		locationText: (input.locationText || '').trim(),
		locationPlaceId: input.locationPlaceId,
		requestId: input.requestId
	}), [input.query, input.locationText, input.locationPlaceId, input.requestId, rerunFlagRef.current])

	useEffect(() => {
		// Cancel any in-flight request before starting a new one
		if (controllerRef.current) {
			try { 
				controllerRef.current.abort() 
			} catch (err) {
				// Ignore abort errors
			}
		}
		const ac = new AbortController()
		controllerRef.current = ac

		const hasQuery = normalizedInput.query.length > 0
		const hasWhere = normalizedInput.locationText.length > 0 || !!normalizedInput.locationPlaceId
		if (!hasQuery || !hasWhere) {
			setResults([])
			setSelected(null)
			setLoading(false)
			return
		}

		async function run() {
			setLoading(true)
			setError(null)
			setIsStale(false)
			const myId = ++requestIdRef.current
			
			try {
				const reqId = normalizedInput.requestId || generateRequestId()
				lastRequestId.current = reqId

				// Call server-side proxy (no Google JS required)
				const proxyResult = await placesProxySearch(
					{
						q: normalizedInput.query,
						location: normalizedInput.locationText, // Proxy handles geocoding
						radius: 20000
					},
					{
						signal: ac.signal,
						requestId: reqId,
						feature: 'discover',
						userAction: 'search'
					}
				)

				if (ac.signal.aborted || myId !== requestIdRef.current) return

				// Convert proxy results to NormalizedPlace format
				// Note: photoUrl requires Google Maps JS to call getUrl(), so we skip it when using proxy
				const normalized: NormalizedPlace[] = proxyResult.results.map((p) => ({
					placeId: p.placeId,
					name: p.name,
					formattedAddress: p.formattedAddress,
					location: p.location,
					rating: p.rating,
					userRatingsTotal: p.userRatingsTotal,
					types: p.types,
					photoUrl: undefined // Photos require Maps JS; omit when using proxy
				}))

				if (ac.signal.aborted || myId !== requestIdRef.current) return

				setResults(normalized)
				lastGoodRef.current = normalized
				setSelected(normalized[0] || null)
			} catch (e: any) {
				// Ignore abortion as error - don't set error state for aborted requests
				if (ac.signal.aborted || e?.message === 'Aborted' || e?.name === 'AbortError' || myId !== requestIdRef.current) return
				
				const hasLastGood = lastGoodRef.current && lastGoodRef.current.length > 0
				
				// Check if error has normalized proxy error info
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
				if (myId === requestIdRef.current) setLoading(false)
			}
		}

		run()
		
		// Cleanup: abort on unmount or when dependencies change
		return () => {
			if (controllerRef.current) {
				try { 
					controllerRef.current.abort() 
				} catch (err) {
					// Ignore abort errors
				}
			}
		}
	}, [normalizedInput.query, normalizedInput.locationText, normalizedInput.locationPlaceId])

	function retry() {
		rerunFlagRef.current++
		// Trigger effect by referencing rerun flag through normalizedInput deps
	}

	return { results, loading, error, isStale, selected, setSelected, retry }
}


