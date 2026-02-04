/**
 * Shared Google Maps and Places API utilities
 * Single source of truth for Google Maps loading and Places service creation
 */

import { loadGoogleMaps, isGoogleMapsReady, getGoogleMapsStatus } from './loader'
import { hasGoogleMapsKey, assertGoogleMapsKey } from '../../config/env'

// Re-export core loading functions and config
export { loadGoogleMaps, isGoogleMapsReady, getGoogleMapsStatus, hasGoogleMapsKey }

/**
 * Create a PlacesService instance
 * Ensures Google Maps is loaded with Places library before creating the service
 */
export async function createPlacesService(): Promise<google.maps.places.PlacesService> {
	const google = await loadGoogleMaps()
	
	if (!google?.maps?.places) {
		throw new Error('Google Places API not available. Ensure libraries=places is loaded.')
	}
	
	// PlacesService requires a container element (can be invisible div)
	const container = document.createElement('div')
	return new google.maps.places.PlacesService(container)
}

/**
 * Perform a text search using Google Places API
 * Includes automatic retry logic for transient errors
 */
export async function textSearch(
	request: google.maps.places.TextSearchRequest,
	signal?: AbortSignal
): Promise<google.maps.places.PlaceResult[]> {
	const service = await createPlacesService()
	
	const attemptSearch = (tryNum: number): Promise<google.maps.places.PlaceResult[]> => {
		return new Promise((resolve, reject) => {
			if (signal?.aborted) {
				reject(new Error('Aborted'))
				return
			}
			
			service.textSearch(request, async (results, status) => {
				if (signal?.aborted) {
					reject(new Error('Aborted'))
					return
				}
				
				if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(results)) {
					resolve(results)
					return
				}
				
				if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
					resolve([])
					return
				}
				
				// Treat OVER_QUERY_LIMIT or UNKNOWN_ERROR as transient - retry with exponential backoff
				const transient = 
					status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT || 
					status === google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR
				
				if (transient && tryNum < 3) {
					const base = 250 * Math.pow(2, tryNum)
					const jitter = Math.floor(Math.random() * 100)
					setTimeout(() => {
						attemptSearch(tryNum + 1).then(resolve, reject)
					}, base + jitter)
					return
				}
				
				reject(new Error(`Places textSearch failed: ${status}`))
			})
		})
	}
	
	return attemptSearch(0)
}

/**
 * Get details for a specific place by ID
 */
export async function getPlaceDetails(
	placeId: string,
	fields?: string[],
	signal?: AbortSignal
): Promise<google.maps.places.PlaceResult | null> {
	const service = await createPlacesService()
	
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error('Aborted'))
			return
		}
		
		service.getDetails(
			{
				placeId,
				fields: fields || ['place_id', 'name', 'formatted_address', 'geometry', 'formatted_phone_number', 'website', 'opening_hours', 'url']
			},
			(result, status) => {
				if (signal?.aborted) {
					reject(new Error('Aborted'))
					return
				}
				
				if (status === google.maps.places.PlacesServiceStatus.OK && result) {
					resolve(result)
					return
				}
				
				if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
					resolve(null)
					return
				}
				
				reject(new Error(`Places getDetails failed: ${status}`))
			}
		)
	})
}

/**
 * Error messages for missing Google Maps API key
 */
export const GOOGLE_MAPS_ERROR_MESSAGES = {
	searchDisabled: 'Search disabled until Google Maps key is configured',
	keyRequired: (featureName: string) => 
		`${featureName} requires VITE_GOOGLE_MAPS_API_KEY to be configured`,
	contactAdmin: 'Google Maps is not configured. Contact your administrator.'
} as const

/**
 * Assert that Google Maps key is configured, throw if missing
 */
export function requireGoogleMapsKey(featureName: string): void {
	assertGoogleMapsKey(featureName)
}
