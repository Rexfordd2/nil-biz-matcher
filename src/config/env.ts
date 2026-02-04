/**
 * Centralized environment configuration for client-side keys
 */

// ============================================================================
// Google Maps / Places API
// ============================================================================

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

export const hasGoogleMapsKey = Boolean(GOOGLE_MAPS_API_KEY)

/**
 * Assert Google Maps key is present, throw helpful error if missing
 * @param featureName - Name of the feature requiring the key (e.g., "Discover Business", "Recruiting Search")
 */
export function assertGoogleMapsKey(featureName: string): void {
	if (!hasGoogleMapsKey) {
		const isDev = import.meta.env.DEV
		if (isDev) {
			throw new Error(
				`${featureName} requires VITE_GOOGLE_MAPS_API_KEY.\n\n` +
				`Setup steps:\n` +
				`1. Add VITE_GOOGLE_MAPS_API_KEY=your-key-here to .env or .env.local\n` +
				`2. Restart the Vite dev server (npm run dev)\n` +
				`3. Refresh the page\n\n` +
				`Get an API key at: https://console.cloud.google.com\n` +
				`Required APIs: Maps JavaScript API, Places API`
			)
		} else {
			throw new Error(`${featureName} is not available. Google Maps API key is not configured.`)
		}
	}
}

/**
 * Get setup instructions for Google Maps API configuration
 */
export function getGoogleMapsSetupInstructions(): {
	apiKeySetup: string[]
	local: string[]
	vercel: string[]
} {
	return {
		apiKeySetup: [
			'1. Go to Google Cloud Console (console.cloud.google.com)',
			'2. Create or select a project',
			'3. Enable Maps JavaScript API and Places API',
			'4. Create a Browser API key with HTTP referrer restrictions',
			'5. Copy the API key'
		],
		local: [
			'1. Add VITE_GOOGLE_MAPS_API_KEY=your-key-here to .env or .env.local',
			'2. Restart the Vite dev server (npm run dev)',
			'3. Refresh the page'
		],
		vercel: [
			'1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
			'2. Add VITE_GOOGLE_MAPS_API_KEY with your API key',
			'3. Select the environments (Production, Preview, Development)',
			'4. Save and trigger a new deployment'
		]
	}
}

// ============================================================================
// Console logging helper (dev mode only)
// ============================================================================

export function logEnvStatus(): void {
	if (import.meta.env.DEV) {
		console.log('[Env Config]', {
			hasGoogleMapsKey,
			mode: import.meta.env.MODE,
			dev: import.meta.env.DEV
		})
	}
}
