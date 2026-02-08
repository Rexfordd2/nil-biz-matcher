/**
 * Google HTTP API utilities for server-side calls
 * Includes retry logic and timeout handling
 */

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
async function fetchWithTimeout(url: string, timeoutMs: number, retryAfter?: number): Promise<Response> {
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
export async function fetchWithRetry(
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
