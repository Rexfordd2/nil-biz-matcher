export type ExternalBusiness = {
	provider: 'yelp' | 'other'
	providerId: string
	name: string
	url?: string
	phone?: string
	rating?: number
	reviewCount?: number
	categories?: string[]
	location?: {
		address1?: string
		address2?: string
		city?: string
		state?: string
		zipCode?: string
		country?: string
	}
	imageUrl?: string
	coordinates?: {
		latitude?: number
		longitude?: number
	}
}

export interface BusinessSearchProvider {
	searchBusinesses(params: {
		term?: string
		location?: string
		limit?: number
	}): Promise<ExternalBusiness[]>
}


