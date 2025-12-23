// Centralized, typed environment configuration for client-side flags
// Yelp has been removed; business search is always available client-side and
// routed through a server endpoint that reads GOOGLE_MAPS_* env vars.
export function isBusinessSearchEnabled(): boolean {
	return true
}

// Build/Version stamp (set at build-time via Vite define in vite.config.ts)
export const BUILD_ID: string = (import.meta.env.VITE_BUILD_ID as string) || 'dev'
export function getBuildStamp(): string {
	return `Build: ${BUILD_ID}`
}

