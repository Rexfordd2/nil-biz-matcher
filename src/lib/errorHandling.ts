import { ValidationError } from '../validation/validators'
import { GoogleError } from './google/telemetry'

/**
 * Normalized error structure for consistent error handling across Discover and Recruiting
 */
export type NormalizedError = {
	kind: 'offline' | 'rate_limited' | 'unauthorized' | 'validation_error' | 'server_error' | 'google_quota' | 'google_restricted' | 'google_invalid' | 'unknown'
	statusCode?: number
	requestId?: string
	message: string
	retryAfter?: number // seconds
	originalError?: unknown
	googleStatus?: string
}

/**
 * Normalize various error types into a consistent structure
 */
export function normalizeError(error: unknown, requestId?: string): NormalizedError {
	// Handle GoogleError specifically
	if (error instanceof GoogleError) {
		const googleStatus = error.googleStatus
		
		// Map Google status strings to normalized error kinds
		if (googleStatus === 'OVER_QUERY_LIMIT') {
			return {
				kind: 'google_quota',
				statusCode: 429,
				requestId: error.requestId || requestId,
				message: 'Google API quota exceeded',
				googleStatus,
				originalError: error
			}
		}
		
		if (googleStatus === 'REQUEST_DENIED') {
			return {
				kind: 'google_restricted',
				statusCode: 403,
				requestId: error.requestId || requestId,
				message: 'Google API key restricted or invalid',
				googleStatus,
				originalError: error
			}
		}
		
		if (googleStatus === 'INVALID_REQUEST') {
			return {
				kind: 'google_invalid',
				statusCode: 400,
				requestId: error.requestId || requestId,
				message: 'Invalid request to Google API',
				googleStatus,
				originalError: error
			}
		}
		
		if (googleStatus === 'UNKNOWN_ERROR' || googleStatus === 'ERROR') {
			return {
				kind: 'server_error',
				statusCode: 500,
				requestId: error.requestId || requestId,
				message: 'Google API error',
				googleStatus,
				originalError: error
			}
		}
		
		// Default for other Google statuses
		return {
			kind: 'unknown',
			requestId: error.requestId || requestId,
			message: error.message,
			googleStatus,
			originalError: error
		}
	}
	
	// Handle ValidationError
	if (error instanceof ValidationError) {
		return {
			kind: 'validation_error',
			requestId: error.requestId || requestId,
			message: error.message,
			originalError: error
		}
	}

	// Handle fetch/HTTP errors
	if (error && typeof error === 'object') {
		const err = error as any
		const status = err.status || err.statusCode
		const message = err.message || String(error)

		// Check for offline/network errors
		if (navigator && navigator.onLine === false) {
			return {
				kind: 'offline',
				message: "You're offline",
				requestId,
				originalError: error
			}
		}

		// Check for network errors (failed to fetch, etc.)
		if (
			message.includes('Failed to fetch') ||
			message.includes('NetworkError') ||
			message.includes('network') ||
			err.name === 'TypeError' && message.includes('fetch')
		) {
			return {
				kind: 'offline',
				message: 'Network error. Check your connection',
				requestId,
				originalError: error
			}
		}

		// Handle HTTP status codes
		if (typeof status === 'number') {
			if (status === 429) {
				// Extract Retry-After header if available
				const retryAfter = err.retryAfter || (err.headers?.get?.('Retry-After') ? parseInt(err.headers.get('Retry-After'), 10) : undefined)
				return {
					kind: 'rate_limited',
					statusCode: 429,
					requestId,
					message: 'Server is rate limiting (429)',
					retryAfter,
					originalError: error
				}
			}

			if (status === 401 || status === 403) {
				return {
					kind: 'unauthorized',
					statusCode: status,
					requestId,
					message: 'Session expired',
					originalError: error
				}
			}

			if (status >= 500 && status < 600) {
				return {
					kind: 'server_error',
					statusCode: status,
					requestId,
					message: `Server error (${status})`,
					originalError: error
				}
			}
		}

		// Check for Google status strings in generic error messages
		if (message.includes('OVER_QUERY_LIMIT')) {
			return {
				kind: 'google_quota',
				statusCode: 429,
				requestId,
				message: 'Google API quota exceeded',
				googleStatus: 'OVER_QUERY_LIMIT',
				originalError: error
			}
		}
		
		if (message.includes('REQUEST_DENIED')) {
			return {
				kind: 'google_restricted',
				statusCode: 403,
				requestId,
				message: 'Google API key restricted or invalid',
				googleStatus: 'REQUEST_DENIED',
				originalError: error
			}
		}
		
		if (message.includes('INVALID_REQUEST')) {
			return {
				kind: 'google_invalid',
				statusCode: 400,
				requestId,
				message: 'Invalid request to Google API',
				googleStatus: 'INVALID_REQUEST',
				originalError: error
			}
		}
	}

	// Fallback to unknown error
	const message = error instanceof Error ? error.message : String(error || 'Unknown error')
	return {
		kind: 'unknown',
		requestId,
		message,
		originalError: error
	}
}

