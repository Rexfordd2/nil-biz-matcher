// Centralized, typed environment configuration with runtime checks
export type BusinessSearchProviderName = 'mock' | 'yelp'

export type YelpConfig = {
	readonly proxyUrl?: string
	readonly apiKey?: string
	readonly enabled: boolean
}

export type EnvConfig = {
	readonly businessSearchProvider: BusinessSearchProviderName
	readonly yelp: YelpConfig
	readonly features: {
		readonly businessSearch: boolean
	}
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function resolveConfig(): EnvConfig {
	const providerRaw = readString((import.meta as any).env?.VITE_BUSINESS_SEARCH_PROVIDER) || 'mock'
	const provider: BusinessSearchProviderName = providerRaw === 'yelp' ? 'yelp' : 'mock'

	const yelpProxy = readString((import.meta as any).env?.VITE_YELP_PROXY_URL)
	const yelpKey = readString((import.meta as any).env?.VITE_YELP_API_KEY)

	const yelpEnabled = Boolean(yelpProxy || yelpKey)
	const features = {
		businessSearch: provider === 'yelp' ? yelpEnabled : true
	}

	return {
		businessSearchProvider: provider,
		yelp: {
			proxyUrl: yelpProxy,
			apiKey: yelpKey,
			enabled: yelpEnabled
		},
		features
	}
}

export const envConfig: EnvConfig = resolveConfig()

export function isBusinessSearchEnabled(): boolean {
	return envConfig.features.businessSearch
}


