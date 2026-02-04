import { useEffect, useMemo, useRef, useState } from 'react'
import { loadGoogleMaps, textSearch, getPlaceDetails, hasGoogleMapsKey } from '../lib/google/maps'
import Observability, { generateRequestId } from '../lib/obs'
import { normalizeError, getUserErrorMessage, shouldShowCachedWithRetry, shouldPreserveState } from '../lib/errorHandling'

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
		// Cancel any in-flight request
		try { controllerRef.current?.abort() } catch {}
		const ac = new AbortController()
		controllerRef.current = ac

		const hasQuery = normalizedInput.query.length > 0
		const hasWhere = normalizedInput.locationText.length > 0 || !!normalizedInput.locationPlaceId
		if (!hasQuery || !hasWhere) {
			setResults([])
			setSelected(null)
			return
		}

		// Early return if Google Maps API key is not configured
		if (!hasGoogleMapsKey) {
			setResults([])
			setSelected(null)
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
				Observability.log({ feature: 'discover', route: 'google.places', status: 'start', requestId: reqId })

				const google = await loadGoogleMaps()
				if (ac.signal.aborted || myId !== requestIdRef.current) return

				let originLatLng: google.maps.LatLng | null = null

				// Resolve the location to a lat/lng using PlaceId or Geocoding
				if (normalizedInput.locationPlaceId) {
					const place = await getPlaceDetails(normalizedInput.locationPlaceId, ['geometry'], ac.signal)
					if (place?.geometry?.location) {
						originLatLng = place.geometry.location
					}
				} else if (normalizedInput.locationText) {
					originLatLng = await new Promise<google.maps.LatLng | null>((resolve) => {
						const geocoder = new google.maps.Geocoder()
						geocoder.geocode({ address: normalizedInput.locationText }, (res, status) => {
							if (status === 'OK' && res && res[0]?.geometry?.location) {
								resolve(res[0].geometry.location)
							} else {
								resolve(null)
							}
						})
					})
				}

				if (ac.signal.aborted || myId !== requestIdRef.current) return

				// Perform text search using shared utility (includes retry logic)
				const request: google.maps.places.TextSearchRequest = { query: normalizedInput.query }
				if (originLatLng) {
					request.location = originLatLng
					request.radius = 20000
				}
				
				const textSearchResults = await textSearch(request, ac.signal)

				if (ac.signal.aborted || myId !== requestIdRef.current) return

				const normalized: NormalizedPlace[] = (textSearchResults || []).map((p) => {
					const lat = typeof p.geometry?.location?.lat === 'function' ? p.geometry.location.lat() : undefined
					const lng = typeof p.geometry?.location?.lng === 'function' ? p.geometry.location.lng() : undefined
					const photoUrl = p.photos && p.photos[0] ? p.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 }) : undefined
					return {
						placeId: p.place_id!,
						name: p.name || '',
						formattedAddress: p.formatted_address,
						location: { lat: lat ?? 0, lng: lng ?? 0 },
						rating: p.rating,
						userRatingsTotal: p.user_ratings_total as number | undefined,
						types: p.types,
						photoUrl
					}
				}).filter(p => !!p.placeId && typeof p.location.lat === 'number' && typeof p.location.lng === 'number')

				if (ac.signal.aborted || myId !== requestIdRef.current) return

				setResults(normalized)
				lastGoodRef.current = normalized
				setSelected(normalized[0] || null)

				Observability.log({
					feature: 'discover',
					route: 'google.places',
					status: 'validation_ok',
					requestId: lastRequestId.current,
					meta: { count: normalized.length }
				})
				Observability.log({
					feature: 'discover',
					route: 'google.places',
					status: normalized.length === 0 ? 'empty' : 'ok',
					requestId: lastRequestId.current
				})
			} catch (e: any) {
				// Ignore abortion as error - don't set error state for aborted requests
				if (ac.signal.aborted || myId !== requestIdRef.current) return
				
				const normalized = normalizeError(e, lastRequestId.current)
				const hasLastGood = lastGoodRef.current && lastGoodRef.current.length > 0
				
				// Resilience: show last known good with stale banner for transient errors
				if (hasLastGood && shouldShowCachedWithRetry(normalized)) {
					setIsStale(true)
					setError(getUserErrorMessage(normalized, true))
					// Keep showing last known good results
				} else {
					// For validation errors, preserve state (don't clear results)
					if (shouldPreserveState(normalized)) {
						setError(getUserErrorMessage(normalized, false))
						// Don't clear results for validation errors
					} else {
						setError(getUserErrorMessage(normalized, false))
						setResults([])
						setSelected(null)
					}
				}
				
				Observability.log({
					feature: 'discover',
					route: 'google.places',
					status: 'error',
					requestId: lastRequestId.current,
					errorName: e?.name,
					errorMessage: e?.message,
					errorStack: e?.stack,
					meta: {
						errorKind: normalized.kind,
						statusCode: normalized.statusCode
					}
				})
			} finally {
				// Only clear loading if this is the latest request
				if (myId === requestIdRef.current) setLoading(false)
			}
		}

		run()
		return () => {
			try { controllerRef.current?.abort() } catch {}
		}
	}, [normalizedInput.query, normalizedInput.locationText, normalizedInput.locationPlaceId])

	function retry() {
		rerunFlagRef.current++
		// Trigger effect by referencing rerun flag through normalizedInput deps
	}

	return { results, loading, error, isStale, selected, setSelected, retry }
}


