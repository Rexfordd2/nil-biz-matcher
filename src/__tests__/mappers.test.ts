import { describe, it, expect } from 'vitest'
import { mapExternalToBusiness } from '../services/mappers'
import type { ExternalBusiness } from '../services/businessSearchProvider'

describe('mapExternalToBusiness', () => {
	it('maps full external business to internal partial with joined location', () => {
		const ext: ExternalBusiness = {
			provider: 'google',
			providerId: 'y1',
			name: 'Joe Coffee',
			url: 'https://joe.example',
			phone: '123-456',
			location: {
				address1: '123 A St',
				address2: undefined,
				city: 'Austin',
				state: 'TX',
				zipCode: '78701',
				country: 'US'
			},
			imageUrl: 'https://img/joe.png',
			coordinates: { latitude: 30.27, longitude: -97.74 }
		}

		const res = mapExternalToBusiness(ext)
		expect(res.name).toBe('Joe Coffee')
		expect(res.url).toBe('https://joe.example')
		expect(res.logoUrl).toBe('https://img/joe.png')
		expect(res.externalProvider).toBe('google')
		expect(res.externalProviderId).toBe('y1')
		expect(res.phone).toBe('123-456')
		expect(res.coordinates).toEqual({ latitude: 30.27, longitude: -97.74 })
		// address2 omitted; should join remaining truthy parts
		expect(res.location).toBe('123 A St, Austin, TX, 78701, US')
		// description intentionally left undefined by the mapper
		expect(res.description).toBeUndefined()
	})

	it('handles missing location gracefully (empty string)', () => {
		const ext: ExternalBusiness = {
			provider: 'other',
			providerId: 'p2',
			name: 'No Address LLC'
		}
		const res = mapExternalToBusiness(ext)
		expect(res.name).toBe('No Address LLC')
		expect(res.location).toBe('')
	})
})


