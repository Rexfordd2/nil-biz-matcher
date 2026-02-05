/**
 * Google Places Search Proxy
 * Server-side endpoint to keep Google API key secure
 * Includes retry logic and 10-minute caching
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchWithRetry } from './_lib/googleHttp'
import { createHash } from 'crypto'

// Force Node.js runtime for crypto support
export const config = {
	runtime: 'nodejs'
}

type NormalizedPlace = {
	placeId: string
	name: string
	formattedAddress?: string
	location: { lat: number; lng: number }
	rating?: number
	userRatingsTotal?: number
	types?: string[]
	photoReference?: string
}

type CacheEntry = {
	tsMs: number
	results: NormalizedPlace[]
	requestId: string
}

type ErrorCode = 'KEY_RESTRICTED' | 'OVER_QUERY_LIMIT' | 'ZERO_RESULTS' | 'OFFLINE' | 'NETWORK' | 'INVALID_REQUEST' | 'UNKNOWN'

// In-memory cache (module-scoped, survives across requests in same instance)
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_CACHE_SIZE = 500

/**
 * Generate stable hash for cache key
 */
function cacheKey(q: string, location: string, radius: number): string {
	const normalized = JSON.stringify({ q: q.toLowerCase().trim(), location, radius })
	return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

/**
 * Clean expired cache entries
 */
function cleanCache() {
	const now = Date.now()
	for (const [key, entry] of cache.entries()) {
		if (now - entry.tsMs > CACHE_TTL_MS) {
			cache.delete(key)
		}
	}
	
	// If still too large, evict oldest entries
	if (cache.size > MAX_CACHE_SIZE) {
		const entries = Array.from(cache.entries())
			.sort((a, b) => a[1].tsMs - b[1].tsMs)
		const toEvict = entries.slice(0, cache.size - MAX_CACHE_SIZE)
		for (const [key] of toEvict) {
			cache.delete(key)
		}
	}
}

/**
 * Geocode an address to lat/lng
 */
async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
	const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
	url.searchParams.set('address', address)
	url.searchParams.set('key', apiKey)
	
	const response = await fetchWithRetry(url.toString())
	
	if (!response.ok) {
		throw new Error(`Geocode HTTP ${response.status}`)
	}
	
	const data = await response.json()
	
	if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
		return {
			lat: data.results[0].geometry.location.lat,
			lng: data.results[0].geometry.location.lng
		}
	}
	
	if (data.status === 'ZERO_RESULTS') {
		return null
	}
	
	throw new Error(`Geocode failed: ${data.status}`)
}

/**
 * Normalize Google Places API error
 */
