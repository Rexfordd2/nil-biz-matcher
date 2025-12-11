// Centralized, typed environment configuration for client-side flags
// Yelp has been removed; business search is always available client-side and
// routed through a server endpoint that reads GOOGLE_MAPS_* env vars.
export function isBusinessSearchEnabled(): boolean {
	return true
}

