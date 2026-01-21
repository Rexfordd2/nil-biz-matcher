import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../lib/googleMapsLoader'
import { normalizeError, getUserErrorMessage } from '../lib/errorHandling'

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
	const controllerRef = useRef<AbortController | null>(null)

	useEffect(() => {
		// Cancel any in-flight request
		try { controllerRef.current?.abort() } catch {}
		const ac = new AbortController()
		controllerRef.current = ac

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
				if (ac.signal.aborted || myId !== requestIdRef.current) return
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
								if (!ac.signal.aborted && myId === requestIdRef.current) {
									setDetails(d)
								}
								resolve()
							} else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
								if (!ac.signal.aborted && myId === requestIdRef.current) {
									setDetails(null)
								}
								resolve()
							} else {
								reject(new Error(`Places getDetails failed: ${status}`))
							}
						}
					)
				})
			} catch (e: any) {
				// Ignore abortion as error - don't set error state for aborted requests
				if (ac.signal.aborted || myId !== requestIdRef.current) return
				const normalized = normalizeError(e)
				setError(getUserErrorMessage(normalized, false))
				setDetails(null)
			} finally {
				// Only clear loading if this is the latest request
				if (myId === requestIdRef.current) setLoading(false)
			}
		}
		run()
		return () => {
			try { controllerRef.current?.abort() } catch {}
		}
	}, [placeId])

	return { details, loading, error }
}


