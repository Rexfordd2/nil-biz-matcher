import { CollegeProgram } from './programTypes'
import Observability, { generateRequestId } from '../lib/obs'
import { validateProgramsResponse, truncatePayload, ValidationError } from '../validation/validators'
import { SAMPLE_PROGRAMS } from './programData'
import { withRetry } from '../lib/errorHandling'

export type ProgramFilters = {
	sport?: string
	position?: string // reserved for future use
	level?: string
	region?: string // state/region code
	gpaBand?: string // e.g., "3.0+"
}

export async function searchPrograms(
	filters: ProgramFilters,
	opts?: { requestId?: string; userId?: string | null; signal?: AbortSignal }
): Promise<CollegeProgram[]> {
	const requestId = opts?.requestId || generateRequestId()
	const span = Observability.startSpan({ feature: 'recruitment_api', route: '/api/recruiting/search', requestId, userId: opts?.userId ?? undefined })

	// Try server route first (enables future DB expansion); fallback to local static dataset
	try {
		const qs = new URLSearchParams()
		if (filters.sport) qs.set('sport', filters.sport)
		if (filters.level) qs.set('level', filters.level)
		if (filters.region) qs.set('region', filters.region)

		// Use withRetry for exponential backoff on transient errors
		const res = await withRetry(async () => {
			const response = await fetch(`/api/recruiting/search?${qs.toString()}`, {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
					'X-Request-Id': requestId,
					'X-Feature': 'recruitment'
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

		const data = await res.json().catch(() => ({}))
		const valid = validateProgramsResponse(data)
		if (!valid.ok) {
			const snippet = truncatePayload(data)
			Observability.log({ feature: 'recruitment_api', route: '/api/recruiting/search', status: 'validation_error', requestId, meta: { reason: valid.reason, payload: snippet } })
			throw new ValidationError(`Recruiting programs response invalid: ${valid.reason}`, { requestId, payloadSnippet: snippet })
		}
		const arr = valid.programs as CollegeProgram[]
		Observability.log({ feature: 'recruitment_api', route: '/api/recruiting/search', status: 'validation_ok', requestId, meta: { count: arr.length } })
		if (arr.length === 0) {
			span.end('empty', { meta: { source: 'server' } })
		} else {
			span.end('ok', { meta: { source: 'server' } })
		}
		return arr
	} catch (error) {
		if (error instanceof ValidationError) {
			// Surface to UI; do not fallback on validation mismatch
			throw error
		}
		Observability.log({
			feature: 'recruitment_api',
			route: '/api/recruiting/search',
			status: 'error',
			requestId,
			errorName: (error as any)?.name,
			errorMessage: (error as any)?.message,
			errorStack: (error as any)?.stack
		})
		throw error
	}

	// Local fallback
	const fSport = (filters.sport || '').toLowerCase()
	const fLevel = (filters.level || '').toLowerCase()
	const fRegion = (filters.region || '').toLowerCase()
	const local = SAMPLE_PROGRAMS.filter(p => {
		const sportOk = !fSport || (p.sport || '').toLowerCase().includes(fSport)
		const levelOk = !fLevel || (p.level || '').toLowerCase() === fLevel
		const regionOk = !fRegion || (p.location?.stateOrRegion || '').toLowerCase().includes(fRegion)
		return sportOk && levelOk && regionOk
	})
	if (local.length === 0) {
		span.end('empty', { meta: { source: 'fallback' } })
	} else {
		span.end('ok', { meta: { source: 'fallback', count: local.length } })
	}
	return local
}


