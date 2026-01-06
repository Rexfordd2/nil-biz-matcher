// Centralized, typed environment configuration for client-side flags
// Yelp has been removed; business search is always available client-side and
// routed through a server endpoint that reads GOOGLE_MAPS_* env vars.
export function isBusinessSearchEnabled(): boolean {
	return true
}

// Build/Version stamp (set at build-time via .env.local from prebuild script)
export const BUILD_ID: string = (import.meta.env.VITE_BUILD_ID as string) || 'dev'
export const BUILD_TIME: string = (import.meta.env.VITE_BUILD_TIME as string) || 'unknown'
export function getBuildStamp(): string {
	return `Build: ${BUILD_ID} @ ${BUILD_TIME}`
}

