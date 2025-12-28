import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../lib/googleMapsLoader'

type Details = {
	placeId: string
	name?: string
	formattedAddress?: string
	phone?: string
	website?: string
	openingHours?: string[]
	googleMapsUrl?: string
}

type Return = {
	details: Details | null
	loading: boolean
	error: string | null
}

export function usePlaceDetails(placeId: string | undefined): Return {
	const [details, setDetails] = useState<Details | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const requestIdRef = useRef(0)

	useEffect(() => {
		let cancelled = false
		if (!placeId) {
			setDetails(null)
			return
		}
		async function run() {
			setLoading(true)
			setError(null)
			const myId = ++requestIdRef.current
			try {
				const google = await loadGoogleMaps()
				if (cancelled || myId !== requestIdRef.current) return
				const svc = new google.maps.places.PlacesService(document.createElement('div'))
				await new Promise<void>((resolve, reject) => {
					svc.getDetails(
						{
							placeId: placeId!,
							fields: ['place_id', 'name', 'formatted_address', 'formatted_phone_number', 'international_phone_number', 'website', 'opening_hours', 'url']
						},
						(res: any, status: any) => {
							if (status === google.maps.places.PlacesServiceStatus.OK && res) {
								const d: Details = {
									placeId: res.place_id,
									name: res.name,
									formattedAddress: res.formatted_address,
									phone: res.formatted_phone_number || res.international_phone_number,
									website: res.website || undefined,
									openingHours: res.opening_hours?.weekday_text || undefined,
									googleMapsUrl: res.url || undefined
								}
								setDetails(d)
								resolve()
							} else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
								setDetails(null)
								resolve()
							} else {
								reject(new Error(`Places getDetails failed: ${status}`))
							}
						}
					)
				})
			} catch (e: any) {
				if (!cancelled) {
					setError(e?.message || 'Failed to load details')
					setDetails(null)
				}
			} finally {
				if (!cancelled) setLoading(false)
			}
		}
		run()
		return () => {
			cancelled = true
		}
	}, [placeId])

	return { details, loading, error }
}


