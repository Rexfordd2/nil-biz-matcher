/**
 * Google Maps JavaScript API loader
 * Singleton loader with Places library support
 * 
 * CRITICAL: This is the ONLY place that loads the Google Maps script.
 * All components must use loadGoogleMaps() and never load the script directly.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { GOOGLE_MAPS_API_KEY, hasGoogleMapsKey, assertGoogleMapsKey } from '../../config/env'
import { logGoogleStart, logGoogleSuccess, logGoogleError, GoogleError } from './telemetry'

// Window-backed singleton state to survive module duplication
type LoaderState = {
	loadPromise: Promise<typeof google> | null
	ready: boolean
	error: Error | null
	loading: boolean
	lastLoadedAt: number | null
}

declare global {
	interface Window {
		google: any
		__googleMapsLoaderState?: LoaderState
		gm_authFailure?: () => void
	}
}

const SCRIPT_ID = 'google-maps-js'
const LOAD_TIMEOUT_MS = 20000 // 20 seconds

/**
 * Get or initialize the window-backed loader state
 */
function getLoaderState(): LoaderState {
	if (!window.__googleMapsLoaderState) {
		window.__googleMapsLoaderState = {
			loadPromise: null,
			ready: false,
			error: null,
			loading: false,
			lastLoadedAt: null
		}
	}
	return window.__googleMapsLoaderState
}

/**
 * Check if Google Maps API is loaded and ready
 */
export function isGoogleMapsReady(): boolean {
	const state = getLoaderState()
	return !!(state.ready && window.google && window.google.maps && window.google.maps.places)
}

/**
 * Get the current loading status
 * Returns: { ready: boolean, loading: boolean, error: Error | null, lastLoadedAt: number | null }
 */
export function getGoogleMapsStatus(): { 
	ready: boolean
	loading: boolean
	error: Error | null
	lastLoadedAt: number | null
} {
	const state = getLoaderState()
	return { 
		ready: isGoogleMapsReady(), 
		loading: state.loading, 
		error: state.error,
		lastLoadedAt: state.lastLoadedAt
	}
}

/**
 * Find any existing Google Maps script in the document
 */
