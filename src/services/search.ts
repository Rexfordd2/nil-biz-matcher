import { ExternalBusiness } from './businessSearchProvider'
import { createMockProvider } from './providers/mockProvider'

export async function searchBusinesses(params: {
	term?: string
	location?: string
	limit?: number
	latitude?: number
	longitude?: number
}): Promise<ExternalBusiness[]> {
	const qs = new URLSearchParams()
	if (params.term) qs.set('term', params.term)
	if (params.location) qs.set('location', params.location)
	if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
	if (typeof params.latitude === 'number') qs.set('lat', String(params.latitude))
	if (typeof params.longitude === 'number') qs.set('lng', String(params.longitude))

	try {
		const res = await fetch(`/api/business/search?${qs.toString()}`, {
			method: 'GET',
			headers: { 'Accept': 'application/json' }
		})
		if (res.ok) {
			const data = (await res.json()) as { businesses?: ExternalBusiness[] } | ExternalBusiness[]
			const arr = Array.isArray(data) ? data : data.businesses || []
			if (arr.length > 0) return arr
		}
	} catch {}
	// Fallback to mock provider when server is unavailable or returns no results
	const mock = createMockProvider()
	return mock.searchBusinesses({
		term: params.term,
		location: params.location,
		limit: params.limit
	})
}

