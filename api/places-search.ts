/**
 * Google Places Search Proxy (Self-Contained)
 * Server-side endpoint to keep Google API key secure
 * Includes retry logic, 10-minute in-memory caching, and persistent Supabase cache
 * 
 * CRASH-PROOF: No internal module dependencies - all logic inlined
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Force Node.js runtime for crypto support
export const config = {
	runtime: 'nodejs'
}

// ===== INLINED FETCH UTILITIES (no external dependencies) =====

const ATTEMPT_TIMEOUT_MS = 12000 // 12 seconds per attempt (increased for cold starts)
const MAX_RETRIES = 2
const BASE_DELAY_MS = 250

type RetryableError = {
	shouldRetry: boolean
	statusCode?: number
	isNetwork: boolean
}

/**
 * Check if an error is retryable
 */
function isRetryable(error: any, attempt: number): RetryableError {
	const statusCode = error?.status || error?.statusCode
	
	// Network errors
	if (
		!statusCode ||
		error?.message?.includes('ECONNRESET') ||
		error?.message?.includes('ETIMEDOUT') ||
		error?.message?.includes('timeout') ||
		error?.name === 'AbortError'
	) {
		return { shouldRetry: attempt < MAX_RETRIES, isNetwork: true }
	}
	
	// HTTP errors
	if (typeof statusCode === 'number') {
		// Retry on 429 (rate limit) and 5xx (server errors)
		if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
			return { shouldRetry: attempt < MAX_RETRIES, statusCode, isNetwork: false }
		}
	}
	
	return { shouldRetry: false, isNetwork: false }
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
	
	try {
		const response = await fetch(url, { signal: controller.signal })
		clearTimeout(timeoutId)
		
		// Capture Retry-After header for 429 responses
		if (response.status === 429 && response.headers.has('Retry-After')) {
			const retryAfterValue = response.headers.get('Retry-After')
			if (retryAfterValue) {
				// Store for caller (either seconds or HTTP date)
				const retryAfterSeconds = parseInt(retryAfterValue, 10)
				if (!isNaN(retryAfterSeconds)) {
					(response as any)._retryAfter = retryAfterSeconds
				}
			}
		}
		
		return response
	} catch (error) {
		clearTimeout(timeoutId)
		throw error
	}
}

/**
 * Fetch with automatic retry logic for transient errors
 * @param url - URL to fetch
 * @param options - Retry options
 * @returns Response object with optional _retryAfter property for 429 responses
 * @throws Error after all retries exhausted
 */
async function fetchWithRetry(
	url: string,
	options?: {
		maxRetries?: number
		baseDelayMs?: number
		timeoutMs?: number
	}
): Promise<Response & { _retryAfter?: number }> {
	const maxRetries = options?.maxRetries ?? MAX_RETRIES
	const baseDelayMs = options?.baseDelayMs ?? BASE_DELAY_MS
	const timeoutMs = options?.timeoutMs ?? ATTEMPT_TIMEOUT_MS
	
	let lastError: any
	let lastRetryAfter: number | undefined
	
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetchWithTimeout(url, timeoutMs) as Response & { _retryAfter?: number }
			
			// If response is ok, return immediately
			if (response.ok) {
				return response
			}
			
			// Capture Retry-After if present (for 429)
			if (response._retryAfter) {
				lastRetryAfter = response._retryAfter
			}
			
			// Check if status code is retryable
			const retryable = isRetryable({ status: response.status }, attempt)
			if (!retryable.shouldRetry) {
				// Non-retryable error: return response for caller to handle
				return response
			}
			
			lastError = { 
				status: response.status, 
				message: `HTTP ${response.status}`,
				retryAfter: lastRetryAfter
			}
			
			// Wait before retry (exponential backoff with jitter)
			if (attempt < maxRetries) {
				// Use Retry-After if available, otherwise exponential backoff
				let delay = baseDelayMs * Math.pow(2, attempt)
				if (lastRetryAfter && response.status === 429) {
					delay = Math.max(delay, lastRetryAfter * 1000) // Convert seconds to ms
				}
				const jitter = Math.floor(Math.random() * 100)
				await new Promise(resolve => setTimeout(resolve, delay + jitter))
			}
		} catch (error) {
			lastError = error
			
			const retryable = isRetryable(error, attempt)
			if (!retryable.shouldRetry) {
				throw error
			}
			
			// Wait before retry (exponential backoff with jitter)
			if (attempt < maxRetries) {
				const delay = baseDelayMs * Math.pow(2, attempt)
				const jitter = Math.floor(Math.random() * 100)
				await new Promise(resolve => setTimeout(resolve, delay + jitter))
			}
		}
	}
	
	// All retries exhausted
	throw lastError || new Error('Fetch failed after retries')
}

