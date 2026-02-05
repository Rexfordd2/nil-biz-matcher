/**
 * Google HTTP API utilities for server-side calls
 * Includes retry logic and timeout handling
 */

const ATTEMPT_TIMEOUT_MS = 8000 // 8 seconds per attempt
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
 * @returns Response object
 * @throws Error after all retries exhausted
 */
export async function fetchWithRetry(
	url: string,
	options?: {
		maxRetries?: number
		baseDelayMs?: number
		timeoutMs?: number
	}
): Promise<Response> {
	const maxRetries = options?.maxRetries ?? MAX_RETRIES
	const baseDelayMs = options?.baseDelayMs ?? BASE_DELAY_MS
	const timeoutMs = options?.timeoutMs ?? ATTEMPT_TIMEOUT_MS
	
	let lastError: any
	
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetchWithTimeout(url, timeoutMs)
			
			// If response is ok or non-retryable error, return it
			if (response.ok) {
				return response
			}
			
			// Check if status code is retryable
			const retryable = isRetryable({ status: response.status }, attempt)
			if (!retryable.shouldRetry) {
				return response // Let caller handle non-retryable errors
			}
			
			lastError = { status: response.status, message: `HTTP ${response.status}` }
			
			// Wait before retry (exponential backoff with jitter)
			if (attempt < maxRetries) {
				const delay = baseDelayMs * Math.pow(2, attempt)
				const jitter = Math.floor(Math.random() * 100)
				await new Promise(resolve => setTimeout(resolve, delay + jitter))
			}
		} catch (error) {
			lastError = error
			
			const retryable = isRetryable(error, attempt)
			if (!retryable.shouldRetry) {
				throw error
			}
			
			// Wait before retry
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
