/**
 * Anonymous user identity management
 * Creates and persists an anonymous user ID for unauthenticated users
 */

const STORAGE_KEY_ANON_ID = 'anon_user_id'
const STORAGE_KEY_ANON_CREATED_AT = 'anon_user_created_at'

/**
 * Generate a random UUID with fallback for environments without crypto.randomUUID()
 */
function generateUUID(): string {
	if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
		return window.crypto.randomUUID()
	}
	// Fallback for older browsers or SSR environments
	// Simple UUID v4 implementation
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

/**
 * Get or create an anonymous user ID
 * Creates and persists the ID in localStorage if it doesn't exist
 * @returns The anonymous user ID string
 */
export function getAnonId(): string {
	if (typeof window === 'undefined') {
		// SSR safety: return a temporary ID that won't persist
		return 'ssr-temp-id'
	}

	try {
		const existing = localStorage.getItem(STORAGE_KEY_ANON_ID)
		if (existing) {
			return existing
		}

		// Create new anonymous ID
		const newId = generateUUID()
		localStorage.setItem(STORAGE_KEY_ANON_ID, newId)
		return newId
	} catch (error) {
		// localStorage might be disabled or unavailable
		// eslint-disable-next-line no-console
		console.warn('[anonIdentity] Failed to access localStorage:', error)
		return 'localStorage-unavailable'
	}
}

/**
 * Get anonymous user profile with ID and creation timestamp
 * Stores createdAt once on first call
 * @returns Object with anonId and createdAt (ISO string)
 */
export function getAnonProfile(): { anonId: string; createdAt: string } {
	if (typeof window === 'undefined') {
		// SSR safety: return temporary values
		return {
			anonId: 'ssr-temp-id',
			createdAt: new Date().toISOString()
		}
	}

	const anonId = getAnonId()

	try {
		let createdAt = localStorage.getItem(STORAGE_KEY_ANON_CREATED_AT)
		if (!createdAt) {
			// Store creation timestamp on first access
			createdAt = new Date().toISOString()
			localStorage.setItem(STORAGE_KEY_ANON_CREATED_AT, createdAt)
		}
		return { anonId, createdAt }
	} catch (error) {
		// localStorage might be disabled or unavailable
		// eslint-disable-next-line no-console
		console.warn('[anonIdentity] Failed to access localStorage:', error)
		return {
			anonId,
			createdAt: new Date().toISOString()
		}
	}
}

/**
 * Reset anonymous user ID (for debugging/testing)
 * Clears both the ID and creation timestamp from localStorage
 */
export function resetAnonId(): void {
	if (typeof window === 'undefined') {
		// SSR safety: no-op
		return
	}

	try {
		localStorage.removeItem(STORAGE_KEY_ANON_ID)
		localStorage.removeItem(STORAGE_KEY_ANON_CREATED_AT)
		// eslint-disable-next-line no-console
		console.log('[anonIdentity] Anonymous ID reset')
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('[anonIdentity] Failed to reset anonymous ID:', error)
	}
}

/**
 * Initialize anonymous identity at app start
 * Call this once when the app loads to ensure anon_id exists before any app actions
 */
export function initAnonIdentity(): void {
	if (typeof window === 'undefined') {
		// SSR safety: no-op
		return
	}

	// Initialize by getting the ID (creates if doesn't exist)
	getAnonId()
	// Initialize profile to ensure createdAt is stored
	getAnonProfile()
}