function findExistingGoogleScript(): HTMLScriptElement | null {
	// Check by ID first
	const byId = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
	if (byId) return byId
	
	// Scan all scripts for Google Maps API URL
	const scripts = document.getElementsByTagName('script')
	for (let i = 0; i < scripts.length; i++) {
		const script = scripts[i]
		if (script.src && script.src.includes('maps.googleapis.com/maps/api/js')) {
			return script
		}
	}
	
	return null
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
	const state = getLoaderState()
	
	// Fast path: already loaded and verified
	if (isGoogleMapsReady()) {
		return Promise.resolve(window.google)
	}
	
	// Return existing load promise if already loading
	if (state.loadPromise) {
		return state.loadPromise
	}
	
	// Validate API key before attempting load
	if (!hasGoogleMapsKey) {
		try {
			assertGoogleMapsKey('Google Maps')
		} catch (err) {
			state.error = err instanceof Error ? err : new Error(String(err))
			logGoogleError(
				{ feature: 'discover', operation: 'loader.error' },
				{
					message: 'Google Maps API key not configured',
					name: 'ConfigError',
					retryable: false
				}
			)
			return Promise.reject(err)
		}
	}
	
	const apiKey = GOOGLE_MAPS_API_KEY!
	state.loading = true
	
	const requestId = logGoogleStart({
		feature: 'discover',
		operation: 'loader.start',
		userAction: 'load_maps_api'
	})

	state.loadPromise = new Promise<typeof google>((resolve, reject) => {
		let timeoutId: NodeJS.Timeout | null = null
		let authFailureTriggered = false
		
		// Install auth failure handler BEFORE loading script
		if (!window.gm_authFailure) {
			window.gm_authFailure = () => {
				authFailureTriggered = true
				const err = new GoogleError(
					'Google Maps authentication failed. API key may be restricted or invalid.',
					'loader.auth_failure',
					{
						googleStatus: 'REQUEST_DENIED',
						retryable: false,
						statusCode: 403,
						requestId
					}
				)
				state.error = err
				state.loading = false
				state.loadPromise = null
				
				if (timeoutId) clearTimeout(timeoutId)
				
				logGoogleError(
					{ feature: 'discover', operation: 'loader.auth_failure', requestId },
					{
						message: err.message,
						name: err.name,
						googleStatus: 'REQUEST_DENIED',
						statusCode: 403,
						retryable: false
					}
				)
				
				reject(err)
			}
		}
		
		// Set timeout to detect hung loads
		timeoutId = setTimeout(() => {
			if (!state.ready && state.loading) {
				const err = new GoogleError(
					'Google Maps script load timeout',
					'loader.timeout',
					{
						retryable: true,
						statusCode: 504,
						requestId
					}
				)
				state.error = err
				state.loading = false
				state.loadPromise = null
				
				logGoogleError(
					{ feature: 'discover', operation: 'loader.timeout', requestId },
					{
						message: err.message,
						name: err.name,
						retryable: true,
						statusCode: 504
					}
				)
				
				reject(err)
			}
		}, LOAD_TIMEOUT_MS)
		
		// Check for existing script tag
		const existing = findExistingGoogleScript()
		if (existing) {
			if (import.meta.env.DEV) {
				console.log('[Google Maps] Reusing existing script tag')
			}
			
			logGoogleSuccess(
				{ feature: 'discover', operation: 'loader.reuse', requestId },
				{ googleStatus: 'OK' }
			)
			
			// If script already loaded, resolve immediately
			if (window.google?.maps?.places) {
				state.ready = true
				state.loading = false
				state.lastLoadedAt = Date.now()
				if (timeoutId) clearTimeout(timeoutId)
				
				logGoogleSuccess(
					{ feature: 'discover', operation: 'loader.loaded', requestId },
					{ googleStatus: 'OK' }
				)
				
				resolve(window.google)
				return
			}
			
			// Otherwise, wait for it to finish loading
			const onLoad = () => {
				if (timeoutId) clearTimeout(timeoutId)
				
				if (window.google?.maps?.places) {
					state.ready = true
					state.loading = false
					state.lastLoadedAt = Date.now()
					
					logGoogleSuccess(
						{ feature: 'discover', operation: 'loader.loaded', requestId },
						{ googleStatus: 'OK' }
					)
					
					resolve(window.google)
				} else {
					const err = new GoogleError(
						'Google Places API not available after load',
						'loader.error',
						{
							retryable: true,
							requestId
						}
					)
					state.error = err
					state.loading = false
					
					logGoogleError(
						{ feature: 'discover', operation: 'loader.error', requestId },
						{
							message: err.message,
							name: err.name,
							retryable: true
						}
					)
					
					reject(err)
				}
			}
			
			const onError = (e: Event | string) => {
				if (timeoutId) clearTimeout(timeoutId)
				if (authFailureTriggered) return // Already handled by gm_authFailure
				
				const err = new GoogleError(
					'Failed to load Google Maps script',
					'loader.error',
					{
						retryable: true,
						requestId
					}
				)
				state.error = err
				state.loading = false
				
				logGoogleError(
					{ feature: 'discover', operation: 'loader.error', requestId },
					{
						message: err.message,
						name: err.name,
						retryable: true
					}
				)
				
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
			if (timeoutId) clearTimeout(timeoutId)
			if (authFailureTriggered) return // Already handled by gm_authFailure
			
			const err = new GoogleError(
				'Failed to load Google Maps script',
				'loader.error',
				{
					retryable: true,
					requestId
				}
			)
			state.error = err
			state.loading = false
			state.loadPromise = null // Allow retry
			
			logGoogleError(
				{ feature: 'discover', operation: 'loader.error', requestId },
				{
					message: err.message,
					name: err.name,
					retryable: true
				}
			)
			
			if (import.meta.env.DEV) {
				console.error('[Google Maps] Script load failed', e)
			}
			reject(err)
		}
		
		script.onload = () => {
			if (timeoutId) clearTimeout(timeoutId)
			
			// Verify Places API is available
			if (!window.google?.maps?.places) {
				const err = new GoogleError(
					'Google Places API not available. Ensure libraries=places is loaded.',
					'loader.error',
					{
						retryable: true,
						requestId
					}
				)
				state.error = err
				state.loading = false
				state.loadPromise = null // Allow retry
				
				logGoogleError(
					{ feature: 'discover', operation: 'loader.error', requestId },
					{
						message: err.message,
						name: err.name,
						retryable: true
					}
				)
				
				if (import.meta.env.DEV) {
					console.error('[Google Maps]', err.message)
				}
				reject(err)
				return
			}
			
			state.ready = true
			state.loading = false
			state.lastLoadedAt = Date.now()
			
			logGoogleSuccess(
				{ feature: 'discover', operation: 'loader.loaded', requestId },
				{ googleStatus: 'OK' }
			)
			
			if (import.meta.env.DEV) {
				console.log('[Google Maps] Script loaded successfully with Places API')
			}
			resolve(window.google)
		}
		
		document.head.appendChild(script)
	})
	
	// Clear promise on error to allow retries
	state.loadPromise.catch(() => {
		state.loadPromise = null
	})

	return state.loadPromise
}
