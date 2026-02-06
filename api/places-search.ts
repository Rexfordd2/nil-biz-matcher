/**
 * Google Places Search Proxy
 * Server-side endpoint to keep Google API key secure
 * Includes retry logic, 10-minute in-memory caching, and persistent Supabase cache
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchWithRetry } from './_lib/googleHttp'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Force Node.js runtime for crypto support
export const config = {
	runtime: 'nodejs'
}

// Initialize Supabase client for persistent caching (server-side, service role)
let supabaseClient: ReturnType<typeof createClient> | null = null
function getSupabaseClient() {
	if (supabaseClient) return supabaseClient
	
	const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY // Service role for server-side
	
	if (url && key) {
		supabaseClient = createClient(url, key)
		return supabaseClient
	}
	
	return null
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
 * Geocode an address to lat/lng (only called once per request)
 */
async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
	// Normalize input: trim and collapse whitespace
	const normalized = address.trim().replace(/\s+/g, ' ')
	
	const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
	url.searchParams.set('address', normalized)
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
	
	// ZERO_RESULTS is not an error - just means no location found
	if (data.status === 'ZERO_RESULTS') {
		return null
	}
	
	throw new Error(`Geocode failed: ${data.status}`)
}

/**
 * Normalize Google Places API error with Retry-After support
 */
