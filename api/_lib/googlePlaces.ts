import 'dotenv/config'
import type { ExternalBusiness } from '../../src/services/businessSearchProvider'

type SearchParams = {
	term?: string
	location?: string
	latitude?: number
	longitude?: number
	limit?: number
}

function getApiKey(): string | null {
	const key = process.env.GOOGLE_MAPS_API_KEY
	return key && key.trim().length > 0 ? key : null
}

function getRegionBias(): string | undefined {
	const region = process.env.GOOGLE_MAPS_REGION_BIAS
	return region && region.trim().length > 0 ? region : undefined
}

function buildTextSearchUrl(params: SearchParams): string {
	const key = getApiKey()
	const qs = new URLSearchParams()
	const terms: string[] = []
	if (params.term) terms.push(params.term)
	if (params.location) terms.push(params.location)
	const query = terms.join(' ').trim()
	if (query) {
		qs.set('query', query)
	}
	const region = getRegionBias()
	if (region) qs.set('region', region)
	if (typeof params.latitude === 'number' && typeof params.longitude === 'number') {
		qs.set('locationbias', `point:${params.latitude},${params.longitude}`)
	}
	qs.set('key', key || '')
	return `https://maps.googleapis.com/maps/api/place/textsearch/json?${qs.toString()}`
}

export async function searchBusinessesWithGooglePlaces(params: SearchParams): Promise<ExternalBusiness[]> {
	const key = getApiKey()
	if (!key) {
		return []
	}
	try {
		const url = buildTextSearchUrl(params)
		const res = await fetch(url, { method: 'GET' })
		if (!res.ok) {
			return []
		}
		const data = (await res.json()) as {
			results?: any[]
			status?: string
			error_message?: string
		}
		const results = Array.isArray(data.results) ? data.results : []
		const limit = params.limit && params.limit > 0 ? params.limit : undefined
		const sliced = typeof limit === 'number' ? results.slice(0, limit) : results
		return sliced.map(mapPlaceToExternal)
	} catch {
		return []
	}
}

function mapPlaceToExternal(place: any): ExternalBusiness {
	const placeId: string = place.place_id
	const name: string = place.name
	const address: string | undefined = place.formatted_address
	const lat: number | undefined = place?.geometry?.location?.lat
	const lng: number | undefined = place?.geometry?.location?.lng
	const rating: number | undefined = place?.rating
	const userRatingsTotal: number | undefined = place?.user_ratings_total
	const types: string[] = Array.isArray(place?.types) ? place.types : []
	const photoRef: string | undefined = Array.isArray(place?.photos) && place.photos[0]?.photo_reference
	const imageUrl =
		photoRef && getApiKey()
			? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(
					photoRef
			  )}&key=${encodeURIComponent(getApiKey() as string)}`
			: undefined

	return {
		provider: 'google',
		providerId: placeId,
		name,
		url: undefined, // Not available from Text Search; could be fetched via Details on demand
		phone: undefined,
		rating,
		reviewCount: userRatingsTotal,
		categories: types,
		location: {
			address1: address
		},
		imageUrl,
		coordinates: lat != null && lng != null ? { latitude: lat, longitude: lng } : undefined
	}
}

