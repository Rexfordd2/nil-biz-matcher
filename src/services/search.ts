import { BusinessSearchProvider, ExternalBusiness } from './businessSearchProvider'
import { createYelpProvider } from './providers/yelpProvider'
import { createMockProvider } from './providers/mockProvider'
import { envConfig } from '../config/env'

let provider: BusinessSearchProvider | null = null

function getProvider(): BusinessSearchProvider {
	if (provider) return provider
	const name = envConfig.businessSearchProvider
	if (name === 'yelp') {
		if (!envConfig.yelp.enabled) {
			// Safe fallback: disable external search (empty results provider)
			provider = {
				async searchBusinesses() {
					return []
				}
			}
		} else {
			provider = createYelpProvider({ proxyUrl: envConfig.yelp.proxyUrl, apiKey: envConfig.yelp.apiKey })
		}
	} else {
		provider = createMockProvider()
	}
	return provider
}

export async function searchBusinesses(params: {
	term?: string
	location?: string
	limit?: number
}): Promise<ExternalBusiness[]> {
	return getProvider().searchBusinesses(params)
}


