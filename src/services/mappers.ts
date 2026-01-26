import { Business } from '../types'
import { ExternalBusiness } from './businessSearchProvider'

export function mapExternalToBusiness(ext: ExternalBusiness): Partial<Business> {
	return {
		name: ext.name,
		url: ext.url,
		description: undefined, // will be filled later / manually if needed
		rating: ext.rating,
		reviewCount: ext.reviewCount,
		location: [
			ext.location?.address1,
			ext.location?.address2,
			ext.location?.city,
			ext.location?.state,
			ext.location?.zipCode,
			ext.location?.country
		]
			.filter(Boolean)
			.join(', '),
		logoUrl: ext.imageUrl,
		externalProvider: ext.provider,
		externalProviderId: ext.providerId,
		phone: ext.phone,
		coordinates: ext.coordinates
		// optional: categories, etc.
	}
}


