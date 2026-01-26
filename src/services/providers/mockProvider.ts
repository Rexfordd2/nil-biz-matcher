import { BusinessSearchProvider, ExternalBusiness } from '../businessSearchProvider'

export function createMockProvider(): BusinessSearchProvider {
	return {
		async searchBusinesses(params) {
			const base: ExternalBusiness[] = [
				{
					provider: 'google',
					providerId: 'mock-1',
					name: 'Beast Mode Gym',
					url: 'https://example.com/gym',
					rating: 4.7,
					reviewCount: 123,
					categories: ['Gym', 'Training'],
					location: { address1: '123 Power Ln', city: 'Huntington Beach', state: 'CA', zipCode: '92648', country: 'US' },
					imageUrl: 'https://picsum.photos/seed/gym/300/200',
					coordinates: { latitude: 33.66, longitude: -117.74 }
				},
				{
					provider: 'google',
					providerId: 'mock-2',
					name: 'Victory Pizza',
					url: 'https://example.com/pizza',
					rating: 4.3,
					reviewCount: 89,
					categories: ['Restaurant', 'Pizza'],
					location: { address1: '45 Slice St', city: 'Huntington Beach', state: 'CA', zipCode: '92646', country: 'US' },
					imageUrl: 'https://picsum.photos/seed/pizza/300/200',
					coordinates: { latitude: 33.67, longitude: -117.73 }
				},
				{
					provider: 'google',
					providerId: 'mock-3',
					name: 'OC Recovery PT',
					url: 'https://example.com/pt',
					rating: 4.9,
					reviewCount: 54,
					categories: ['Physical Therapy', 'Rehab'],
					location: { address1: '777 Rehab Rd', city: 'Costa Mesa', state: 'CA', zipCode: '92626', country: 'US' },
					imageUrl: 'https://picsum.photos/seed/pt/300/200',
					coordinates: { latitude: 33.68, longitude: -117.91 }
				},
				{
					provider: 'google',
					providerId: 'mock-4',
					name: 'Longhorn Protein Shop',
					url: 'https://example.com/protein',
					rating: 4.5,
					reviewCount: 210,
					categories: ['Supplements', 'Health'],
					location: { address1: '10 Gains Ave', city: 'Austin', state: 'TX', zipCode: '73301', country: 'US' },
					imageUrl: 'https://picsum.photos/seed/protein/300/200',
					coordinates: { latitude: 30.27, longitude: -97.74 }
				}
			]
			const term = (params.term || '').toLowerCase()
			const loc = (params.location || '').toLowerCase()
			const filtered = base.filter(b => {
				const inTerm = !term
					|| b.name.toLowerCase().includes(term)
					|| (b.categories || []).join(' ').toLowerCase().includes(term)
				const cityState = [b.location?.city, b.location?.state].filter(Boolean).join(', ').toLowerCase()
				const inLoc = !loc || cityState.includes(loc) || (b.location?.zipCode || '').toLowerCase().includes(loc)
				return inTerm && inLoc
			})
			return filtered.slice(0, params.limit ?? 10)
		}
	}
}


