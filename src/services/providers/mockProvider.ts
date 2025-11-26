import { BusinessSearchProvider, ExternalBusiness } from '../businessSearchProvider'

export function createMockProvider(): BusinessSearchProvider {
	return {
		async searchBusinesses(params) {
			const base: ExternalBusiness[] = [
				{
					provider: 'yelp',
					providerId: 'mock-1',
					name: 'Beast Mode Gym',
					url: 'https://example.com/gym',
					rating: 4.7,
					reviewCount: 123,
					categories: ['Gym', 'Training'],
					location: { address1: '123 Power Ln', city: 'Yourtown', state: 'CA', zipCode: '90000', country: 'US' },
					imageUrl: 'https://picsum.photos/seed/gym/300/200',
					coordinates: { latitude: 33.66, longitude: -117.74 }
				},
				{
					provider: 'yelp',
					providerId: 'mock-2',
					name: 'Victory Pizza',
					url: 'https://example.com/pizza',
					rating: 4.3,
					reviewCount: 89,
					categories: ['Restaurant', 'Pizza'],
					location: { address1: '45 Slice St', city: 'Yourtown', state: 'CA', zipCode: '90000', country: 'US' },
					imageUrl: 'https://picsum.photos/seed/pizza/300/200',
					coordinates: { latitude: 33.67, longitude: -117.73 }
				}
			]
			const term = (params.term || '').toLowerCase()
			const filtered = base.filter(
				b => !term || b.name.toLowerCase().includes(term) || (b.categories || []).join(' ').toLowerCase().includes(term)
			)
			return filtered.slice(0, params.limit ?? 10)
		}
	}
}