function normalizeError(error: any, googleStatus?: string): { 
	code: ErrorCode
	userMessage: string
	devDetails: string
	googleStatus?: string
	httpStatus?: number
} {
	// Check Google-specific status strings first
	if (googleStatus) {
		if (googleStatus === 'REQUEST_DENIED') {
			return {
				code: 'KEY_RESTRICTED',
				userMessage: 'Google API key is restricted or invalid. Please contact support.',
				devDetails: `Google status: ${googleStatus}`,
				googleStatus
			}
		}
		
		if (googleStatus === 'OVER_QUERY_LIMIT') {
			return {
				code: 'OVER_QUERY_LIMIT',
				userMessage: 'Google API quota exceeded. Please try again in a few minutes.',
				devDetails: `Google status: ${googleStatus}`,
				googleStatus,
				httpStatus: 429
			}
		}
		
		if (googleStatus === 'INVALID_REQUEST') {
			return {
				code: 'INVALID_REQUEST',
				userMessage: 'Invalid search request. Please try different search terms.',
				devDetails: `Google status: ${googleStatus}`,
				googleStatus,
				httpStatus: 400
			}
		}
	}
	
	// Check HTTP status codes
	const httpStatus = error?.status || error?.statusCode
	if (typeof httpStatus === 'number') {
		if (httpStatus === 403) {
			return {
				code: 'KEY_RESTRICTED',
				userMessage: 'Google API key is restricted or invalid. Please contact support.',
				devDetails: `HTTP ${httpStatus}`,
				httpStatus
			}
		}
		
		if (httpStatus === 429) {
			return {
				code: 'OVER_QUERY_LIMIT',
				userMessage: 'Google API quota exceeded. Please try again in a few minutes.',
				devDetails: `HTTP ${httpStatus}`,
				httpStatus
			}
		}
	}
	
	// Network errors
	const message = error?.message || String(error)
	if (
		message.includes('fetch') ||
		message.includes('network') ||
		message.includes('ECONNRESET') ||
		message.includes('ETIMEDOUT') ||
		message.includes('timeout') ||
		error?.name === 'AbortError'
	) {
		return {
			code: 'NETWORK',
			userMessage: 'Network error. Please check your connection and try again.',
			devDetails: message
		}
	}
	
	// Unknown error
	return {
		code: 'UNKNOWN',
		userMessage: 'An error occurred. Please try again.',
		devDetails: message
	}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// Only allow GET requests
	if (req.method !== 'GET') {
		return res.status(405).json({ 
			ok: false, 
			error: 'Method Not Allowed' 
		})
	}
	
	const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
	const startMs = Date.now()
	
	try {
		// Extract and validate query params
		const q = (req.query.q as string || '').trim()
		const locationParam = (req.query.location as string || '').trim()
		const radiusParam = req.query.radius ? parseInt(req.query.radius as string, 10) : 20000
		
		if (!q) {
			return res.status(400).json({
				ok: false,
				requestId,
				code: 'INVALID_REQUEST',
				userMessage: 'Query parameter "q" is required',
				devDetails: 'Missing required parameter: q'
			})
		}
		
		// Clamp radius to reasonable limits (100m - 50km)
		const radius = Math.max(100, Math.min(50000, radiusParam))
		
		// Get server-side Google Maps API key
		const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
		if (!apiKey) {
			return res.status(503).json({
				ok: false,
				requestId,
				code: 'KEY_RESTRICTED',
				userMessage: 'Google Maps API is not configured',
				devDetails: 'GOOGLE_MAPS_API_KEY not set'
			})
		}
		
		// Resolve location to lat,lng if needed
		let resolvedLocation = locationParam
		let locationLatLng: { lat: number; lng: number } | null = null
		
		if (locationParam) {
			// Check if it's already lat,lng format
			const latLngMatch = locationParam.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/)
			if (latLngMatch) {
				locationLatLng = {
					lat: parseFloat(latLngMatch[1]),
					lng: parseFloat(latLngMatch[2])
				}
				resolvedLocation = `${locationLatLng.lat},${locationLatLng.lng}`
			} else {
				// Geocode the address
				try {
					locationLatLng = await geocodeAddress(locationParam, apiKey)
					if (locationLatLng) {
						resolvedLocation = `${locationLatLng.lat},${locationLatLng.lng}`
					} else {
						// ZERO_RESULTS from geocode - proceed without location
						resolvedLocation = ''
					}
				} catch (error) {
					// Geocoding failed - log but proceed without location
					console.error('[places-search] Geocode failed:', error)
					resolvedLocation = ''
				}
			}
		}
		
		// Check cache
		const cKey = cacheKey(q, resolvedLocation, radius)
		cleanCache()
		const cached = cache.get(cKey)
		if (cached && Date.now() - cached.tsMs < CACHE_TTL_MS) {
			return res.status(200).json({
				ok: true,
				requestId: cached.requestId,
				cached: true,
				ts: new Date(cached.tsMs).toISOString(),
				results: cached.results,
				durationMs: Date.now() - startMs
			})
		}
		
		// Build Places Text Search URL
		const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
		url.searchParams.set('query', q)
		url.searchParams.set('key', apiKey)
		
		if (locationLatLng) {
			url.searchParams.set('location', `${locationLatLng.lat},${locationLatLng.lng}`)
			url.searchParams.set('radius', radius.toString())
		}
		
		// Call Google Places API with retry
		const response = await fetchWithRetry(url.toString())
		const data = await response.json()
		
		// Handle Google-specific status codes
		if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
			const normalized = normalizeError(null, data.status)
			return res.status(normalized.httpStatus || 500).json({
				ok: false,
				requestId,
				code: normalized.code,
				userMessage: normalized.userMessage,
				devDetails: normalized.devDetails,
				googleStatus: data.status,
				durationMs: Date.now() - startMs
			})
		}
		
		// Normalize results
		const results: NormalizedPlace[] = (data.results || []).map((place: any) => ({
			placeId: place.place_id,
			name: place.name || '',
			formattedAddress: place.formatted_address,
			location: {
				lat: place.geometry?.location?.lat || 0,
				lng: place.geometry?.location?.lng || 0
			},
			rating: place.rating,
			userRatingsTotal: place.user_ratings_total,
			types: place.types,
			photoReference: place.photos?.[0]?.photo_reference
		})).filter((p: NormalizedPlace) => p.placeId && p.location.lat && p.location.lng)
		
		// Store in cache
		const entry: CacheEntry = {
			tsMs: Date.now(),
			results,
			requestId
		}
		cache.set(cKey, entry)
		
		// Return results
		res.setHeader('Cache-Control', 'no-store')
		res.setHeader('Pragma', 'no-cache')
		res.setHeader('Expires', '0')
		
		return res.status(200).json({
			ok: true,
			requestId,
			cached: false,
			ts: new Date(entry.tsMs).toISOString(),
			results,
			durationMs: Date.now() - startMs
		})
	} catch (error: any) {
		const normalized = normalizeError(error)
		return res.status(normalized.httpStatus || 500).json({
			ok: false,
			requestId,
			code: normalized.code,
			userMessage: normalized.userMessage,
			devDetails: normalized.devDetails,
			googleStatus: normalized.googleStatus,
			httpStatus: normalized.httpStatus,
			durationMs: Date.now() - startMs
		})
	}
}