/**
 * Retry configuration for exponential backoff
 */
export type RetryConfig = {
	maxAttempts?: number // default: 3
	baseDelayMs?: number // default: 250
	maxDelayMs?: number // default: 2000
	jitterMs?: number // default: 100
}

/**
 * Execute a function with exponential backoff retry for transient errors
 * Returns the result or throws the last error if all retries fail
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	config: RetryConfig = {},
	signal?: AbortSignal
): Promise<T> {
	const {
		maxAttempts = 3,
		baseDelayMs = 250,
		maxDelayMs = 2000,
		jitterMs = 100
	} = config

	let lastError: unknown
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		// Check if aborted before retry
		if (signal?.aborted) {
			throw lastError || new Error('Request aborted')
		}

		try {
			return await fn()
		} catch (error) {
			lastError = error
			const normalized = normalizeError(error)

			// Only retry on transient errors
			const isTransient = normalized.kind === 'rate_limited' || 
				normalized.kind === 'server_error' || 
				normalized.kind === 'offline'

			if (!isTransient || attempt === maxAttempts - 1) {
				throw error
			}

			// Calculate delay with exponential backoff
			const delay = Math.min(
				baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * jitterMs),
				maxDelayMs
			)

			// Wait before retry
			await new Promise(resolve => setTimeout(resolve, delay))
		}
	}

	throw lastError || new Error('Retry failed')
}

/**
 * Get user-friendly error message for display
 */
export function getUserErrorMessage(error: NormalizedError, hasLastGood: boolean = false): string {
	switch (error.kind) {
		case 'offline':
			return "You're offline. Check your connection."
		case 'google_quota':
			if (hasLastGood) {
				return 'Showing cached results—quota exceeded, retrying...'
			}
			return 'Google API quota exceeded. Please try again in a few minutes.'
		case 'google_restricted':
			return 'Google API key is restricted or invalid. Please contact support.'
		case 'google_invalid':
			return 'Invalid search request. Please try different search terms.'
		case 'rate_limited':
			if (hasLastGood) {
				return 'Showing cached results—retrying...'
			}
			return 'Server is rate limiting. Please try again shortly.'
		case 'unauthorized':
			return 'Session expired. Please log in again.'
		case 'validation_error':
			const rid = error.requestId ? ` (requestId: ${error.requestId})` : ''
			return `Data format error${rid}. Please retry.`
		case 'server_error':
			if (hasLastGood) {
				return 'Showing cached results—retrying...'
			}
			return `Server error (${error.statusCode || 'unknown'}). Please try again.`
		case 'unknown':
		default:
			return error.message || 'An error occurred. Please try again.'
	}
}

/**
 * Check if error should show cached results with retry message
 */
export function shouldShowCachedWithRetry(error: NormalizedError): boolean {
	return (
		error.kind === 'rate_limited' || 
		error.kind === 'server_error' || 
		error.kind === 'offline' ||
		error.kind === 'google_quota'
	)
}

/**
 * Check if error requires user action (like re-login)
 */
export function requiresUserAction(error: NormalizedError): boolean {
	return error.kind === 'unauthorized'
}

/**
 * Check if error should NOT render empty state (validation errors)
 */
export function shouldPreserveState(error: NormalizedError): boolean {
	return error.kind === 'validation_error'
}
