import { ExternalBusiness } from './businessSearchProvider'

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

	const res = await fetch(`/api/business/search?${qs.toString()}`, {
		method: 'GET',
		headers: { 'Accept': 'application/json' }
	})
	if (!res.ok) {
		// Gracefully degrade to empty results on server errors
		return []
	}
	const data = (await res.json()) as { businesses?: ExternalBusiness[] } | ExternalBusiness[]
	// Support either a raw array or wrapped payload
	const arr = Array.isArray(data) ? data : data.businesses || []
	return arr
}

