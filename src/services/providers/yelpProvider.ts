import { BusinessSearchProvider, ExternalBusiness } from '../businessSearchProvider'

type YelpBusiness = {
	id: string
	name: string
	url?: string
	phone?: string
	rating?: number
	review_count?: number
	categories?: { alias: string; title: string }[]
	image_url?: string
	location?: {
		address1?: string
		address2?: string
		city?: string
		state?: string
		zip_code?: string
		country?: string
	}
	coordinates?: {
		latitude?: number
		longitude?: number
	}
}

function mapYelp(b: YelpBusiness): ExternalBusiness {
	return {
		provider: 'yelp',
		providerId: b.id,
		name: b.name,
		url: b.url,
		phone: b.phone,
		rating: b.rating,
		reviewCount: b.review_count,
		categories: (b.categories || []).map(c => c.title),
		location: b.location
			? {
					address1: b.location.address1,
					address2: b.location.address2,
					city: b.location.city,
					state: b.location.state,
					zipCode: b.location.zip_code,
					country: b.location.country
			  }
			: undefined,
		imageUrl: b.image_url,
		coordinates: b.coordinates
	}
}

export function createYelpProvider(config: {
	proxyUrl?: string
	apiKey?: string
}): BusinessSearchProvider {
	const endpoint = config.proxyUrl || 'https://api.yelp.com/v3/businesses/search'
	const useProxy = Boolean(config.proxyUrl)
	return {
		async searchBusinesses(params) {
			const qs = new URLSearchParams()
			if (params.term) qs.set('term', params.term)
			if (params.location) qs.set('location', params.location)
			qs.set('limit', String(params.limit ?? 10))
			const res = await fetch(`${endpoint}?${qs.toString()}`, {
				mode: 'cors',
				headers: useProxy
					? {}
					: config.apiKey
					? { Authorization: `Bearer ${config.apiKey}` }
					: {}
			})
			if (!res.ok) {
				throw new Error(`Yelp search failed: ${res.status}`)
			}
			const data = await res.json()
			const items: YelpBusiness[] = data.businesses || []
			return items.map(mapYelp)
		}
	}
}


