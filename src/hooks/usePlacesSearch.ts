import { useEffect, useMemo, useRef, useState } from 'react'
import { loadGoogleMaps } from '../lib/googleMapsLoader'

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
}

type Return = {
	results: NormalizedPlace[]
	loading: boolean
	error: string | null
	selected: NormalizedPlace | null
	setSelected: (p: NormalizedPlace | null) => void
}

export function usePlacesSearch(input: Input): Return {
	const [results, setResults] = useState<NormalizedPlace[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [selected, setSelected] = useState<NormalizedPlace | null>(null)

	const requestIdRef = useRef(0)

	const normalizedInput = useMemo(() => ({
		query: (input.query || '').trim(),
		locationText: (input.locationText || '').trim(),
		locationPlaceId: input.locationPlaceId
	}), [input.query, input.locationText, input.locationPlaceId])

	useEffect(() => {
		let cancelled = false
		const hasQuery = normalizedInput.query.length > 0
		const hasWhere = normalizedInput.locationText.length > 0 || !!normalizedInput.locationPlaceId
		if (!hasQuery || !hasWhere) {
			setResults([])
			setSelected(null)
			return
		}

		async function run() {
			setLoading(true)
			setError(null)
			const myId = ++requestIdRef.current
			try {
				const google = await loadGoogleMaps()
				if (cancelled) return

				let originLatLng: google.maps.LatLng | null = null

				// Resolve the location to a lat/lng using PlaceId or Geocoding
				if (normalizedInput.locationPlaceId) {
					originLatLng = await new Promise<google.maps.LatLng | null>((resolve) => {
						const svc = new google.maps.places.PlacesService(document.createElement('div'))
						svc.getDetails({ placeId: normalizedInput.locationPlaceId!, fields: ['geometry'] }, (place, status) => {
							if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
								resolve(place.geometry.location)
							} else {
								resolve(null)
							}
						})
					})
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

				if (cancelled || myId !== requestIdRef.current) return

				// Perform text search
				const textSearchResults = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
					const svc = new google.maps.places.PlacesService(document.createElement('div'))
					const request: google.maps.places.TextSearchRequest = {
						query: normalizedInput.query
					}
					if (originLatLng) {
						request.location = originLatLng
						request.radius = 20000 // 20km default
					}
					svc.textSearch(request, (res, status) => {
						if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(res)) {
							resolve(res)
						} else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
							resolve([])
						} else {
							reject(new Error(`Places textSearch failed: ${status}`))
						}
					})
				})

				if (cancelled || myId !== requestIdRef.current) return

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

				setResults(normalized)
				setSelected(normalized[0] || null)
			} catch (e: any) {
				if (!cancelled) {
					setError(e?.message || 'Search failed')
					setResults([])
					setSelected(null)
				}
			} finally {
				if (!cancelled) setLoading(false)
			}
		}

		run()
		return () => {
			cancelled = true
		}
	}, [normalizedInput.query, normalizedInput.locationText, normalizedInput.locationPlaceId])

	return { results, loading, error, selected, setSelected }
}


