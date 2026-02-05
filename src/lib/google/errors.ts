/**
 * Google Places proxy error normalization
 * Maps server error codes to user-friendly messages
 */

export type GoogleProxyErrorCode = 
	| 'KEY_RESTRICTED'
	| 'OVER_QUERY_LIMIT'
	| 'ZERO_RESULTS'
	| 'OFFLINE'
	| 'NETWORK'
	| 'INVALID_REQUEST'
	| 'UNKNOWN'

export type NormalizedProxyError = {
	code: GoogleProxyErrorCode
	userMessage: string
	devDetails: string
	googleStatus?: string
	httpStatus?: number
	requestId?: string
}

/**
 * Normalize Google Places proxy error response
 */
export function normalizeGoogleProxyError(errorResponse: {
	code?: string
	userMessage?: string
	devDetails?: string
	googleStatus?: string
	httpStatus?: number
	requestId?: string
}): NormalizedProxyError {
	const code = (errorResponse.code || 'UNKNOWN') as GoogleProxyErrorCode
	
	// Use server-provided messages if available, otherwise generate defaults
	let userMessage = errorResponse.userMessage || ''
	let devDetails = errorResponse.devDetails || ''
	
	if (!userMessage) {
		switch (code) {
			case 'KEY_RESTRICTED':
				userMessage = 'Google API key is restricted or invalid. Please contact support.'
				break
			case 'OVER_QUERY_LIMIT':
				userMessage = 'Google API quota exceeded. Please try again in a few minutes.'
				break
			case 'ZERO_RESULTS':
				userMessage = 'No results found'
				break
			case 'OFFLINE':
			case 'NETWORK':
				userMessage = 'Network error. Please check your connection and try again.'
				break
			case 'INVALID_REQUEST':
				userMessage = 'Invalid search request. Please try different search terms.'
				break
			default:
				userMessage = 'An error occurred. Please try again.'
		}
	}
	
	if (!devDetails) {
		devDetails = `Error code: ${code}`
		if (errorResponse.googleStatus) {
			devDetails += `, Google status: ${errorResponse.googleStatus}`
		}
		if (errorResponse.httpStatus) {
			devDetails += `, HTTP ${errorResponse.httpStatus}`
		}
	}
	
	return {
		code,
		userMessage,
		devDetails,
		googleStatus: errorResponse.googleStatus,
		httpStatus: errorResponse.httpStatus,
		requestId: errorResponse.requestId
	}
}

/**
 * Map error to display category for UI styling
 */
export function getErrorSeverity(code: GoogleProxyErrorCode): 'error' | 'warning' | 'info' {
	switch (code) {
		case 'KEY_RESTRICTED':
		case 'OFFLINE':
		case 'NETWORK':
			return 'error'
		case 'OVER_QUERY_LIMIT':
		case 'INVALID_REQUEST':
			return 'warning'
		case 'ZERO_RESULTS':
			return 'info'
		default:
			return 'error'
	}
}

/**
 * Check if error is retryable
 */
export function isRetryable(code: GoogleProxyErrorCode): boolean {
	return code === 'OVER_QUERY_LIMIT' || code === 'NETWORK' || code === 'OFFLINE' || code === 'UNKNOWN'
}
