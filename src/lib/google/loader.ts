/**
 * Google Maps JavaScript API loader
 * Singleton loader with Places library support
 * 
 * CRITICAL: This is the ONLY place that loads the Google Maps script.
 * All components must use loadGoogleMaps() and never load the script directly.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { GOOGLE_MAPS_API_KEY, hasGoogleMapsKey, assertGoogleMapsKey } from '../../config/env'

let loadPromise: Promise<typeof google> | null = null
let ready = false
let error: Error | null = null
let loading = false

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
 * Get the current loading status
 * Returns: { ready: boolean, loading: boolean, error: Error | null }
 */
export function getGoogleMapsStatus(): { ready: boolean; loading: boolean; error: Error | null } {
	return { ready: isGoogleMapsReady(), loading, error }
}

/**
 * Load Google Maps JavaScript API with Places library
 * Returns a singleton promise that resolves when the API is loaded
 * 
 * THREAD-SAFE: Multiple simultaneous calls will receive the same promise.
 * Once loaded, subsequent calls return immediately with the google object.
 * 
 * @throws Error if VITE_GOOGLE_MAPS_API_KEY is not configured
 */
export function loadGoogleMaps(): Promise<typeof google> {
	// Fast path: already loaded and verified
	if (isGoogleMapsReady()) {
		return Promise.resolve(window.google)
	}
	
	// Return existing load promise if already loading
	if (loadPromise) {
		return loadPromise
	}
	
	// Validate API key before attempting load
	if (!hasGoogleMapsKey) {
		try {
			assertGoogleMapsKey('Google Maps')
		} catch (err) {
			error = err instanceof Error ? err : new Error(String(err))
			return Promise.reject(err)
		}
	}
	
	const apiKey = GOOGLE_MAPS_API_KEY!
	loading = true

	loadPromise = new Promise<typeof google>((resolve, reject) => {
		// Check for existing script tag (edge case: manual injection or hot reload)
		const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
		if (existing) {
			if (import.meta.env.DEV) {
				console.log('[Google Maps] Reusing existing script tag')
			}
			
			// If script already loaded, resolve immediately
			if (window.google?.maps?.places) {
				ready = true
				loading = false
				resolve(window.google)
				return
			}
			
			// Otherwise, wait for it to finish loading
			const onLoad = () => {
				if (window.google?.maps?.places) {
					ready = true
					loading = false
					resolve(window.google)
				} else {
					const err = new Error('Google Places API not available after load')
					error = err
					loading = false
					reject(err)
				}
			}
			
			const onError = (e: Event | string) => {
				const err = new Error('Failed to load Google Maps script')
				error = err
				loading = false
				if (import.meta.env.DEV) {
					console.error('[Google Maps] Failed to load existing script', e)
				}
				reject(err)
			}
			
			existing.addEventListener('load', onLoad, { once: true })
			existing.addEventListener('error', onError, { once: true })
			return
		}

		// Create new script tag
		const script = document.createElement('script')
		script.id = SCRIPT_ID
		const params = new URLSearchParams()
		params.set('key', apiKey)
		params.set('libraries', 'places') // Required for Autocomplete, TextSearch, getDetails
		params.set('v', 'weekly') // Use weekly for latest features
		script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
		script.async = true
		script.defer = true
		
		if (import.meta.env.DEV) {
			console.log('[Google Maps] Loading script with libraries=places')
		}
		
		script.onerror = (e) => {
			const err = new Error('Failed to load Google Maps script')
			error = err
			loading = false
			loadPromise = null // Allow retry
			if (import.meta.env.DEV) {
				console.error('[Google Maps] Script load failed', e)
			}
			reject(err)
		}
		
		script.onload = () => {
			// Verify Places API is available
			if (!window.google?.maps?.places) {
				const err = new Error('Google Places API not available. Ensure libraries=places is loaded.')
				error = err
				loading = false
				loadPromise = null // Allow retry
				if (import.meta.env.DEV) {
					console.error('[Google Maps]', err.message)
				}
				reject(err)
				return
			}
			
			ready = true
			loading = false
			if (import.meta.env.DEV) {
				console.log('[Google Maps] Script loaded successfully with Places API')
			}
			resolve(window.google)
		}
		
		document.head.appendChild(script)
	})
	
	// Clear promise on error to allow retries
	loadPromise.catch(() => {
		loadPromise = null
	})

	return loadPromise
}
