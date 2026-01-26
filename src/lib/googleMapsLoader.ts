/* eslint-disable @typescript-eslint/no-explicit-any */
let loadPromise: Promise<typeof google> | null = null
let ready = false

declare global {
	interface Window {
		google: any
	}
}

const SCRIPT_ID = 'google-maps-js'

export function isGoogleMapsReady(): boolean {
	return !!(ready && window.google && window.google.maps && window.google.maps.places)
}

export function loadGoogleMaps(): Promise<typeof google> {
	if (isGoogleMapsReady()) {
		return Promise.resolve(window.google)
	}
	if (loadPromise) {
		return loadPromise
	}
	const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
	if (!apiKey || apiKey.trim() === '') {
		return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'))
	}

	loadPromise = new Promise<typeof google>((resolve, reject) => {
		// If a script with our ID is already present, reuse its load lifecycle
		const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
		if (existing) {
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
		params.set('libraries', 'places')
		// Keep version stable-ish; weekly is recommended for new features
		params.set('v', 'weekly')
		script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
		script.async = true
		script.defer = true
		script.onerror = (e) => {
			reject(e)
		}
		script.onload = () => {
			ready = true
			resolve(window.google)
		}
		document.head.appendChild(script)
	})

	return loadPromise
}