function normalizeError(error: any, googleStatus?: string, retryAfter?: number): { 
	code: ErrorCode
	userMessage: string
	devDetails: string
	googleStatus?: string
	httpStatus?: number
	retryAfter?: number
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
				userMessage: 'Too many searches right now. Please try again in a few seconds.',
				devDetails: `Google status: ${googleStatus}`,
				googleStatus,
				httpStatus: 429,
				retryAfter
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
	const errorRetryAfter = error?.retryAfter || retryAfter
	
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
				userMessage: 'Too many searches right now. Please try again in a few seconds.',
				devDetails: `HTTP ${httpStatus}`,
				httpStatus,
				retryAfter: errorRetryAfter
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

/**
 * Safe stringify for error logging (never logs sensitive data)
 */
function safeStringify(error: any): string {
	try {
		if (error instanceof Error) {
			return JSON.stringify({
				name: error.name,
				message: error.message,
				stack: error.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines only
			})
		}
		return JSON.stringify(error)
	} catch {
		return String(error)
	}
}

/**
 * Safe server-side logging (never logs API keys)
 */
function logSearch(params: {
	requestId: string
	code?: ErrorCode
	googleStatus?: string
	durationMs: number
	cached?: boolean
	persistentHit?: boolean
	query?: string
}) {
	const { requestId, code, googleStatus, durationMs, cached, persistentHit, query } = params
	
	// Build log message
	const parts = [
		`[places-search]`,
		`reqId=${requestId}`,
		code ? `code=${code}` : null,
		googleStatus ? `googleStatus=${googleStatus}` : null,
		`duration=${durationMs}ms`,
		cached ? 'cached=memory' : null,
		persistentHit ? 'cached=persistent' : null,
		query ? `query="${query.slice(0, 50)}"` : null
	].filter(Boolean)
	
	console.log(parts.join(' '))
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
		// ===== STRICT INPUT VALIDATION =====
		
		// 1. Accept both 'q' and 'query' parameters
		const qRaw = (req.query.q ?? req.query.query ?? '') as string
		const q = qRaw.trim()
		
		// 2. Validate query string: must be at least 2 characters
		if (q.length < 2) {
			logSearch({ requestId, code: 'INVALID_REQUEST', durationMs: Date.now() - startMs, query: q })
			return res.status(400).json({
				ok: false,
				code: 'INVALID_REQUEST',
				userMessage: 'Enter at least 2 characters to search.',
				httpStatus: 400
			})
		}
		
		// 3. Normalize location safely (3 forms: "lat,lng", locationText, or omitted)
		const locationRaw = (req.query.location ?? '') as string
		const locationParam = locationRaw.trim()
		
		// 4. Normalize radius safely with fallback to default
		const radiusRaw = req.query.radius as string | undefined
		let radiusMeters = 25000 // Default: 25km
		if (radiusRaw) {
			const parsed = parseInt(radiusRaw, 10)
			if (!isNaN(parsed)) {
				radiusMeters = Math.max(100, Math.min(50000, parsed)) // Clamp to 100m - 50km
			}
		}
		
		// ===== API KEY VALIDATION =====
		
		// Explicit check for Google Maps API key
		if (!process.env.GOOGLE_MAPS_API_KEY) {
			logSearch({ requestId, code: 'KEY_RESTRICTED', durationMs: Date.now() - startMs })
			return res.status(500).json({
				ok: false,
				code: 'MISSING_SERVER_KEY',
				userMessage: 'Search is not configured (missing server key).',
				httpStatus: 500
			})
		}
		
		const apiKey = process.env.GOOGLE_MAPS_API_KEY
		
		// ===== NORMALIZE LOCATION HANDLING (3 forms) =====
		
		let resolvedLocation = ''
		let locationLatLng: { lat: number; lng: number } | null = null
		
		if (locationParam) {
			// Form 1: "lat,lng" format (already coordinates)
			const latLngMatch = locationParam.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/)
			if (latLngMatch) {
				locationLatLng = {
					lat: parseFloat(latLngMatch[1]),
					lng: parseFloat(latLngMatch[2])
				}
				resolvedLocation = `${locationLatLng.lat},${locationLatLng.lng}`
			} else {
				// Form 2: locationText (needs geocoding)
				// Normalize: trim and collapse whitespace
				const normalizedLocationText = locationParam.trim().replace(/\s+/g, ' ')
				
				try {
					// Geocode ONCE per request (never more)
					locationLatLng = await geocodeAddress(normalizedLocationText, apiKey)
					if (locationLatLng) {
						resolvedLocation = `${locationLatLng.lat},${locationLatLng.lng}`
					} else {
						// ZERO_RESULTS from geocode: not a hard error, return empty results
						logSearch({ requestId, googleStatus: 'ZERO_RESULTS', durationMs: Date.now() - startMs, query: q })
						return res.status(200).json({
							ok: true,
							requestId,
							cached: false,
							ts: new Date().toISOString(),
							results: [],
							durationMs: Date.now() - startMs,
							devDetails: 'Geocode returned zero results for location'
						})
					}
				} catch (error) {
					// Geocoding failed: log but proceed without location (Google supports text-only search)
					console.error(`[places-search] Geocode failed for "${normalizedLocationText}":`, error)
					resolvedLocation = ''
					locationLatLng = null
				}
			}
		}
		// Form 3: location omitted - Google supports text-only search, no error
		
		// ===== CHECK CACHES (persistent → memory → Google) =====
		
		const cKey = cacheKey(q, resolvedLocation, radiusMeters)
		cleanCache()
		
		// Try persistent cache first (Supabase)
		const supabase = getSupabaseClient()
		if (supabase) {
			try {
				const { data: persistentCache, error: cacheError } = await supabase
					.from('search_cache')
					.select('payload, created_at')
					.eq('key', cKey)
					.single()
				
				if (!cacheError && persistentCache) {
					const cacheAge = Date.now() - new Date(persistentCache.created_at).getTime()
					if (cacheAge < CACHE_TTL_MS) {
						const payload = persistentCache.payload as CacheEntry
						logSearch({ 
							requestId, 
							durationMs: Date.now() - startMs, 
							persistentHit: true,
							query: q
						})
						return res.status(200).json({
							ok: true,
							requestId: payload.requestId,
							cached: true,
							persistentCache: true,
							ts: new Date(payload.tsMs).toISOString(),
							results: payload.results,
							durationMs: Date.now() - startMs
						})
					}
				}
			} catch (err) {
				// Persistent cache error: log but continue
				console.error('[places-search] Persistent cache read error:', err)
			}
		}
		
		// Try in-memory cache
		const memCached = cache.get(cKey)
		if (memCached && Date.now() - memCached.tsMs < CACHE_TTL_MS) {
			logSearch({ 
				requestId: memCached.requestId, 
				durationMs: Date.now() - startMs, 
				cached: true,
				query: q
			})
			return res.status(200).json({
				ok: true,
				requestId: memCached.requestId,
				cached: true,
				ts: new Date(memCached.tsMs).toISOString(),
				results: memCached.results,
				durationMs: Date.now() - startMs
			})
		}
		
		// ===== CALL GOOGLE PLACES API =====
		
		// Build Places Text Search URL
		const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
		url.searchParams.set('query', q)
		url.searchParams.set('key', apiKey)
		
		// Add location and radius if available (but not required)
		if (locationLatLng) {
			url.searchParams.set('location', `${locationLatLng.lat},${locationLatLng.lng}`)
			url.searchParams.set('radius', radiusMeters.toString())
		}
		
		// Call Google Places API with retry (12s timeout, retries on 429/500-599/network)
		const response = await fetchWithRetry(url.toString())
		const data = await response.json()
		
		// Handle Google-specific status codes (ensure structured JSON, never HTML)
		if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
			const retryAfter = (response as any)._retryAfter
			const normalized = normalizeError(null, data.status, retryAfter)
			
			logSearch({ 
				requestId, 
				code: normalized.code, 
				googleStatus: data.status, 
				durationMs: Date.now() - startMs,
				query: q
			})
			
			// Map Google status to appropriate HTTP status
			let httpStatus = normalized.httpStatus || 502
			if (data.status === 'REQUEST_DENIED') {
				httpStatus = 502 // Bad Gateway (upstream issue)
			} else if (data.status === 'OVER_QUERY_LIMIT') {
				httpStatus = 429 // Too Many Requests
			} else if (data.status === 'INVALID_REQUEST') {
				httpStatus = 400 // Bad Request
			}
			
			const responseBody: any = {
				ok: false,
				code: normalized.code,
				userMessage: normalized.userMessage,
				devDetails: typeof normalized.devDetails === 'string' ? normalized.devDetails : JSON.stringify(normalized.devDetails),
				httpStatus
			}
			
			// Include Retry-After if present (for 429)
			if (normalized.retryAfter) {
				responseBody.retryAfter = normalized.retryAfter
				res.setHeader('Retry-After', normalized.retryAfter.toString())
			}
			
			return res.status(httpStatus).json(responseBody)
		}
		
		// ===== NORMALIZE AND CACHE RESULTS =====
		
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
		
		// Store in both caches
		const entry: CacheEntry = {
			tsMs: Date.now(),
			results,
			requestId
		}
		
		// In-memory cache
		cache.set(cKey, entry)
		
		// Persistent cache (Supabase) - fire and forget, don't block response
		if (supabase) {
			supabase
				.from('search_cache')
				.upsert({ 
					key: cKey, 
					payload: entry, 
					created_at: new Date().toISOString() 
				})
				.then(({ error }) => {
					if (error) {
						console.error('[places-search] Persistent cache write error:', error)
					}
				})
				.catch((err) => {
					console.error('[places-search] Persistent cache write exception:', err)
				})
		}
		
		// Log success
		logSearch({ 
			requestId, 
			googleStatus: data.status, 
			durationMs: Date.now() - startMs,
			query: q
		})
		
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
		// Catch all unexpected errors and return structured JSON (never throw)
		const retryAfter = error?.retryAfter
		const normalized = normalizeError(error, undefined, retryAfter)
		
		logSearch({ 
			requestId, 
			code: normalized.code, 
			googleStatus: normalized.googleStatus, 
			durationMs: Date.now() - startMs
		})
		
		const responseBody: any = {
			ok: false,
			code: 'SERVER_ERROR',
			userMessage: 'Search temporarily unavailable. Please try again.',
			httpStatus: 500,
			devDetails: safeStringify(error)
		}
		
		// Include Retry-After if present
		if (normalized.retryAfter) {
			responseBody.retryAfter = normalized.retryAfter
			res.setHeader('Retry-After', normalized.retryAfter.toString())
		}
		
		return res.status(500).json(responseBody)
	}
}