// ===== END INLINED UTILITIES =====

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
 * Wrapped in try/catch to prevent uncaught errors
 */
async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
	try {
		// Normalize input: trim and collapse whitespace
		const normalized = address.trim().replace(/\s+/g, ' ')
		
		const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
		url.searchParams.set('address', normalized)
		url.searchParams.set('key', apiKey)
		
		const response = await fetchWithRetry(url.toString())
		
		if (!response.ok) {
			console.error('[geocodeAddress] HTTP error', { status: response.status, address: normalized })
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
		
		console.error('[geocodeAddress] unexpected status', { status: data.status, address: normalized })
		throw new Error(`Geocode failed: ${data.status}`)
	} catch (error: any) {
		// Re-throw but ensure it's a proper Error object
		if (error instanceof Error) {
			throw error
		}
		throw new Error(`Geocode error: ${String(error)}`)
	}
}

/**
 * Normalize Google Places API error with Retry-After support
 */
function normalizeError(error: any, googleStatus?: string, retryAfter?: number, debugMode?: boolean): { 
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
			let userMessage = 'Search is temporarily unavailable (Google configuration). Please try again later.'
			if (debugMode) {
				userMessage += ' [DEBUG: Check GOOGLE_MAPS_API_KEY restrictions, enabled APIs (Places, Geocoding), and billing.]'
			}
			return {
				code: 'KEY_RESTRICTED',
				userMessage,
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
			let userMessage = 'Search is temporarily unavailable (Google configuration). Please try again later.'
			if (debugMode) {
				userMessage += ' [DEBUG: Check GOOGLE_MAPS_API_KEY restrictions, enabled APIs (Places, Geocoding), and billing.]'
			}
			return {
				code: 'KEY_RESTRICTED',
				userMessage,
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
	const requestId = (req.headers['x-vercel-id'] as string) || (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
	const startMs = Date.now()
	
	// ===== TOP-LEVEL CRASH-PROOF WRAPPER =====
	try {
		console.log('[places-search] request received', {
			method: req.method,
			url: req.url,
			requestId,
			headers: {
				host: req.headers.host,
				'user-agent': req.headers['user-agent'],
				'x-vercel-id': req.headers['x-vercel-id']
			}
		})
		
		// Only allow GET requests
		if (req.method !== 'GET') {
			console.log('[places-search] method not allowed', { method: req.method, requestId })
			return res.status(405).json({ 
				ok: false,
				code: 'METHOD_NOT_ALLOWED',
				userMessage: 'Only GET requests are allowed.',
				httpStatus: 405,
				requestId
			})
		}
		
		// ===== HARDENED REQUEST PARSING FOR VERCEL =====
		// Do NOT assume req.query exists - parse from URL instead
		let q = ''
		let location = ''
		let radius = 25000
		let isPing = false
		let debugMode = false
		
		try {
			// Safe URL parsing for Vercel environment
			const host = req.headers.host || 'localhost:3000'
			const url = new URL(req.url || '/', `https://${host}`)
			
			// Check for ping/health check
			isPing = url.searchParams.get('ping') === '1'
			
			// Check for debug mode
			debugMode = url.searchParams.get('debug') === '1'
			
		if (isPing) {
			console.log('[places-search] health check ping', { requestId })
			return res.status(200).json({
				ok: true,
				ping: 'pong',
				ts: new Date().toISOString(),
				hasKey: !!process.env.GOOGLE_MAPS_API_KEY,
				requestId,
				// Deterministic signature for deployment verification
				placesProxyVersion: '60304de-self-contained',
				buildId: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VITE_BUILD_ID || null,
				gitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
				vercelEnv: process.env.VERCEL_ENV || null
			})
		}
			
			// Parse query params safely (accept both 'q' and 'query')
			q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim()
			location = (url.searchParams.get('location') || '').trim()
			
			// Parse radius with fallback
			const radiusRaw = url.searchParams.get('radius')
			if (radiusRaw) {
				const parsed = Number(radiusRaw)
				if (Number.isFinite(parsed)) {
					radius = Math.max(1000, Math.min(50000, parsed)) // Clamp to 1km - 50km
				}
			}
			
			console.log('[places-search] params parsed', { q, location, radius, requestId })
		} catch (urlError: any) {
			console.error('[places-search] URL parsing failed', {
				error: String(urlError?.message ?? urlError),
				url: req.url,
				requestId
			})
			return res.status(400).json({
				ok: false,
				code: 'INVALID_REQUEST',
				userMessage: 'Invalid request URL.',
				httpStatus: 400,
				requestId,
				devDetails: { message: String(urlError?.message ?? urlError) }
			})
		}
		// ===== STRICT INPUT VALIDATION =====
		
		// Validate query string: must be at least 2 characters
		if (q.length < 2) {
			console.log('[places-search] invalid query', { q, length: q.length, requestId })
			logSearch({ requestId, code: 'INVALID_REQUEST', durationMs: Date.now() - startMs, query: q })
			return res.status(400).json({
				ok: false,
				code: 'INVALID_REQUEST',
				userMessage: 'Enter at least 2 characters to search.',
				httpStatus: 400,
				requestId,
				devDetails: { query: q, length: q.length }
			})
		}
		
		// ===== API KEY VALIDATION =====
		
		// Explicit check for Google Maps API key (never throw)
		if (!process.env.GOOGLE_MAPS_API_KEY) {
			console.error('[places-search] missing API key', { requestId })
			logSearch({ requestId, code: 'KEY_RESTRICTED', durationMs: Date.now() - startMs })
			return res.status(500).json({
				ok: false,
				code: 'MISSING_SERVER_KEY',
				userMessage: 'Search is not configured (missing server key).',
				httpStatus: 500,
				requestId,
				devDetails: { error: 'GOOGLE_MAPS_API_KEY environment variable not set' }
			})
		}
		
		const apiKey = process.env.GOOGLE_MAPS_API_KEY
		console.log('[places-search] API key verified', { requestId })
		
		// ===== NORMALIZE LOCATION HANDLING (3 forms) =====
		
		let resolvedLocation = ''
		let locationLatLng: { lat: number; lng: number } | null = null
		
		if (location && location.length > 0) {
			// Form 1: "lat,lng" format (already coordinates)
			const latLngMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/)
			if (latLngMatch) {
				locationLatLng = {
					lat: parseFloat(latLngMatch[1]),
					lng: parseFloat(latLngMatch[2])
				}
				resolvedLocation = `${locationLatLng.lat},${locationLatLng.lng}`
				console.log('[places-search] location parsed as lat/lng', { resolvedLocation, requestId })
			} else {
				// Form 2: locationText (needs geocoding)
				// Normalize: trim and collapse whitespace
				const normalizedLocationText = location.trim().replace(/\s+/g, ' ')
				
				try {
					console.log('[places-search] geocoding location', { location: normalizedLocationText, requestId })
					// Geocode ONCE per request (never more) - wrap in try/catch
					locationLatLng = await geocodeAddress(normalizedLocationText, apiKey)
					if (locationLatLng) {
						resolvedLocation = `${locationLatLng.lat},${locationLatLng.lng}`
						console.log('[places-search] geocode success', { resolvedLocation, requestId })
					} else {
						// ZERO_RESULTS from geocode: not a hard error, return empty results
						console.log('[places-search] geocode returned zero results', { location: normalizedLocationText, requestId })
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
				} catch (geocodeError: any) {
					// Geocoding failed: log but proceed without location (Google supports text-only search)
					console.error('[places-search] geocode error', {
						error: String(geocodeError?.message ?? geocodeError),
						stack: String(geocodeError?.stack ?? ''),
						location: normalizedLocationText,
						requestId
					})
					// Continue without location instead of failing
					resolvedLocation = ''
					locationLatLng = null
				}
			}
		}
		// Form 3: location omitted - Google supports text-only search, no error
		console.log('[places-search] location resolved', { resolvedLocation, hasLatLng: !!locationLatLng, requestId })
		
		// ===== CHECK CACHES (persistent → memory → Google) =====
		
		const cKey = cacheKey(q, resolvedLocation, radius)
		cleanCache()
		console.log('[places-search] cache key generated', { cKey, requestId })
		
		// Try persistent cache first (Supabase)
		const supabase = getSupabaseClient()
		if (supabase) {
			try {
				console.log('[places-search] checking persistent cache', { cKey, requestId })
				const { data: persistentCache, error: cacheError } = await supabase
					.from('search_cache')
					.select('payload, created_at')
					.eq('key', cKey)
					.single()
				
				if (!cacheError && persistentCache) {
					const cacheAge = Date.now() - new Date(persistentCache.created_at).getTime()
					if (cacheAge < CACHE_TTL_MS) {
						const payload = persistentCache.payload as CacheEntry
						console.log('[places-search] persistent cache HIT', { cacheAge, requestId })
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
					} else {
						console.log('[places-search] persistent cache expired', { cacheAge, requestId })
					}
				} else {
					console.log('[places-search] persistent cache MISS', { requestId })
				}
			} catch (cacheErr: any) {
				// Persistent cache error: log but continue (never crash)
				console.error('[places-search] persistent cache error', {
					error: String(cacheErr?.message ?? cacheErr),
					stack: String(cacheErr?.stack ?? ''),
					requestId
				})
			}
		}
		
		// Try in-memory cache
		const memCached = cache.get(cKey)
		if (memCached && Date.now() - memCached.tsMs < CACHE_TTL_MS) {
			console.log('[places-search] memory cache HIT', { requestId })
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
		console.log('[places-search] memory cache MISS', { requestId })
		
		// ===== CALL GOOGLE PLACES API =====
		
		// Build Places Text Search URL
		console.log('[places-search] building Google API request', { q, locationLatLng, radius, requestId })
		const googleUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
		googleUrl.searchParams.set('query', q)
		googleUrl.searchParams.set('key', apiKey)
		
		// Add location and radius if available (but not required)
		if (locationLatLng) {
			googleUrl.searchParams.set('location', `${locationLatLng.lat},${locationLatLng.lng}`)
			googleUrl.searchParams.set('radius', radius.toString())
		}
		
		// Call Google Places API with retry (12s timeout, retries on 429/500-599/network)
		let response: Awaited<ReturnType<typeof fetchWithRetry>>
		let data: any
		
		try {
			console.log('[places-search] calling Google API', { requestId })
			response = await fetchWithRetry(googleUrl.toString())
			console.log('[places-search] Google API responded', { status: response.status, ok: response.ok, requestId })
			
			// Parse JSON safely
			try {
				data = await response.json()
			} catch (jsonError: any) {
				console.error('[places-search] JSON parse error', {
					error: String(jsonError?.message ?? jsonError),
					status: response.status,
					requestId
				})
				throw new Error(`Failed to parse Google API response: ${jsonError?.message ?? 'Invalid JSON'}`)
			}
		} catch (fetchError: any) {
			console.error('[places-search] Google API fetch error', {
				error: String(fetchError?.message ?? fetchError),
				stack: String(fetchError?.stack ?? ''),
				requestId
			})
			
			// Normalize fetch error and return structured response (never throw)
			const normalized = normalizeError(fetchError, undefined, undefined, debugMode)
			logSearch({ 
				requestId, 
				code: normalized.code, 
				durationMs: Date.now() - startMs,
				query: q
			})
			
			return res.status(normalized.httpStatus || 502).json({
				ok: false,
				code: normalized.code,
				userMessage: normalized.userMessage,
				httpStatus: normalized.httpStatus || 502,
				requestId,
				devDetails: { 
					message: String(fetchError?.message ?? fetchError),
					stack: String(fetchError?.stack ?? '').split('\n').slice(0, 3).join('\n')
				}
			})
		}
		
		// Handle Google-specific status codes (ensure structured JSON, never HTML)
		console.log('[places-search] Google API status', { status: data.status, requestId })
		
		if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
			const retryAfter = (response as any)._retryAfter
			const normalized = normalizeError(null, data.status, retryAfter, debugMode)
			
			console.error('[places-search] Google API error status', {
				status: data.status,
				code: normalized.code,
				httpStatus: normalized.httpStatus,
				requestId
			})
			
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
				httpStatus,
				requestId
			}
			
			// Include Retry-After if present (for 429)
			if (normalized.retryAfter) {
				responseBody.retryAfter = normalized.retryAfter
				res.setHeader('Retry-After', normalized.retryAfter.toString())
			}
			
			return res.status(httpStatus).json(responseBody)
		}
		
		// ===== NORMALIZE AND CACHE RESULTS =====
		
		// Normalize results safely
		console.log('[places-search] normalizing results', { count: data.results?.length ?? 0, requestId })
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
		
		console.log('[places-search] results normalized', { count: results.length, requestId })
		
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
			console.log('[places-search] writing to persistent cache', { cKey, requestId })
			supabase
				.from('search_cache')
				.upsert({ 
					key: cKey, 
					payload: entry, 
					created_at: new Date().toISOString() 
				})
				.then(({ error }) => {
					if (error) {
						console.error('[places-search] persistent cache write error', {
							error: String(error?.message ?? error),
							cKey,
							requestId
						})
					} else {
						console.log('[places-search] persistent cache write success', { cKey, requestId })
					}
				})
				.catch((cacheWriteErr: any) => {
					console.error('[places-search] persistent cache write exception', {
						error: String(cacheWriteErr?.message ?? cacheWriteErr),
						stack: String(cacheWriteErr?.stack ?? ''),
						cKey,
						requestId
					})
				})
		}
		
		// Log success
		logSearch({ 
			requestId, 
			googleStatus: data.status, 
			durationMs: Date.now() - startMs,
			query: q
		})
		
		console.log('[places-search] success', { 
			count: results.length, 
			durationMs: Date.now() - startMs,
			requestId 
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
		// ===== TOP-LEVEL CATCH: ABSOLUTELY NOTHING ESCAPES UNCAUGHT =====
		
		// Log fatal error with full details
		console.error('[places-search] fatal', {
			message: String(error?.message ?? error),
			stack: String(error?.stack ?? ''),
			name: error?.name,
			code: error?.code,
			requestId,
			durationMs: Date.now() - startMs
		})
		
		logSearch({ 
			requestId, 
			code: 'UNKNOWN', 
			durationMs: Date.now() - startMs
		})
		
		// Return structured error response (never throw, never HTML)
		return res.status(500).json({
			ok: false,
			code: 'SERVER_ERROR',
			userMessage: 'Search temporarily unavailable. Please try again.',
			httpStatus: 500,
			requestId: req.headers['x-vercel-id'] ?? requestId ?? null,
			devDetails: {
				message: String(error?.message ?? error),
				stack: String(error?.stack ?? '')
			}
		})
	}
}
