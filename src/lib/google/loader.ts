/**
 * Google Maps JavaScript API loader
 * Singleton loader with Places library support
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { GOOGLE_MAPS_API_KEY, hasGoogleMapsKey, assertGoogleMapsKey } from '../../config/env'

let loadPromise: Promise<typeof google> | null = null
let ready = false

declare global {
	interface Window {
		google: any
	}
}

const SCRIPT_ID = 'google-maps-js'

/**
 * Check if Google Maps API is loaded and ready
 */
export function isGoogleMapsReady(): boolean {
	return !!(ready && window.google && window.google.maps && window.google.maps.places)
}

/**
 * Load Google Maps JavaScript API with Places library
 * Returns a singleton promise that resolves when the API is loaded
 * 
 * @throws Error if VITE_GOOGLE_MAPS_API_KEY is not configured
 */
export function loadGoogleMaps(): Promise<typeof google> {
	if (isGoogleMapsReady()) {
		return Promise.resolve(window.google)
	}
	if (loadPromise) {
		return loadPromise
	}
	
	if (!hasGoogleMapsKey) {
		try {
			assertGoogleMapsKey('Google Maps')
		} catch (err) {
			return Promise.reject(err)
		}
	}
	
	const apiKey = GOOGLE_MAPS_API_KEY!

	loadPromise = new Promise<typeof google>((resolve, reject) => {
		// If a script with our ID is already present, reuse its load lifecycle
		const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
		if (existing) {
			if (import.meta.env.DEV) {
				console.log('[Google Maps] Reusing existing script tag')
			}
			existing.addEventListener('load', () => {
				ready = true
				resolve(window.google)
			})
			existing.addEventListener('error', (e) => reject(e))
			return
		}

		const script = document.createElement('script')
		script.id = SCRIPT_ID
		const params = new URLSearchParams()
		params.set('key', apiKey)
		params.set('libraries', 'places') // Required for Autocomplete, TextSearch, getDetails
		// Keep version stable-ish; weekly is recommended for new features
		params.set('v', 'weekly')
		script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
		script.async = true
		script.defer = true
		
		if (import.meta.env.DEV) {
			console.log('[Google Maps] Loading script with libraries=places')
		}
		
		script.onerror = (e) => {
			if (import.meta.env.DEV) {
				console.error('[Google Maps] Failed to load script', e)
			}
			reject(e)
		}
		script.onload = () => {
			ready = true
			// Verify Places API is available
			if (!window.google?.maps?.places) {
				const err = new Error('Google Places API not available. Ensure libraries=places is loaded.')
				if (import.meta.env.DEV) {
					console.error('[Google Maps]', err.message)
				}
				reject(err)
				return
			}
			if (import.meta.env.DEV) {
				console.log('[Google Maps] Script loaded successfully with Places API')
			}
			resolve(window.google)
		}
		document.head.appendChild(script)
	})

	return loadPromise
}
