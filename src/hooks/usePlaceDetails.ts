import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps, getPlaceDetails, hasGoogleMapsKey } from '../lib/google/maps'
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

		if (!placeId) {
			setDetails(null)
			setLoading(false)
			setError(null)
			return
		}

		// Early return if Google Maps API key is not configured
		if (!hasGoogleMapsKey) {
			setDetails(null)
			setLoading(false)
			setError(null)
			return
		}

		async function run() {
			setLoading(true)
			setError(null)
			const myId = ++requestIdRef.current
			try {
				// Ensure Google Maps is loaded
				await loadGoogleMaps()
				if (ac.signal.aborted || myId !== requestIdRef.current) return
				
				// Get place details using shared utility
				const fields = ['place_id', 'name', 'formatted_address', 'formatted_phone_number', 'international_phone_number', 'website', 'opening_hours', 'url']
				const res = await getPlaceDetails(placeId!, fields, ac.signal)
				
				if (ac.signal.aborted || myId !== requestIdRef.current) return
				
				if (res) {
					const d: Details = {
						placeId: res.place_id!,
						name: res.name,
						formattedAddress: res.formatted_address,
						phone: res.formatted_phone_number || res.international_phone_number,
						website: res.website || undefined,
						openingHours: res.opening_hours?.weekday_text || undefined,
						googleMapsUrl: res.url || undefined
					}
					setDetails(d)
				} else {
					setDetails(null)
				}
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
		
		// Cleanup: abort on unmount or when placeId changes
		return () => {
			if (controllerRef.current) {
				try { 
					controllerRef.current.abort() 
				} catch (err) {
					// Ignore abort errors
				}
			}
		}
	}, [placeId])

	return { details, loading, error }
}


