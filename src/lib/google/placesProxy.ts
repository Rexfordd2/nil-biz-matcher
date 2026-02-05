/**
 * Client-side helper for Google Places proxy API
 * Routes searches through server-side endpoint
 */

import Observability, { generateRequestId } from '../obs'
import { normalizeGoogleProxyError, type NormalizedProxyError } from './errors'

export type PlacesProxyResult = {
	placeId: string
	name: string
	formattedAddress?: string
	location: { lat: number; lng: number }
	rating?: number
	userRatingsTotal?: number
	types?: string[]
	photoReference?: string
}

export type PlacesProxySearchParams = {
	q: string
	location?: string // "lat,lng" or address text
	radius?: number // meters
}

export type PlacesProxySearchOptions = {
	signal?: AbortSignal
	requestId?: string
	feature?: 'discover' | 'recruiting'
	userAction?: string
}

export type PlacesProxySearchResult = {
	results: PlacesProxyResult[]
	cached: boolean
	ts: string
	requestId: string
	durationMs?: number
}

/**
 * Search places via server-side proxy
 */
export async function placesProxySearch(
	params: PlacesProxySearchParams,
	options?: PlacesProxySearchOptions
): Promise<PlacesProxySearchResult> {
	const feature = options?.feature || 'discover'
	const requestId = options?.requestId || generateRequestId()
	const startMs = Date.now()
	
	// Log start
	Observability.log({
		feature: feature === 'discover' ? 'discover' : 'recruitment',
		route: 'proxy.places-search',
		status: 'start',
		requestId,
		meta: {
			query: params.q,
			location: params.location,
			radius: params.radius,
			userAction: options?.userAction
		}
	})
	
	try {
		// Build query string
		const qs = new URLSearchParams()
		qs.set('q', params.q)
		if (params.location) qs.set('location', params.location)
		if (params.radius) qs.set('radius', params.radius.toString())
		
		// Call proxy endpoint
		const response = await fetch(`/api/places-search?${qs.toString()}`, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'X-Request-Id': requestId,
				'X-Feature': feature
			},
			signal: options?.signal
		})
		
		const data = await response.json()
		const durationMs = Date.now() - startMs
		
		// Handle error response
		if (!response.ok || !data.ok) {
			const normalized = normalizeGoogleProxyError({
				code: data.code,
				userMessage: data.userMessage,
				devDetails: data.devDetails,
				googleStatus: data.googleStatus,
				httpStatus: data.httpStatus || response.status,
				requestId: data.requestId || requestId
			})
			
			Observability.log({
				feature: feature === 'discover' ? 'discover' : 'recruitment',
				route: 'proxy.places-search',
				status: 'error',
				requestId,
				durationMs,
				errorName: normalized.code,
				errorMessage: normalized.userMessage,
				meta: {
					code: normalized.code,
					googleStatus: normalized.googleStatus,
					httpStatus: normalized.httpStatus,
					devDetails: normalized.devDetails,
					query: params.q,
					location: params.location,
					radius: params.radius
				}
			})
			
			const error: any = new Error(normalized.userMessage)
			error.code = normalized.code
			error.normalized = normalized
			error.requestId = requestId
			throw error
		}
		
		// Log success
		Observability.log({
			feature: feature === 'discover' ? 'discover' : 'recruitment',
			route: 'proxy.places-search',
			status: data.results.length === 0 ? 'empty' : 'ok',
			requestId,
			durationMs,
			meta: {
				count: data.results.length,
				cached: data.cached,
				ts: data.ts,
				query: params.q,
				location: params.location,
				radius: params.radius
			}
		})
		
		return {
			results: data.results || [],
			cached: data.cached || false,
			ts: data.ts,
			requestId: data.requestId || requestId,
			durationMs: data.durationMs
		}
	} catch (error: any) {
		// Handle network/fetch errors
		if (options?.signal?.aborted || error?.name === 'AbortError') {
			// Don't log aborts
			throw error
		}
		
		const durationMs = Date.now() - startMs
		
		// If error already has normalized info, just log it
		if (error.normalized) {
			throw error
		}
		
		// Normalize network errors
		const normalized = normalizeGoogleProxyError({
			code: 'NETWORK',
			userMessage: error.message || 'Network error',
			devDetails: error.stack || error.message || String(error)
		})
		
		Observability.log({
			feature: feature === 'discover' ? 'discover' : 'recruitment',
			route: 'proxy.places-search',
			status: 'error',
			requestId,
			durationMs,
			errorName: 'NetworkError',
			errorMessage: normalized.userMessage,
			meta: {
				code: normalized.code,
				devDetails: normalized.devDetails,
				query: params.q,
				location: params.location
			}
		})
		
		const err: any = new Error(normalized.userMessage)
		err.code = normalized.code
		err.normalized = normalized
		err.requestId = requestId
		throw err
	}
}
