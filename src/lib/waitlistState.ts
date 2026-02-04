/**
 * Centralized waitlist state management
 * Handles localStorage persistence for waitlist joined state
 */

const WAITLIST_JOINED_KEY = 'al_waitlist_joined'
const WAITLIST_CONFIRMED_KEY = 'al_waitlist_confirmed' // backwards compatibility

/**
 * Mark the user as having joined the waitlist
 * Sets both new and legacy keys for backwards compatibility
 */
export function markWaitlistJoined(): void {
	try {
		localStorage.setItem(WAITLIST_JOINED_KEY, 'true')
		localStorage.setItem(WAITLIST_CONFIRMED_KEY, 'true') // back-compat
	} catch {
		// Silently fail if localStorage is unavailable (SSR, privacy mode, etc.)
	}
}

/**
 * Check if the user has joined the waitlist
 * Reads both new and legacy keys for backwards compatibility
 */
export function hasWaitlistJoined(): boolean {
	try {
		const joined = localStorage.getItem(WAITLIST_JOINED_KEY) === 'true'
		const confirmed = localStorage.getItem(WAITLIST_CONFIRMED_KEY) === 'true'
		return joined || confirmed
	} catch {
		// If localStorage is unavailable, return false
		return false
	}
}

/**
 * Clear waitlist joined state (for testing/debugging)
 */
export function clearWaitlistJoined(): void {
	try {
		localStorage.removeItem(WAITLIST_JOINED_KEY)
		localStorage.removeItem(WAITLIST_CONFIRMED_KEY)
	} catch {
		// Silently fail if localStorage is unavailable
	}
}
