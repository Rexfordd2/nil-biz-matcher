/**
 * Shared Google Maps and Places API utilities
 * Single source of truth for Google Maps loading and Places service creation
 */

import { loadGoogleMaps, isGoogleMapsReady, getGoogleMapsStatus } from './loader'
import { hasGoogleMapsKey, assertGoogleMapsKey } from '../../config/env'
import { 
	logGoogleStart, 
	logGoogleSuccess, 
	logGoogleError, 
	GoogleError,
	GoogleFeature,
	GoogleStatusString,
	isRetryableStatus,
	statusToCode,
	startTimer
} from './telemetry'

// Re-export core loading functions and config
export { loadGoogleMaps, isGoogleMapsReady, getGoogleMapsStatus, hasGoogleMapsKey }

export type GoogleCallContext = {
	feature: GoogleFeature
	requestId?: string
	userId?: string | null
	userAction?: string
	query?: string
	locationText?: string
	placeId?: string
}

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
	signal?: AbortSignal,
	ctx?: GoogleCallContext
): Promise<google.maps.places.PlaceResult[]> {
	const timer = startTimer()
	const feature = ctx?.feature || 'discover'
	const requestId = ctx?.requestId || logGoogleStart({
		feature,
		operation: 'places.textSearch',
		userAction: ctx?.userAction,
		query: ctx?.query || request.query,
		locationText: ctx?.locationText,
		userId: ctx?.userId
	})
	
	const service = await createPlacesService()
	
	const attemptSearch = (tryNum: number): Promise<google.maps.places.PlaceResult[]> => {
		return new Promise((resolve, reject) => {
			if (signal?.aborted) {
				// Don't log aborts as errors - they're intentional cancellations
				reject(new Error('Aborted'))
				return
			}
			
			service.textSearch(request, async (results, status) => {
				if (signal?.aborted) {
					reject(new Error('Aborted'))
					return
				}
				
				const googleStatus = status as GoogleStatusString
				
				if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(results)) {
					const durationMs = timer()
					logGoogleSuccess(
						{ 
							feature, 
							operation: 'places.textSearch', 
							requestId,
							userAction: ctx?.userAction,
							query: ctx?.query || request.query,
							locationText: ctx?.locationText,
							userId: ctx?.userId
						},
						{ 
							count: results.length, 
							googleStatus: 'OK',
							durationMs
						}
					)
					resolve(results)
					return
				}
				
				if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
					const durationMs = timer()
					logGoogleSuccess(
						{ 
							feature, 
							operation: 'places.textSearch', 
							requestId,
							userAction: ctx?.userAction,
							query: ctx?.query || request.query,
							locationText: ctx?.locationText,
							userId: ctx?.userId
						},
						{ 
							count: 0, 
							googleStatus: 'ZERO_RESULTS',
							durationMs
						}
					)
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
				
				const durationMs = timer()
				const err = new GoogleError(
					`Places textSearch failed: ${status}`,
					'places.textSearch',
					{
						googleStatus,
						retryable: isRetryableStatus(googleStatus),
						statusCode: statusToCode(googleStatus),
						requestId
					}
				)
				
				logGoogleError(
					{ 
						feature, 
						operation: 'places.textSearch', 
						requestId,
						userAction: ctx?.userAction,
						query: ctx?.query || request.query,
						locationText: ctx?.locationText,
						userId: ctx?.userId
					},
					{
						message: err.message,
						name: err.name,
						googleStatus,
						statusCode: statusToCode(googleStatus),
						retryable: isRetryableStatus(googleStatus),
						durationMs
					}
				)
				
				reject(err)
			})
		})
	}
	
	try {
		return await attemptSearch(0)
	} catch (error) {
		// Only log non-abort errors
		if (error instanceof Error && error.message !== 'Aborted') {
			throw error
		}
		// Re-throw abort without logging
		throw error
	}
}

/**
 * Get details for a specific place by ID
 */
export async function getPlaceDetails(
	placeId: string,
	fields?: string[],
	signal?: AbortSignal,
	ctx?: GoogleCallContext
): Promise<google.maps.places.PlaceResult | null> {
	const timer = startTimer()
	const feature = ctx?.feature || 'discover'
	const requestId = ctx?.requestId || logGoogleStart({
		feature,
		operation: 'places.getDetails',
		placeId,
		userAction: ctx?.userAction,
		userId: ctx?.userId
	})
	
	const service = await createPlacesService()
	
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			// Don't log aborts as errors - they're intentional cancellations
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
				
				const googleStatus = status as GoogleStatusString
				const durationMs = timer()
				
				if (status === google.maps.places.PlacesServiceStatus.OK && result) {
					logGoogleSuccess(
						{ 
							feature, 
							operation: 'places.getDetails', 
							requestId,
							placeId,
							userAction: ctx?.userAction,
							userId: ctx?.userId
						},
						{ 
							count: 1, 
							googleStatus: 'OK',
							durationMs
						}
					)
					resolve(result)
					return
				}
				
				if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS || 
					status === google.maps.places.PlacesServiceStatus.NOT_FOUND) {
					logGoogleSuccess(
						{ 
							feature, 
							operation: 'places.getDetails', 
							requestId,
							placeId,
							userAction: ctx?.userAction,
							userId: ctx?.userId
						},
						{ 
							count: 0, 
							googleStatus: googleStatus === 'NOT_FOUND' ? 'NOT_FOUND' : 'ZERO_RESULTS',
							durationMs
						}
					)
					resolve(null)
					return
				}
				
				const err = new GoogleError(
					`Places getDetails failed: ${status}`,
					'places.getDetails',
					{
						googleStatus,
						retryable: isRetryableStatus(googleStatus),
						statusCode: statusToCode(googleStatus),
						requestId
					}
				)
				
				logGoogleError(
					{ 
						feature, 
						operation: 'places.getDetails', 
						requestId,
						placeId,
						userAction: ctx?.userAction,
						userId: ctx?.userId
					},
					{
						message: err.message,
						name: err.name,
						googleStatus,
						statusCode: statusToCode(googleStatus),
						retryable: isRetryableStatus(googleStatus),
						durationMs
					}
				)
				
				reject(err)
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
