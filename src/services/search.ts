import { ExternalBusiness } from './businessSearchProvider'
import { createMockProvider } from './providers/mockProvider'
import Observability, { generateRequestId } from '../lib/obs'
import { validateBusinessResponse, truncatePayload, ValidationError } from '../validation/validators'
import { withRetry } from '../lib/errorHandling'

export async function searchBusinesses(params: {
	term?: string
	location?: string
	limit?: number
	latitude?: number
	longitude?: number
}, opts?: { requestId?: string; signal?: AbortSignal }): Promise<ExternalBusiness[]> {
	const qs = new URLSearchParams()
	if (params.term) qs.set('term', params.term)
	if (params.location) qs.set('location', params.location)
	if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
	if (typeof params.latitude === 'number') qs.set('lat', String(params.latitude))
	if (typeof params.longitude === 'number') qs.set('lng', String(params.longitude))

	const requestId = opts?.requestId || generateRequestId()
	const span = Observability.startSpan({ feature: 'discover_api', route: '/api/business/search', requestId })

	try {
		// Use withRetry for exponential backoff on transient errors
		const res = await withRetry(async () => {
			const response = await fetch(`/api/business/search?${qs.toString()}`, {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
					'X-Request-Id': requestId,
					'X-Feature': 'discover'
				},
				signal: opts?.signal
			})
			if (!response.ok) {
				const err = new Error(`HTTP ${response.status}`) as any
				err.status = response.status
				// Extract Retry-After header if present
				const retryAfter = response.headers.get('Retry-After')
				if (retryAfter) {
					err.retryAfter = parseInt(retryAfter, 10)
				}
				throw err
			}
			return response
		}, { maxAttempts: 3 }, opts?.signal)

		const data = await res.json()
		const valid = validateBusinessResponse(data)
		if (!valid.ok) {
			const snippet = truncatePayload(data)
			Observability.log({ feature: 'discover_api', route: '/api/business/search', status: 'validation_error', requestId, meta: { reason: valid.reason, payload: snippet } })
			throw new ValidationError(`Business search response invalid: ${valid.reason}`, { requestId, payloadSnippet: snippet })
		}
		const arr = valid.businesses as ExternalBusiness[]
		Observability.log({ feature: 'discover_api', route: '/api/business/search', status: 'validation_ok', requestId, meta: { count: arr.length } })
		if (arr.length === 0) {
			span.end('empty', { meta: { source: 'server' } })
		} else {
			span.end('ok', { meta: { source: 'server' } })
		}
		return arr
	} catch (error) {
		if (error instanceof ValidationError) {
			// Surface to caller; do not fallback on validation mismatch
			throw error
		}
		Observability.log({
			feature: 'discover_api',
			route: '/api/business/search',
			status: 'error',
			requestId,
			errorName: (error as any)?.name,
			errorMessage: (error as any)?.message,
			errorStack: (error as any)?.stack
		})
		throw error
	}
	// Fallback to mock provider only in development to avoid inconsistent prod data
	if (import.meta.env.DEV) {
		const mock = createMockProvider()
		const fallback = await mock.searchBusinesses({
			term: params.term,
			location: params.location,
			limit: params.limit
		})
		if (fallback.length === 0) {
			span.end('empty', { meta: { source: 'fallback' } })
		} else {
			span.end('ok', { meta: { source: 'fallback', count: fallback.length } })
		}
		return fallback
	}

	span.end('error', { meta: { source: 'server_only' } })
	throw new Error('Business search failed without dev fallback')
}

