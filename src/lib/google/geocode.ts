/**
 * Google Geocoding API wrappers with observability and abort safety
 */

import { loadGoogleMaps } from './loader'
import { 
	logGoogleStart, 
	logGoogleSuccess, 
	logGoogleError,
	GoogleError,
	GoogleFeature,
	GoogleStatusString,
	statusToCode,
	startTimer
} from './telemetry'

export type GeocodeResult = {
	lat: number
	lng: number
	formattedAddress?: string
}

export type GeocodeContext = {
	feature: GoogleFeature
	requestId?: string
	userId?: string | null
	userAction?: string
	locationText?: string
}

/**
 * Forward geocode: convert address string to lat/lng
 * Abort-safe: checks signal before and after async operations
 */
export async function geocodeAddress(
	address: string,
	signal?: AbortSignal,
	ctx?: GeocodeContext
): Promise<GeocodeResult | null> {
	const timer = startTimer()
	const feature = ctx?.feature || 'discover'
	const requestId = ctx?.requestId || logGoogleStart({
		feature,
		operation: 'geocode.forward',
		locationText: address,
		userAction: ctx?.userAction || 'geocode_address',
		userId: ctx?.userId
	})
	
	try {
		const google = await loadGoogleMaps()
		
		if (signal?.aborted) {
			// Don't log aborts as errors
			throw new Error('Aborted')
		}
		
		const geocoder = new google.maps.Geocoder()
		
		const result = await new Promise<GeocodeResult | null>((resolve, reject) => {
			if (signal?.aborted) {
				reject(new Error('Aborted'))
				return
			}
			
			geocoder.geocode({ address }, (results, status) => {
				if (signal?.aborted) {
					reject(new Error('Aborted'))
					return
				}
				
				const googleStatus = status as GoogleStatusString
				
				if (status === 'OK' && results && results[0]?.geometry?.location) {
					const location = results[0].geometry.location
					const lat = typeof location.lat === 'function' ? location.lat() : location.lat
					const lng = typeof location.lng === 'function' ? location.lng() : location.lng
					resolve({
						lat,
						lng,
						formattedAddress: results[0].formatted_address
					})
				} else if (status === 'ZERO_RESULTS') {
					resolve(null)
				} else {
					const err = new GoogleError(
						`Geocoding failed: ${status}`,
						'geocode.forward',
						{
							googleStatus,
							retryable: googleStatus === 'OVER_QUERY_LIMIT' || googleStatus === 'UNKNOWN_ERROR',
							statusCode: statusToCode(googleStatus),
							requestId
						}
					)
					reject(err)
				}
			})
		})
		
		const durationMs = timer()
		
		logGoogleSuccess(
			{
				feature,
				operation: 'geocode.forward',
				requestId,
				locationText: address,
				userAction: ctx?.userAction || 'geocode_address',
				userId: ctx?.userId
			},
			{
				count: result ? 1 : 0,
				googleStatus: result ? 'OK' : 'ZERO_RESULTS',
				durationMs
			}
		)
		
		return result
	} catch (error) {
		// Don't log abort as error
		if (error instanceof Error && error.message === 'Aborted') {
			throw error
		}
		
		const durationMs = timer()
		
		if (error instanceof GoogleError) {
			logGoogleError(
				{
					feature,
					operation: 'geocode.forward',
					requestId,
					locationText: address,
					userAction: ctx?.userAction || 'geocode_address',
					userId: ctx?.userId
				},
				{
					message: error.message,
					name: error.name,
					googleStatus: error.googleStatus,
					statusCode: error.statusCode,
					retryable: error.retryable,
					durationMs
				}
			)
		} else {
			logGoogleError(
				{
					feature,
					operation: 'geocode.forward',
					requestId,
					locationText: address,
					userAction: ctx?.userAction || 'geocode_address',
					userId: ctx?.userId
				},
				{
					message: error instanceof Error ? error.message : String(error),
					name: error instanceof Error ? error.name : 'Error',
					durationMs
				}
			)
		}
		
		throw error
	}
}

/**
 * Reverse geocode: convert lat/lng to address
 * Abort-safe: checks signal before and after async operations
 */
export async function reverseGeocode(
	lat: number,
	lng: number,
	signal?: AbortSignal,
	ctx?: GeocodeContext
): Promise<string | null> {
	const timer = startTimer()
	const feature = ctx?.feature || 'discover'
	const requestId = ctx?.requestId || logGoogleStart({
		feature,
		operation: 'geocode.reverse',
		userAction: ctx?.userAction || 'reverse_geocode',
		userId: ctx?.userId
	})
	
	try {
		const google = await loadGoogleMaps()
		
		if (signal?.aborted) {
			// Don't log aborts as errors
			throw new Error('Aborted')
		}
		
		const geocoder = new google.maps.Geocoder()
		
		const result = await new Promise<string | null>((resolve, reject) => {
			if (signal?.aborted) {
				reject(new Error('Aborted'))
				return
			}
			
			geocoder.geocode({ location: { lat, lng } }, (results, status) => {
				if (signal?.aborted) {
					reject(new Error('Aborted'))
					return
				}
				
				const googleStatus = status as GoogleStatusString
				
				if (status === 'OK' && results && results[0]) {
					resolve(results[0].formatted_address || null)
				} else if (status === 'ZERO_RESULTS') {
					resolve(null)
				} else {
					const err = new GoogleError(
						`Reverse geocoding failed: ${status}`,
						'geocode.reverse',
						{
							googleStatus,
							retryable: googleStatus === 'OVER_QUERY_LIMIT' || googleStatus === 'UNKNOWN_ERROR',
							statusCode: statusToCode(googleStatus),
							requestId
						}
					)
					reject(err)
				}
			})
		})
		
		const durationMs = timer()
		
		logGoogleSuccess(
			{
				feature,
				operation: 'geocode.reverse',
				requestId,
				userAction: ctx?.userAction || 'reverse_geocode',
				userId: ctx?.userId
			},
			{
				count: result ? 1 : 0,
				googleStatus: result ? 'OK' : 'ZERO_RESULTS',
				durationMs
			}
		)
		
		return result
	} catch (error) {
		// Don't log abort as error
		if (error instanceof Error && error.message === 'Aborted') {
			throw error
		}
		
		const durationMs = timer()
		
		if (error instanceof GoogleError) {
			logGoogleError(
				{
					feature,
					operation: 'geocode.reverse',
					requestId,
					userAction: ctx?.userAction || 'reverse_geocode',
					userId: ctx?.userId
				},
				{
					message: error.message,
					name: error.name,
					googleStatus: error.googleStatus,
					statusCode: error.statusCode,
					retryable: error.retryable,
					durationMs
				}
			)
		} else {
			logGoogleError(
				{
					feature,
					operation: 'geocode.reverse',
					requestId,
					userAction: ctx?.userAction || 'reverse_geocode',
					userId: ctx?.userId
				},
				{
					message: error instanceof Error ? error.message : String(error),
					name: error instanceof Error ? error.name : 'Error',
					durationMs
				}
			)
		}
		
		throw error
	}
}
